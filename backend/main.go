// API de Cineight (prototipo). Demuestra las piezas críticas de la ERS:
//   - Retención de asientos 5 min con SET NX + TTL en Redis (RF-07, RF-54)
//   - Pago con créditos en una transacción ACID con SELECT ... FOR UPDATE (RF-63, RNF-37)
//   - Índice único parcial en boletos como última barrera contra la sobreventa (RNF-36)
//   - Idempotencia del pago (RF-23) y de los premios de trivia (RF-64)
//   - Cola virtual con ZSET (RF-36, RF-51) y rate limiting (RF-53)
//
// Las funciones se identifican por su código público (f1, f2…), el mismo que usa el frontend;
// también se acepta el id numérico.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

const (
	retencion          = 5 * time.Minute
	maxAsientos        = 6
	maxBoletosEvento   = 2
	bonoBienvenida     = 120
	creditosPorAcierto = 10
	bonoTriviaPerfecta = 50
	preguntasTrivia    = 3
)

var formatoAsiento = regexp.MustCompile(`^[A-P]-\d{2}$`)

type app struct {
	db        *pgxpool.Pool
	rdb       *redis.Client
	limite    int64 // solicitudes por minuto por IP
	capacidad int64 // clientes atendidos simultáneamente desde la cola
	origenes  map[string]bool
}

func main() {
	ctx := context.Background()
	db, err := pgxpool.New(ctx, env("DATABASE_URL", "postgres://cineight:cineight@localhost:5432/cineight"))
	if err != nil {
		log.Fatal(err)
	}
	origenes := map[string]bool{}
	for _, o := range strings.Split(env("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			origenes[o] = true
		}
	}
	a := &app{
		db:        db,
		rdb:       redis.NewClient(&redis.Options{Addr: env("REDIS_ADDR", "localhost:6379")}),
		limite:    int64(envInt("RATE_LIMIT", 5)),
		capacidad: int64(envInt("COLA_CAPACIDAD", 100)),
		origenes:  origenes,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/salud", func(w http.ResponseWriter, r *http.Request) { responder(w, 200, map[string]string{"estado": "ok"}) })
	mux.HandleFunc("GET /api/funciones", a.listarFunciones)
	mux.HandleFunc("GET /api/funciones/{id}/asientos", a.asientos)
	mux.Handle("POST /api/reservas", a.rateLimit(http.HandlerFunc(a.crearReserva)))
	mux.HandleFunc("POST /api/reservas/{id}/pagar", a.pagar)
	mux.HandleFunc("DELETE /api/reservas/{id}", a.cancelar)
	mux.HandleFunc("POST /api/sesion", a.sesion)
	mux.HandleFunc("GET /api/usuarios/{id}/cuenta", a.cuenta)
	mux.HandleFunc("POST /api/creditos/trivia", a.trivia)
	mux.HandleFunc("POST /api/boletos/{token}/validar", a.validar)
	mux.Handle("POST /api/cola/{evento}", a.rateLimit(http.HandlerFunc(a.entrarCola)))
	mux.HandleFunc("GET /api/cola/{evento}/{usuario}", a.posicionCola)
	mux.HandleFunc("GET /api/metricas", a.metricas)

	addr := ":" + env("PORT", "8080")
	log.Printf("Cineight API escuchando en %s · CORS: %v", addr, keys(origenes))
	log.Fatal(http.ListenAndServe(addr, a.cors(mux)))
}

// ---------- Catálogo ----------

func (a *app) listarFunciones(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `
		SELECT f.id, f.codigo, p.slug, p.titulo, s.codigo, s.nombre, f.inicio, f.fin, f.formato, f.idioma, f.precio, f.evento,
		       s.aforo - (SELECT count(*) FROM boletos b WHERE b.funcion_id = f.id AND b.estado IN ('valido','utilizado'))
		FROM funciones f JOIN peliculas p ON p.id = f.pelicula_id JOIN salas s ON s.id = f.sala_id
		WHERE f.fin > now() AND f.estado = 'programada' ORDER BY f.inicio`)
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	type funcion struct {
		ID         int       `json:"id"`
		Codigo     string    `json:"codigo"`
		Pelicula   string    `json:"pelicula"`
		Titulo     string    `json:"titulo"`
		Sala       string    `json:"sala"`
		SalaNombre string    `json:"sala_nombre"`
		Inicio     time.Time `json:"inicio"`
		Fin        time.Time `json:"fin"`
		Formato    string    `json:"formato"`
		Idioma     string    `json:"idioma"`
		Precio     int       `json:"precio"`
		Evento     *string   `json:"evento"`
		Disponible int       `json:"disponibles"`
	}
	lista, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (funcion, error) {
		var f funcion
		err := row.Scan(&f.ID, &f.Codigo, &f.Pelicula, &f.Titulo, &f.Sala, &f.SalaNombre, &f.Inicio, &f.Fin, &f.Formato, &f.Idioma, &f.Precio, &f.Evento, &f.Disponible)
		return f, err
	})
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	responder(w, 200, lista)
}

