package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/cineight/backend/internal/domain"
	"github.com/cineight/backend/pkg/token"
	"github.com/jackc/pgx/v5"
)

const columnasBoleto = `b.token, f.codigo, b.asiento, b.precio, b.estado, b.fecha_venta, p.slug, s.codigo, f.inicio, f.formato, f.idioma
	FROM boletos b JOIN funciones f ON f.id = b.funcion_id JOIN peliculas p ON p.id = f.pelicula_id JOIN salas s ON s.id = f.sala_id`

// BoletosDeReserva devuelve los boletos emitidos por un pago (vacío si la reserva aún no se pagó).
func (p *Postgres) BoletosDeReserva(ctx context.Context, reservaID string) []domain.Boleto {
	rows, err := p.db.Query(ctx, `SELECT `+columnasBoleto+` WHERE b.reserva_id = $1 ORDER BY b.asiento`, reservaID)
	if err != nil {
		return nil
	}
	lista, _ := pgx.CollectRows(rows, pgx.RowToStructByPos[domain.Boleto])
	return lista
}

// RegistrarVenta debita los créditos y emite los boletos en una sola transacción (RF-63, RNF-37).
// SELECT … FOR UPDATE serializa dos pagos simultáneos del mismo usuario: no hay doble gasto.
// Si una butaca ya tiene boleto, el índice único parcial aborta todo (RNF-36) y se devuelve domain.ErrAsientoVendido.
func (p *Postgres) RegistrarVenta(ctx context.Context, r domain.Reserva) (saldoFinal int, err error) {
	err = pgx.BeginFunc(ctx, p.db, func(tx pgx.Tx) error {
		var saldo, precio int
		if err := tx.QueryRow(ctx, `SELECT saldo FROM cuentas_credito WHERE usuario_id = $1 FOR UPDATE`, r.UsuarioID).Scan(&saldo); err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `SELECT precio FROM funciones WHERE id = $1`, r.FuncionID).Scan(&precio); err != nil {
			return err
		}
		total := precio * len(r.Asientos)
		if saldo < total {
			return domain.ErrSaldoInsuficiente
		}
		saldoFinal = saldo - total
		if _, err := tx.Exec(ctx, `UPDATE cuentas_credito SET saldo = saldo - $1 WHERE usuario_id = $2`, total, r.UsuarioID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO movimientos_credito (usuario_id, tipo, monto, referencia) VALUES ($1, 'debito', $2, $3)`,
			r.UsuarioID, -total, r.ID); err != nil {
			return err
		}
		for _, as := range r.Asientos {
			if _, err := tx.Exec(ctx, `INSERT INTO boletos (token, funcion_id, asiento, usuario_id, precio, reserva_id) VALUES ($1,$2,$3,$4,$5,$6)`,
				"CE-"+token.Nuevo(12), r.FuncionID, as, r.UsuarioID, precio, r.ID); err != nil {
				return err
			}
		}
		_, err := tx.Exec(ctx, `INSERT INTO bitacora_auditoria (usuario_id, accion, entidad, valor_nuevo) VALUES ($1, 'VENTA', 'boletos', $2)`,
			r.UsuarioID, map[string]any{"reserva": r.ID, "asientos": r.Asientos, "total": total})
		return err
	})
	if EsViolacionUnica(err) {
		err = domain.ErrAsientoVendido
	}
	return saldoFinal, err
}

// ValidarBoleto marca un boleto como utilizado. El UPDATE condicional es atómico: un boleto no entra dos veces.
func (p *Postgres) ValidarBoleto(ctx context.Context, tok string) (domain.Validacion, error) {
	var b domain.Boleto
	var titular string
	err := p.db.QueryRow(ctx, `
		UPDATE boletos b SET estado = 'utilizado' FROM funciones f, usuarios u, peliculas p, salas s
		WHERE b.token = $1 AND b.estado = 'valido' AND f.id = b.funcion_id AND u.id = b.usuario_id AND p.id = f.pelicula_id AND s.id = f.sala_id
		RETURNING b.token, f.codigo, b.asiento, b.precio, b.estado, b.fecha_venta, p.slug, s.codigo, f.inicio, f.formato, f.idioma, u.correo`, tok).
		Scan(&b.Token, &b.Funcion, &b.Asiento, &b.Precio, &b.Estado, &b.Fecha, &b.Pelicula, &b.Sala, &b.Inicio, &b.Formato, &b.Idioma, &titular)
	if err == nil {
		return domain.Validacion{OK: true, Motivo: "Acceso permitido", Boleto: &b, Titular: titular}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return domain.Validacion{}, err
	}

	// No se pudo usar: averiguar por qué (inexistente, ya utilizado, anulado…).
	consulta := `SELECT ` + strings.Replace(columnasBoleto, "FROM boletos b", ", u.correo FROM boletos b JOIN usuarios u ON u.id = b.usuario_id", 1) + ` WHERE b.token = $1`
	err = p.db.QueryRow(ctx, consulta, tok).Scan(&b.Token, &b.Funcion, &b.Asiento, &b.Precio, &b.Estado, &b.Fecha, &b.Pelicula, &b.Sala, &b.Inicio, &b.Formato, &b.Idioma, &titular)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Validacion{OK: false, Motivo: "Boleto inexistente"}, nil
	}
	if err != nil {
		return domain.Validacion{}, err
	}
	motivo := "Boleto " + b.Estado
	if b.Estado == "utilizado" {
		motivo = "Boleto ya utilizado"
	}
	return domain.Validacion{OK: false, Motivo: motivo, Boleto: &b, Titular: titular}, nil
}
