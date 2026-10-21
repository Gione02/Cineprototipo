package services

import (
	"context"
	"errors"

	"github.com/cineight/backend/internal/domain"
)

// CuentasClientes vincula clientes con su cuenta de créditos, acredita la trivia y valida boletos.
type CuentasClientes struct {
	cuentas   Cuentas
	ventas    Ventas
	auditoria Auditoria
}

// NuevoCuentas crea el servicio.
func NuevoCuentas(c Cuentas, v Ventas, a Auditoria) *CuentasClientes {
	return &CuentasClientes{cuentas: c, ventas: v, auditoria: a}
}

// Sesion vincula al cliente que inició sesión en el frontend con su cuenta en PostgreSQL
// (la crea con el bono de bienvenida). Pendiente: autenticación real con JWT + bcrypt.
func (s *CuentasClientes) Sesion(ctx context.Context, correo, nombre string) (int64, int, error) {
	correo = domain.NormalizarCorreo(correo)
	if err := domain.ValidarCorreo(correo); err != nil {
		return 0, 0, err
	}
	nombre = domain.NormalizarNombre(nombre)
	if err := domain.ValidarNombre(nombre); err != nil {
		return 0, 0, err
	}
	return s.cuentas.VincularCliente(ctx, correo, nombre)
}

// Cuenta devuelve saldo, movimientos y boletos.
func (s *CuentasClientes) Cuenta(ctx context.Context, usuarioID int64) (domain.Cuenta, error) {
	c, err := s.cuentas.Cuenta(ctx, usuarioID)
	if errors.Is(err, domain.ErrNoExiste) {
		return c, domain.NoEncontrado("La cuenta no existe.")
	}
	return c, err
}

// Trivia acredita el premio de una partida. El monto lo calcula el servidor a partir de los aciertos
// (el cliente no decide cuánto cobra) y la referencia única evita acreditarla dos veces (RF-64).
func (s *CuentasClientes) Trivia(ctx context.Context, usuarioID int64, partida string, aciertos int) (acreditado bool, monto, saldo int, err error) {
	if usuarioID == 0 || partida == "" || aciertos < 0 || aciertos > domain.PreguntasTrivia {
		return false, 0, 0, domain.Invalido("Partida inválida.")
	}
	monto = aciertos * domain.CreditosPorAcierto
	if aciertos == domain.PreguntasTrivia {
		monto = domain.BonoTriviaPerfecta
	}
	acreditado, saldo, err = s.cuentas.AcreditarTrivia(ctx, usuarioID, partida, monto)
	return
}

// ValidarBoleto registra el intento en la bitácora (RF-09, RF-27).
func (s *CuentasClientes) ValidarBoleto(ctx context.Context, tok string) (domain.Validacion, error) {
	v, err := s.ventas.ValidarBoleto(ctx, tok)
	if err == nil {
		s.auditoria.Auditar(ctx, nil, "VALIDACION_ACCESO", "boletos", map[string]any{"token": tok, "ok": v.OK})
	}
	return v, err
}