// Acepta el código público (f1) o el id numérico.
func (a *app) funcionID(ctx context.Context, ref string) (int, error) {
	if n, err := strconv.Atoi(ref); err == nil {
		return n, nil
	}
	var id int
	err := a.db.QueryRow(ctx, `SELECT id FROM funciones WHERE codigo = $1`, ref).Scan(&id)
	return id, err
}

// Estado de cada butaca: vendidas en PostgreSQL + retenidas (claves vivas en Redis).
func (a *app) asientos(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	fid, err := a.funcionID(ctx, r.PathValue("id"))
	if err != nil {
		fallo(w, 404, "La función no existe.")
		return
	}
	rows, err := a.db.Query(ctx, `SELECT asiento FROM boletos WHERE funcion_id = $1 AND estado IN ('valido','utilizado')`, fid)
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	vendidos, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	prefijo := fmt.Sprintf("asiento:%d:", fid)
	retenidos := []string{}
	iter := a.rdb.Scan(ctx, 0, prefijo+"*", 200).Iterator()
	for iter.Next(ctx) {
		retenidos = append(retenidos, strings.TrimPrefix(iter.Val(), prefijo))
	}
	responder(w, 200, map[string]any{"vendidos": vendidos, "retenidos": retenidos})
}

// ---------- Reservas (Redis) ----------

type solicitudReserva struct {
	Funcion   string   `json:"funcion"`
	FuncionID int      `json:"funcion_id"`
	UsuarioID int64    `json:"usuario_id"`
	Asientos  []string `json:"asientos"`
}

