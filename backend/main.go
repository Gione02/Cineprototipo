// API de Cineight (prototipo). Demuestra las piezas críticas de la ERS:
//   - Retención de asientos 5 min con SET NX + TTL en Redis (RF-07, RF-54)
//   - Pago con créditos en una transacción ACID con SELECT ... FOR UPDATE (RF-63, RNF-37)
//   - Índice único parcial en boletos como última barrera contra la sobreventa (RNF-36)
//   - Idempotencia del pago (RF-23), cola virtual con ZSET (RF-36, RF-51) y rate limiting (RF-53)
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
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

const retencion = 5 * time.Minute

type app struct {
	db         *pgxpool.Pool
	rdb        *redis.Client
	limite     int64 // solicitudes por minuto por IP
	capacidad  int64 // clientes atendidos simultáneamente desde la cola
	corsOrigin string
}

func main() {
	ctx := context.Background()
	db, err := pgxpool.New(ctx, env("DATABASE_URL", "postgres://cineight:cineight@localhost:5432/cineight"))
	if err != nil {
		log.Fatal(err)
	}
	a := &app{
		db:         db,
		rdb:        redis.NewClient(&redis.Options{Addr: env("REDIS_ADDR", "localhost:6379")}),
		limite:     int64(envInt("RATE_LIMIT", 5)),
		capacidad:  int64(envInt("COLA_CAPACIDAD", 100)),
		corsOrigin: env("CORS_ORIGIN", "*"),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/salud", func(w http.ResponseWriter, r *http.Request) { responder(w, 200, map[string]string{"estado": "ok"}) })
	mux.HandleFunc("GET /api/funciones", a.listarFunciones)
	mux.HandleFunc("GET /api/funciones/{id}/asientos", a.asientos)
	mux.Handle("POST /api/reservas", a.rateLimit(http.HandlerFunc(a.crearReserva)))
	mux.HandleFunc("POST /api/reservas/{id}/pagar", a.pagar)
	mux.HandleFunc("DELETE /api/reservas/{id}", a.cancelar)
	mux.Handle("POST /api/cola/{evento}", a.rateLimit(http.HandlerFunc(a.entrarCola)))
	mux.HandleFunc("GET /api/cola/{evento}/{usuario}", a.posicionCola)
	mux.HandleFunc("GET /api/metricas", a.metricas)

	addr := ":" + env("PORT", "8080")
	log.Printf("Cineight API escuchando en %s", addr)
	log.Fatal(http.ListenAndServe(addr, a.cors(mux)))
}

// ---------- Catálogo ----------

func (a *app) listarFunciones(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `
		SELECT f.id, p.titulo, s.nombre, f.inicio, f.fin, f.formato, f.precio,
		       s.aforo - (SELECT count(*) FROM boletos b WHERE b.funcion_id = f.id AND b.estado IN ('valido','utilizado'))
		FROM funciones f JOIN peliculas p ON p.id = f.pelicula_id JOIN salas s ON s.id = f.sala_id
		WHERE f.inicio > now() AND f.estado = 'programada' ORDER BY f.inicio`)
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	type funcion struct {
		ID         int       `json:"id"`
		Pelicula   string    `json:"pelicula"`
		Sala       string    `json:"sala"`
		Inicio     time.Time `json:"inicio"`
		Fin        time.Time `json:"fin"`
		Formato    string    `json:"formato"`
		Precio     int       `json:"precio"`
		Disponible int       `json:"disponibles"`
	}
	lista, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (funcion, error) {
		var f funcion
		err := row.Scan(&f.ID, &f.Pelicula, &f.Sala, &f.Inicio, &f.Fin, &f.Formato, &f.Precio, &f.Disponible)
		return f, err
	})
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	responder(w, 200, lista)
}

// Estado de cada butaca: vendidas en PostgreSQL + retenidas (claves vivas en Redis).
func (a *app) asientos(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	fid := r.PathValue("id")
	vendidos := []string{}
	rows, err := a.db.Query(ctx, `SELECT asiento FROM boletos WHERE funcion_id = $1 AND estado IN ('valido','utilizado')`, fid)
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	vendidos, err = pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		fallo(w, 500, err.Error())
		return
	}
	retenidos := []string{}
	iter := a.rdb.Scan(ctx, 0, "asiento:"+fid+":*", 200).Iterator()
	for iter.Next(ctx) {
		retenidos = append(retenidos, strings.TrimPrefix(iter.Val(), "asiento:"+fid+":"))
	}
	responder(w, 200, map[string]any{"vendidos": vendidos, "retenidos": retenidos})
}

// ---------- Reservas (Redis) ----------

type solicitudReserva struct {
	FuncionID int      `json:"funcion_id"`
	UsuarioID int64    `json:"usuario_id"`
	Asientos  []string `json:"asientos"`
}

func (a *app) crearReserva(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var s solicitudReserva
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil || len(s.Asientos) == 0 || len(s.Asientos) > 6 || s.UsuarioID == 0 {
		fallo(w, 400, "Solicitud inválida: entre 1 y 6 asientos y usuario_id requeridos.")
		return
	}
	var vendidos int
	if err := a.db.QueryRow(ctx, `SELECT count(*) FROM boletos WHERE funcion_id = $1 AND asiento = ANY($2) AND estado IN ('valido','utilizado')`,
		s.FuncionID, s.Asientos).Scan(&vendidos); err != nil {
		fallo(w, 500, err.Error())
		return
	}
	if vendidos > 0 {
		fallo(w, 409, "Alguno de los asientos ya fue vendido.")
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
	responder(w, 201, map[string]any{"reserva_id": id, "boletos": a.boletosDeReserva(ctx, id)})
}

type boleto struct {
	Token   string `json:"token"`
	Asiento string `json:"asiento"`
	Estado  string `json:"estado"`
}

func (a *app) boletosDeReserva(ctx context.Context, id string) []boleto {
	rows, err := a.db.Query(ctx, `SELECT token, asiento, estado FROM boletos WHERE reserva_id = $1 ORDER BY asiento`, id)
	if err != nil {
		return nil
	}
	lista, _ := pgx.CollectRows(rows, pgx.RowToStructByPos[boleto])
	return lista
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
		espera = int((rank - a.capacidad) / 60) + 1 // ~60 clientes atendidos por minuto
	}
	responder(w, 200, map[string]any{"posicion": rank + 1, "en_cola": total, "turno_habilitado": habilitado, "espera_min": espera})
}

// ---------- Métricas (RF-56) ----------

func (a *app) metricas(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var vendidos int
	a.db.QueryRow(ctx, `SELECT count(*) FROM boletos WHERE fecha_venta::date = current_date`).Scan(&vendidos)
	var retenidos int
	iter := a.rdb.Scan(ctx, 0, "asiento:*", 500).Iterator()
	for iter.Next(ctx) {
		retenidos++
	}
	colas := map[string]int64{}
	iter = a.rdb.Scan(ctx, 0, "cola:*", 100).Iterator()
	for iter.Next(ctx) {
		colas[iter.Val()], _ = a.rdb.ZCard(ctx, iter.Val()).Result()
	}
	responder(w, 200, map[string]any{"vendidos_hoy": vendidos, "asientos_retenidos": retenidos, "colas": colas})
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

func (a *app) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", a.corsOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
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
