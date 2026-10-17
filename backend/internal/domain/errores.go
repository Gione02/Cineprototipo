package domain

import (
	"errors"
	"net/http"
	"time"
)

// Error de negocio con el código HTTP con que debe responderse y un mensaje apto para el usuario.
type Error struct {
	Estado  int
	Mensaje string
}

func (e *Error) Error() string { return e.Mensaje }

// Constructores de errores frecuentes.
func Invalido(msg string) error     { return &Error{http.StatusBadRequest, msg} }
func NoEncontrado(msg string) error { return &Error{http.StatusNotFound, msg} }
func Conflicto(msg string) error    { return &Error{http.StatusConflict, msg} }
func Expirado(msg string) error     { return &Error{http.StatusGone, msg} }
func SinSaldo(msg string) error     { return &Error{http.StatusPaymentRequired, msg} }
func Prohibido(msg string) error    { return &Error{http.StatusForbidden, msg} }
func Demasiadas(msg string) error   { return &Error{http.StatusTooManyRequests, msg} }

// ErrSaldoInsuficiente se usa dentro de la transacción de pago para revertirla.
var ErrSaldoInsuficiente = errors.New("saldo insuficiente")

// ErrAsientoVendido: la venta violó la unicidad de butaca (otro comprador ganó o el pago ya existía).
var ErrAsientoVendido = errors.New("asiento ya vendido")

// ErrTraslape: la función se cruza con otra de la misma sala (incluida la limpieza).
type ErrTraslape struct {
	Sala, Titulo string
	Inicio, Fin  time.Time
}

func (e *ErrTraslape) Error() string {
	return "traslape en " + e.Sala + " con " + e.Titulo
}

// ErrNoExiste indica que un registro buscado no está en el almacenamiento.
var ErrNoExiste = errors.New("no existe")