func (a *app) crearReserva(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var s solicitudReserva
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil || len(s.Asientos) == 0 || len(s.Asientos) > maxAsientos || s.UsuarioID == 0 {
		fallo(w, 400, fmt.Sprintf("Solicitud inválida: entre 1 y %d asientos y usuario_id requeridos.", maxAsientos))
		return
	}
	for _, as := range s.Asientos {
		if !formatoAsiento.MatchString(as) {
			fallo(w, 400, "Butaca inválida: "+as)
			return
		}
	}
	if s.Funcion != "" {
		id, err := a.funcionID(ctx, s.Funcion)
		if err != nil {
			fallo(w, 404, "La función no existe.")
			return
		}
		s.FuncionID = id
	}

	var vendidos, propios int
	var evento *string
	if err := a.db.QueryRow(ctx, `
		SELECT f.evento,
		       (SELECT count(*) FROM boletos b WHERE b.funcion_id = f.id AND b.asiento = ANY($2) AND b.estado IN ('valido','utilizado')),
		       (SELECT count(*) FROM boletos b WHERE b.funcion_id = f.id AND b.usuario_id = $3 AND b.estado IN ('valido','utilizado'))
		FROM funciones f WHERE f.id = $1`, s.FuncionID, s.Asientos, s.UsuarioID).Scan(&evento, &vendidos, &propios); err != nil {
		fallo(w, 404, "La función no existe.")
		return
	}
	if vendidos > 0 {
		fallo(w, 409, "Alguno de los asientos ya fue vendido.")
		return
	}
	// Límite por cliente en preestrenos de alta demanda (RF-36).
	if evento != nil && propios+len(s.Asientos) > maxBoletosEvento {
		fallo(w, 409, fmt.Sprintf("El preestreno permite %d boletos por cliente (ya tienes %d).", maxBoletosEvento, propios))
		return
	}

	id := "R-" + token(6)
	tomados := []string{}
	for _, as := range s.Asientos {
		clave := fmt.Sprintf("asiento:%d:%s", s.FuncionID, as)
		// SET NX es atómico: ante solicitudes simultáneas sólo la primera obtiene el asiento (RF-54).
		ok, err := a.rdb.SetNX(ctx, clave, id, retencion).Result()
		if err != nil || !ok {
			for _, t := range tomados {
				a.rdb.Del(ctx, t)
			}
			fallo(w, 409, "La butaca "+as+" ya no está disponible.")
			return
		}
		tomados = append(tomados, clave)
	}
	a.rdb.HSet(ctx, "reserva:"+id, "funcion_id", s.FuncionID, "usuario_id", s.UsuarioID, "asientos", strings.Join(s.Asientos, ","))
	a.rdb.Expire(ctx, "reserva:"+id, retencion)
	// El vencimiento de las claves libera las butacas automáticamente; el worker de notificaciones
	// escucha los eventos de expiración de Redis para avisar al cliente por WebSocket/SSE (RF-68).
	responder(w, 201, map[string]any{"reserva_id": id, "expira": time.Now().Add(retencion)})
}

func (a *app) cancelar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")
	res, err := a.rdb.HGetAll(ctx, "reserva:"+id).Result()
	if err != nil || len(res) == 0 {
		fallo(w, 404, "La reserva no existe o ya expiró.")
		return
	}
	a.liberar(ctx, id, res)
	responder(w, 200, map[string]string{"estado": "cancelada"})
}

func (a *app) liberar(ctx context.Context, id string, res map[string]string) {
	for _, as := range strings.Split(res["asientos"], ",") {
		clave := "asiento:" + res["funcion_id"] + ":" + as
		if v, _ := a.rdb.Get(ctx, clave).Result(); v == id {
			a.rdb.Del(ctx, clave)
		}
	}
	a.rdb.Del(ctx, "reserva:"+id)
}

// ---------- Pago con créditos (PostgreSQL) ----------

var errSaldo = errors.New("saldo insuficiente")

