// Package repository es la capa de acceso a datos: PostgreSQL (fuente de verdad de ventas y créditos)
// y Redis (estado efímero: bloqueos de butacas, reservas, cola virtual, rate limiting y Pub/Sub).
// Aquí no hay reglas de negocio: sólo consultas. Las decisiones viven en internal/services.
package repository

import (
	"context"
	"errors"
	"strconv"

	"github.com/cineight/backend/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Postgres agrupa las consultas a la base de datos relacional.
type Postgres struct {
	db *pgxpool.Pool
}

// NuevoPostgres crea el repositorio sobre un pool de conexiones.
func NuevoPostgres(db *pgxpool.Pool) *Postgres { return &Postgres{db: db} }

// EsViolacionUnica indica si err proviene de una restricción UNIQUE (código 23505).
func EsViolacionUnica(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// ───────── Catálogo ─────────

// Funciones devuelve la cartelera vigente con las butacas disponibles de cada función.
func (p *Postgres) Funciones(ctx context.Context) ([]domain.Funcion, error) {
	rows, err := p.db.Query(ctx, `
		SELECT f.id, f.codigo, p.slug, p.titulo, s.codigo, s.nombre, f.inicio, f.fin, f.formato, f.idioma, f.precio, f.evento,
		       s.aforo - (SELECT count(*) FROM boletos b WHERE b.funcion_id = f.id AND b.estado IN ('valido','utilizado'))
		FROM funciones f JOIN peliculas p ON p.id = f.pelicula_id JOIN salas s ON s.id = f.sala_id
		WHERE f.fin > now() AND f.estado = 'programada' ORDER BY f.inicio`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.Funcion, error) {
		var f domain.Funcion
		err := row.Scan(&f.ID, &f.Codigo, &f.Pelicula, &f.Titulo, &f.Sala, &f.SalaNombre, &f.Inicio, &f.Fin, &f.Formato, &f.Idioma, &f.Precio, &f.Evento, &f.Disponibles)
		return f, err
	})
}

// FuncionID acepta el código público (f1) o el id numérico.
func (p *Postgres) FuncionID(ctx context.Context, ref string) (int, error) {
	if n, err := strconv.Atoi(ref); err == nil {
		var id int
		if err := p.db.QueryRow(ctx, `SELECT id FROM funciones WHERE id = $1`, n).Scan(&id); err != nil {
			return 0, domain.ErrNoExiste
		}
		return id, nil
	}
	var id int
	if err := p.db.QueryRow(ctx, `SELECT id FROM funciones WHERE codigo = $1`, ref).Scan(&id); err != nil {
		return 0, domain.ErrNoExiste
	}
	return id, nil
}

// CodigoFuncion devuelve el código público de una función.
func (p *Postgres) CodigoFuncion(ctx context.Context, id int) (string, error) {
	var codigo string
	err := p.db.QueryRow(ctx, `SELECT codigo FROM funciones WHERE id = $1`, id).Scan(&codigo)
	return codigo, err
}

// AsientosVendidos lista las butacas con boleto válido o utilizado.
func (p *Postgres) AsientosVendidos(ctx context.Context, funcionID int) ([]string, error) {
	rows, err := p.db.Query(ctx, `SELECT asiento FROM boletos WHERE funcion_id = $1 AND estado IN ('valido','utilizado')`, funcionID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// VendidosVigentes devuelve las butacas vendidas de todas las funciones vigentes, por código público,
// en una sola consulta (el panel la usa en lugar de pedir función por función).
func (p *Postgres) VendidosVigentes(ctx context.Context) (codigos map[int]string, vendidos map[int][]string, err error) {
	rows, err := p.db.Query(ctx, `
		SELECT f.id, f.codigo, coalesce(array_agg(b.asiento) FILTER (WHERE b.id IS NOT NULL), '{}')
		FROM funciones f
		LEFT JOIN boletos b ON b.funcion_id = f.id AND b.estado IN ('valido','utilizado')
		WHERE f.fin > now() GROUP BY f.id`)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	codigos, vendidos = map[int]string{}, map[int][]string{}
	for rows.Next() {
		var id int
		var codigo string
		var asientos []string
		if err := rows.Scan(&id, &codigo, &asientos); err != nil {
			return nil, nil, err
		}
		codigos[id], vendidos[id] = codigo, asientos
	}
	return codigos, vendidos, rows.Err()
}

// ContextoReserva reúne lo necesario para validar una reserva: si la función es un preestreno,
// cuántas de las butacas pedidas ya se vendieron y cuántos boletos tiene ya el usuario.
func (p *Postgres) ContextoReserva(ctx context.Context, funcionID int, asientos []string, usuarioID int64) (evento *string, vendidos, propios int, err error) {
	err = p.db.QueryRow(ctx, `
		SELECT f.evento,
		       (SELECT count(*) FROM boletos b WHERE b.funcion_id = f.id AND b.asiento = ANY($2) AND b.estado IN ('valido','utilizado')),
		       (SELECT count(*) FROM boletos b WHERE b.funcion_id = f.id AND b.usuario_id = $3 AND b.estado IN ('valido','utilizado'))
		FROM funciones f WHERE f.id = $1`, funcionID, asientos, usuarioID).Scan(&evento, &vendidos, &propios)
	if errors.Is(err, pgx.ErrNoRows) {
		err = domain.ErrNoExiste
	}
	return
}

// ───────── Bitácora ─────────

// Auditar registra una operación crítica (RNF-22). Los fallos se ignoran: la bitácora no debe tumbar la operación.
func (p *Postgres) Auditar(ctx context.Context, usuarioID *int64, accion, entidad string, valor any) {
	_, _ = p.db.Exec(ctx, `INSERT INTO bitacora_auditoria (usuario_id, accion, entidad, valor_nuevo) VALUES ($1, $2, $3, $4)`,
		usuarioID, accion, entidad, valor)
}
