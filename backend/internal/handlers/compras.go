package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/cineight/backend/internal/domain"
	"github.com/cineight/backend/internal/services"
	"github.com/cineight/backend/pkg/httpx"
)

// ───────── Reservas y pago ─────────

// POST /api/reservas  {funcion, usuario_id, asientos} → retención de 5 min
func (a *API) crearReserva(w http.ResponseWriter, r *http.Request) {
	var s services.SolicitudReserva
	if err := httpx.Leer(r, &s); err != nil {
		httpx.Error(w, 400, fmt.Sprintf("Solicitud inválida: entre 1 y %d asientos y usuario_id requeridos.", domain.MaxAsientosPorCompra))
		return
	}
	id, expira, err := a.s.Reservas.Crear(r.Context(), s)
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 201, map[string]any{"reserva_id": id, "expira": expira})
}

// POST /api/reservas/{id}/pagar — idempotente
func (a *API) pagar(w http.ResponseWriter, r *http.Request) {
	res, estado, err := a.s.Reservas.Pagar(r.Context(), r.PathValue("id"))
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, estado, res)
}

// DELETE /api/reservas/{id}
func (a *API) cancelarReserva(w http.ResponseWriter, r *http.Request) {
	if err := a.s.Reservas.Cancelar(r.Context(), r.PathValue("id")); err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, map[string]string{"estado": "cancelada"})
}

// ───────── Cuentas y créditos ─────────

// POST /api/sesion  {correo, nombre} → {usuario_id, saldo}
func (a *API) sesion(w http.ResponseWriter, r *http.Request) {
	var s struct {
		Correo string `json:"correo"`
		Nombre string `json:"nombre"`
	}
	if err := httpx.Leer(r, &s); err != nil {
		httpx.Error(w, 400, "correo requerido")
		return
	}
	id, saldo, err := a.s.Cuentas.Sesion(r.Context(), s.Correo, s.Nombre)
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, map[string]any{"usuario_id": id, "saldo": saldo})
}

// GET /api/usuarios/{id}/cuenta
func (a *API) cuenta(w http.ResponseWriter, r *http.Request) {
	uid, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		httpx.Error(w, 404, "La cuenta no existe.")
		return
	}
	c, err := a.s.Cuentas.Cuenta(r.Context(), uid)
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, c)
}

// POST /api/creditos/trivia  {usuario_id, partida, aciertos}
func (a *API) trivia(w http.ResponseWriter, r *http.Request) {
	var s struct {
		UsuarioID int64  `json:"usuario_id"`
		Partida   string `json:"partida"`
		Aciertos  int    `json:"aciertos"`
	}
	if err := httpx.Leer(r, &s); err != nil {
		httpx.Error(w, 400, "Partida inválida.")
		return
	}
	acreditado, monto, saldo, err := a.s.Cuentas.Trivia(r.Context(), s.UsuarioID, s.Partida, s.Aciertos)
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, map[string]any{"acreditado": acreditado, "monto": monto, "saldo": saldo})
}

// ───────── Operación ─────────

// POST /api/boletos/{token}/validar
func (a *API) validarBoleto(w http.ResponseWriter, r *http.Request) {
	v, err := a.s.Cuentas.ValidarBoleto(r.Context(), r.PathValue("token"))
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, v)
}

// POST /api/cola/{evento}  {usuario_id}
func (a *API) entrarCola(w http.ResponseWriter, r *http.Request) {
	var s struct {
		UsuarioID int64 `json:"usuario_id"`
	}
	if err := httpx.Leer(r, &s); err != nil {
		httpx.Error(w, 400, "usuario_id requerido")
		return
	}
	p, err := a.s.Cola.Entrar(r.Context(), r.PathValue("evento"), s.UsuarioID)
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, p)
}

// GET /api/cola/{evento}/{usuario}
func (a *API) posicionCola(w http.ResponseWriter, r *http.Request) {
	p, err := a.s.Cola.Posicion(r.Context(), r.PathValue("evento"), r.PathValue("usuario"))
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, p)
}

// GET /api/metricas
func (a *API) metricas(w http.ResponseWriter, r *http.Request) {
	m, err := a.s.Panel.Metricas(r.Context())
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, m)
}

// ───────── Seguridad ─────────

// POST /api/captcha/verificar  {token, accion} → {valido, puntaje, accion, motivo, activo}
// El frontend lo llama antes de procesar las credenciales de inicio de sesión o registro.
func (a *API) verificarCaptcha(w http.ResponseWriter, r *http.Request) {
	var s struct {
		Token  string `json:"token"`
		Accion string `json:"accion"`
	}
	if err := httpx.Leer(r, &s); err != nil {
		httpx.Error(w, 400, "Solicitud inválida.")
		return
	}
	res, err := a.s.Seguridad.VerificarCaptcha(r.Context(), s.Token, s.Accion, httpx.IP(r))
	if err != nil {
		fallar(w, err)
		return
	}
	estado := http.StatusOK
	if !res.Valido {
		estado = http.StatusForbidden
	}
	httpx.JSON(w, estado, res)
}