func (a *app) pagar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")

	// Idempotencia (RF-23): si la reserva ya se pagó, devolver los mismos boletos.
	if previos := a.boletosDeReserva(ctx, id); len(previos) > 0 {
		responder(w, 200, map[string]any{"reserva_id": id, "boletos": previos, "repetido": true})
		return
	}

	res, err := a.rdb.HGetAll(ctx, "reserva:"+id).Result()
	if err != nil || len(res) == 0 {
		fallo(w, 410, "La reserva expiró y los asientos fueron liberados.")
		return
	}
	asientos := strings.Split(res["asientos"], ",")
	funcionID, _ := strconv.Atoi(res["funcion_id"])
	usuarioID, _ := strconv.ParseInt(res["usuario_id"], 10, 64)

	var saldoFinal int
	err = pgx.BeginFunc(ctx, a.db, func(tx pgx.Tx) error {
		var saldo, precio int
		// Bloqueo de fila: dos pagos simultáneos del mismo usuario se serializan (no hay doble gasto).
		if err := tx.QueryRow(ctx, `SELECT saldo FROM cuentas_credito WHERE usuario_id = $1 FOR UPDATE`, usuarioID).Scan(&saldo); err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `SELECT precio FROM funciones WHERE id = $1`, funcionID).Scan(&precio); err != nil {
			return err
		}
		total := precio * len(asientos)
		if saldo < total {
			return errSaldo
		}
		saldoFinal = saldo - total
		if _, err := tx.Exec(ctx, `UPDATE cuentas_credito SET saldo = saldo - $1 WHERE usuario_id = $2`, total, usuarioID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO movimientos_credito (usuario_id, tipo, monto, referencia) VALUES ($1, 'debito', $2, $3)`,
			usuarioID, -total, id); err != nil {
			return err
		}
		for _, as := range asientos {
			if _, err := tx.Exec(ctx, `INSERT INTO boletos (token, funcion_id, asiento, usuario_id, precio, reserva_id) VALUES ($1,$2,$3,$4,$5,$6)`,
				"CE-"+token(12), funcionID, as, usuarioID, precio, id); err != nil {
				return err
			}
		}
		_, err := tx.Exec(ctx, `INSERT INTO bitacora_auditoria (usuario_id, accion, entidad, valor_nuevo) VALUES ($1, 'VENTA', 'boletos', $2)`,
			usuarioID, map[string]any{"reserva": id, "asientos": asientos, "total": total})
		return err
	})

	var pgErr *pgconn.PgError
	switch {
	case errors.Is(err, errSaldo):
		fallo(w, 402, "Saldo de créditos insuficiente.")
		return
	case errors.As(err, &pgErr) && pgErr.Code == "23505":
		// Violación de unicidad: otro proceso vendió el asiento o el pago ya se registró; la transacción se revirtió completa.
		if previos := a.boletosDeReserva(ctx, id); len(previos) > 0 {
			responder(w, 200, map[string]any{"reserva_id": id, "boletos": previos, "repetido": true})
			return
		}
		fallo(w, 409, "El asiento fue vendido a otro comprador; no se debitaron créditos.")
		return
	case err != nil:
		fallo(w, 500, err.Error())
		return
	}
	a.liberar(ctx, id, res)
	responder(w, 201, map[string]any{"reserva_id": id, "boletos": a.boletosDeReserva(ctx, id), "saldo": saldoFinal})
}

type boleto struct {
	Token   string    `json:"token"`
	Funcion string    `json:"funcion"`
	Asiento string    `json:"asiento"`
	Precio  int       `json:"precio"`
	Estado  string    `json:"estado"`
	Fecha   time.Time `json:"fecha"`
}

const columnasBoleto = `b.token, f.codigo, b.asiento, b.precio, b.estado, b.fecha_venta FROM boletos b JOIN funciones f ON f.id = b.funcion_id`

func (a *app) boletosDeReserva(ctx context.Context, id string) []boleto {
	rows, err := a.db.Query(ctx, `SELECT `+columnasBoleto+` WHERE b.reserva_id = $1 ORDER BY b.asiento`, id)
	if err != nil {
		return nil
	}
	lista, _ := pgx.CollectRows(rows, pgx.RowToStructByPos[boleto])
	return lista
}

// ---------- Sesión y cuenta de créditos ----------

// Vincula al cliente que inició sesión en el frontend con su cuenta en PostgreSQL (la crea con el bono de bienvenida).
// Pendiente: autenticación real con JWT + bcrypt; hoy la contraseña se valida en el frontend del prototipo.
func (a *app) sesion(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var s struct {
		Correo string `json:"correo"`
		Nombre string `json:"nombre"`
	}
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil || !strings.Contains(s.Correo, "@") {
		fallo(w, 400, "correo requerido")
		return
	}
	s.Correo = strings.ToLower(strings.TrimSpace(s.Correo))
	if s.Nombre == "" {
		s.Nombre = strings.Split(s.Correo, "@")[0]
	}
	var id int64
	var saldo int
	err := pgx.BeginFunc(ctx, a.db, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `
			INSERT INTO usuarios (nombre, correo, hash_contrasena, rol_id) VALUES ($1, $2, 'pendiente-jwt', 1)
			ON CONFLICT (correo) DO UPDATE SET correo = EXCLUDED.correo RETURNING id`, s.Nombre, s.Correo).Scan(&id); err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, `INSERT INTO cuentas_credito (usuario_id, saldo) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, bonoBienvenida)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 1 {
			if _, err := tx.Exec(ctx, `INSERT INTO movimientos_credito (usuario_id, tipo, monto, referencia) VALUES ($1, 'recarga', $2, $3)`,
				id, bonoBienvenida, fmt.Sprintf("bono-bienvenida:%d", id)); err != nil {
				return err
			}
		}
		return tx.QueryRow(ctx, `SELECT saldo FROM cuentas_credito WHERE usuario_id = $1`, id).Scan(&saldo)
	})
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	responder(w, 200, map[string]any{"usuario_id": id, "saldo": saldo})
}

