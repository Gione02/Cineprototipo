package services

import (
	"context"
	"strconv"

	"github.com/cineight/backend/internal/domain"
	"github.com/cineight/backend/pkg/recaptcha"
)

// ───────── Cola virtual (RF-36, RF-51) ─────────

// ColaVirtual atiende a los clientes de un preestreno por orden de llegada.
type ColaVirtual struct {
	colas     Colas
	capacidad int64
}

// NuevaCola crea el servicio. capacidad = clientes atendidos simultáneamente.
func NuevaCola(c Colas, capacidad int64) *ColaVirtual {
	return &ColaVirtual{colas: c, capacidad: capacidad}
}

// Entrar agrega al usuario y devuelve su posición.
func (s *ColaVirtual) Entrar(ctx context.Context, evento string, usuarioID int64) (domain.PosicionCola, error) {
	if usuarioID == 0 {
		return domain.PosicionCola{}, domain.Invalido("usuario_id requerido")
	}
	u := strconv.FormatInt(usuarioID, 10)
	if err := s.colas.EntrarCola(ctx, evento, u); err != nil {
		return domain.PosicionCola{}, err
	}
	return s.Posicion(ctx, evento, u)
}

// Posicion consulta el lugar del usuario en la cola.
func (s *ColaVirtual) Posicion(ctx context.Context, evento, usuario string) (domain.PosicionCola, error) {
	rango, total, ok, err := s.colas.PosicionCola(ctx, evento, usuario)
	if err != nil {
		return domain.PosicionCola{}, err
	}
	if !ok {
		return domain.PosicionCola{}, domain.NoEncontrado("No estás en la cola.")
	}
	p := domain.PosicionCola{Posicion: rango + 1, EnCola: total, TurnoHabilitado: rango < s.capacidad}
	if !p.TurnoHabilitado {
		p.EsperaMin = int((rango-s.capacidad)/60) + 1 // ~60 clientes atendidos por minuto
	}
	return p, nil
}

// ───────── Métricas (RF-56) ─────────

// Panel calcula los indicadores del panel de administración.
type Panel struct {
	cuentas  Cuentas
	candados Candados
	colas    Colas
}

// NuevoPanel crea el servicio.
func NuevoPanel(c Cuentas, k Candados, q Colas) *Panel {
	return &Panel{cuentas: c, candados: k, colas: q}
}

// Metricas combina PostgreSQL (ventas, créditos) y Redis (retenciones, colas).
func (s *Panel) Metricas(ctx context.Context) (domain.Metricas, error) {
	m, err := s.cuentas.Metricas(ctx)
	m.AsientosRetenidos = s.candados.TotalRetenidos(ctx)
	m.Colas = s.colas.Colas(ctx)
	return m, err
}

// ───────── Seguridad (RF-53) ─────────

// Seguridad agrupa el anti-bots: reCAPTCHA v3 y limitación de solicitudes por IP.
type Seguridad struct {
	captcha   *recaptcha.Verificador
	colas     Colas
	auditoria Auditoria
}

// NuevaSeguridad crea el servicio.
func NuevaSeguridad(v *recaptcha.Verificador, c Colas, a Auditoria) *Seguridad {
	return &Seguridad{captcha: v, colas: c, auditoria: a}
}

// AccionesCaptcha son las acciones que el frontend puede declarar al pedir un token.
var AccionesCaptcha = map[string]bool{"login": true, "registro": true, "cola": true}

// VerificarCaptcha confirma un token de reCAPTCHA v3. Los rechazos quedan en la bitácora.
func (s *Seguridad) VerificarCaptcha(ctx context.Context, tok, accion, ip string) (recaptcha.Resultado, error) {
	if !AccionesCaptcha[accion] {
		return recaptcha.Resultado{}, domain.Invalido("Acción de verificación desconocida.")
	}
	r, err := s.captcha.Verificar(ctx, tok, accion, ip)
	if err != nil {
		return r, err
	}
	if !r.Valido {
		s.auditoria.Auditar(ctx, nil, "CAPTCHA_RECHAZADO", "seguridad", map[string]any{"ip": ip, "accion": accion, "motivo": r.Motivo, "puntaje": r.Puntaje})
	}
	return r, nil
}

// Permitir cuenta la solicitud de una IP en un grupo de rutas y dice si sigue bajo el límite por minuto.
// Si Redis falla, la solicitud se permite (fail-open): el límite protege, pero no debe tumbar la venta.
func (s *Seguridad) Permitir(ctx context.Context, grupo, ip, ruta string, limite int64) bool {
	n, err := s.colas.Contar(ctx, grupo, ip)
	if err != nil || n <= limite {
		return true
	}
	if n == limite+1 { // sólo el primer bloqueo del minuto va a la bitácora
		s.auditoria.Auditar(ctx, nil, "SOLICITUD_BLOQUEADA", "rate_limit", map[string]any{"ip": ip, "ruta": ruta})
	}
	return false
}