func (a *app) cuenta(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uid := r.PathValue("id")
	var saldo int
	if err := a.db.QueryRow(ctx, `SELECT saldo FROM cuentas_credito WHERE usuario_id = $1`, uid).Scan(&saldo); err != nil {
		fallo(w, 404, "La cuenta no existe.")
		return
	}
	type movimiento struct {
		ID         int64     `json:"id"`
		Tipo       string    `json:"tipo"`
		Monto      int       `json:"monto"`
		Referencia string    `json:"referencia"`
		Fecha      time.Time `json:"fecha"`
	}
	rows, err := a.db.Query(ctx, `SELECT id, tipo, monto, referencia, fecha FROM movimientos_credito WHERE usuario_id = $1 ORDER BY fecha DESC LIMIT 50`, uid)
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	movs, _ := pgx.CollectRows(rows, pgx.RowToStructByPos[movimiento])
	rows, err = a.db.Query(ctx, `SELECT `+columnasBoleto+` WHERE b.usuario_id = $1 ORDER BY b.fecha_venta DESC, b.asiento`, uid)
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	boletos, _ := pgx.CollectRows(rows, pgx.RowToStructByPos[boleto])
	responder(w, 200, map[string]any{"saldo": saldo, "movimientos": movs, "boletos": boletos})
}

// Premio de trivia. El monto lo calcula el servidor a partir de los aciertos (el cliente no decide cuánto cobra)
// y la referencia única de la partida evita acreditarla dos veces (RF-64).
func (a *app) trivia(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var s struct {
		UsuarioID int64  `json:"usuario_id"`
		Partida   string `json:"partida"`
		Aciertos  int    `json:"aciertos"`
	}
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil || s.UsuarioID == 0 || s.Partida == "" || s.Aciertos < 0 || s.Aciertos > preguntasTrivia {
		fallo(w, 400, "Partida inválida.")
		return
	}
	monto := s.Aciertos * creditosPorAcierto
	if s.Aciertos == preguntasTrivia {
		monto = bonoTriviaPerfecta
	}
	acreditado := false
	var saldo int
	err := pgx.BeginFunc(ctx, a.db, func(tx pgx.Tx) error {
		if monto > 0 {
			tag, err := tx.Exec(ctx, `INSERT INTO movimientos_credito (usuario_id, tipo, monto, referencia) VALUES ($1, 'recarga', $2, $3) ON CONFLICT DO NOTHING`,
				s.UsuarioID, monto, "trivia:"+s.Partida)
			if err != nil {
				return err
			}
			if acreditado = tag.RowsAffected() == 1; acreditado {
				if _, err := tx.Exec(ctx, `UPDATE cuentas_credito SET saldo = saldo + $1 WHERE usuario_id = $2`, monto, s.UsuarioID); err != nil {
					return err
				}
			}
		}
		return tx.QueryRow(ctx, `SELECT saldo FROM cuentas_credito WHERE usuario_id = $1`, s.UsuarioID).Scan(&saldo)
	})
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	responder(w, 200, map[string]any{"acreditado": acreditado, "monto": monto, "saldo": saldo})
}

// Validación en el acceso a sala (RF-09, RF-27). El UPDATE condicional es atómico: un boleto no entra dos veces.
func (a *app) validar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tok := r.PathValue("token")
	var b boleto
	var titular string
	err := a.db.QueryRow(ctx, `
		UPDATE boletos b SET estado = 'utilizado' FROM funciones f, usuarios u
		WHERE b.token = $1 AND b.estado = 'valido' AND f.id = b.funcion_id AND u.id = b.usuario_id
		RETURNING b.token, f.codigo, b.asiento, b.precio, b.estado, b.fecha_venta, u.correo`, tok).
		Scan(&b.Token, &b.Funcion, &b.Asiento, &b.Precio, &b.Estado, &b.Fecha, &titular)
	if err == nil {
		a.db.Exec(ctx, `INSERT INTO bitacora_auditoria (accion, entidad, valor_nuevo) VALUES ('VALIDACION_ACCESO', 'boletos', $1)`, map[string]any{"token": tok, "ok": true})
		responder(w, 200, map[string]any{"ok": true, "motivo": "Acceso permitido", "boleto": b, "titular": titular})
		return
	}
	err = a.db.QueryRow(ctx, `SELECT `+strings.Replace(columnasBoleto, "FROM boletos b", ", u.correo FROM boletos b JOIN usuarios u ON u.id = b.usuario_id", 1)+` WHERE b.token = $1`, tok).
		Scan(&b.Token, &b.Funcion, &b.Asiento, &b.Precio, &b.Estado, &b.Fecha, &titular)
	if err != nil {
		responder(w, 200, map[string]any{"ok": false, "motivo": "Boleto inexistente"})
		return
	}
	motivo := "Boleto " + b.Estado
	if b.Estado == "utilizado" {
		motivo = "Boleto ya utilizado"
	}
	responder(w, 200, map[string]any{"ok": false, "motivo": motivo, "boleto": b, "titular": titular})
}

// ---------- Cola virtual (Redis ZSET) ----------

func (a *app) entrarCola(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var s struct {
		UsuarioID int64 `json:"usuario_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil || s.UsuarioID == 0 {
		fallo(w, 400, "usuario_id requerido")
		return
	}
	clave := "cola:" + r.PathValue("evento")
	// NX conserva la posición original si el cliente repite la solicitud (orden de llegada, RF-51).
	a.rdb.ZAddNX(ctx, clave, redis.Z{Score: float64(time.Now().UnixMilli()), Member: s.UsuarioID})
	a.responderPosicion(w, r, clave, strconv.FormatInt(s.UsuarioID, 10))
}

func (a *app) posicionCola(w http.ResponseWriter, r *http.Request) {
	a.responderPosicion(w, r, "cola:"+r.PathValue("evento"), r.PathValue("usuario"))
}

func (a *app) responderPosicion(w http.ResponseWriter, r *http.Request, clave, usuario string) {
	rank, err := a.rdb.ZRank(r.Context(), clave, usuario).Result()
	if err == redis.Nil {
		fallo(w, 404, "No estás en la cola.")
		return
	}
	total, _ := a.rdb.ZCard(r.Context(), clave).Result()
	habilitado := rank < a.capacidad
	espera := 0
	if !habilitado {
		espera = int((rank-a.capacidad)/60) + 1 // ~60 clientes atendidos por minuto
	}
	responder(w, 200, map[string]any{"posicion": rank + 1, "en_cola": total, "turno_habilitado": habilitado, "espera_min": espera})
}

// ---------- Métricas (RF-56) ----------

func (a *app) metricas(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var vendidosHoy, ingresosHoy, triviaOtorgados, canjeados, cuentas int
	a.db.QueryRow(ctx, `SELECT count(*), coalesce(sum(precio), 0) FROM boletos WHERE fecha_venta >= date_trunc('day', now()) AND reserva_id NOT LIKE 'SEED-%'`).
		Scan(&vendidosHoy, &ingresosHoy)
	a.db.QueryRow(ctx, `SELECT coalesce(sum(monto) FILTER (WHERE referencia LIKE 'trivia:%'), 0), coalesce(-sum(monto) FILTER (WHERE tipo = 'debito'), 0) FROM movimientos_credito`).
		Scan(&triviaOtorgados, &canjeados)
	a.db.QueryRow(ctx, `SELECT count(*) FROM usuarios WHERE activo`).Scan(&cuentas)

	type ocupacion struct {
		Codigo   string `json:"codigo"`
		Vendidos int    `json:"vendidos"`
		Aforo    int    `json:"aforo"`
		Ingresos int    `json:"ingresos"`
	}
	rows, err := a.db.Query(ctx, `
		SELECT f.codigo, count(b.id), s.aforo, coalesce(sum(b.precio), 0)
		FROM funciones f JOIN salas s ON s.id = f.sala_id
		LEFT JOIN boletos b ON b.funcion_id = f.id AND b.estado IN ('valido','utilizado')
		WHERE f.fin > now() GROUP BY f.id, s.aforo ORDER BY f.inicio`)
	funciones := []ocupacion{}
	if err == nil {
		funciones, _ = pgx.CollectRows(rows, pgx.RowToStructByPos[ocupacion])
	}

	var retenidos int
	iter := a.rdb.Scan(ctx, 0, "asiento:*", 500).Iterator()
	for iter.Next(ctx) {
		retenidos++
	}
	colas := map[string]int64{}
	iter = a.rdb.Scan(ctx, 0, "cola:*", 100).Iterator()
	for iter.Next(ctx) {
		colas[strings.TrimPrefix(iter.Val(), "cola:")], _ = a.rdb.ZCard(ctx, iter.Val()).Result()
	}
	responder(w, 200, map[string]any{
		"vendidos_hoy": vendidosHoy, "ingresos_hoy": ingresosHoy, "asientos_retenidos": retenidos, "colas": colas,
		"creditos_trivia": triviaOtorgados, "creditos_canjeados": canjeados, "cuentas": cuentas, "funciones": funciones,
	})
}

// ---------- Middleware ----------

// Limitación de solicitudes por IP y minuto (RF-53). Los bloqueos quedan en la bitácora.
func (a *app) rateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		clave := fmt.Sprintf("rl:%s:%d", ip, time.Now().Unix()/60)
		n, err := a.rdb.Incr(r.Context(), clave).Result()
		if err == nil && n == 1 {
			a.rdb.Expire(r.Context(), clave, time.Minute)
		}
		if n > a.limite {
			a.db.Exec(r.Context(), `INSERT INTO bitacora_auditoria (accion, entidad, valor_nuevo) VALUES ('SOLICITUD_BLOQUEADA', 'rate_limit', $1)`,
				map[string]any{"ip": ip, "ruta": r.URL.Path})
			fallo(w, 429, "Demasiadas solicitudes. Espera un momento.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// CORS con lista blanca de orígenes (CORS_ORIGINS, separados por coma). "*" permite cualquiera.
// Las solicitudes de un origen no permitido se atienden sin cabeceras CORS, así que el navegador las bloquea.
func (a *app) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origen := r.Header.Get("Origin")
		w.Header().Add("Vary", "Origin")
		if origen != "" && (a.origenes[origen] || a.origenes["*"]) {
			w.Header().Set("Access-Control-Allow-Origin", origen)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ---------- Utilidades ----------

func responder(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func fallo(w http.ResponseWriter, code int, msg string) { responder(w, code, map[string]string{"error": msg}) }

func token(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return strings.ToUpper(hex.EncodeToString(b))
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(k)); err == nil {
		return n
	}
	return def
}
