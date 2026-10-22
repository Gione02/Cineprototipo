package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/cineight/backend/pkg/httpx"
)

// GET /api/funciones
func (a *API) listarFunciones(w http.ResponseWriter, r *http.Request) {
	lista, err := a.s.Catalogo.Funciones(r.Context())
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, lista)
}

// GET /api/funciones/{id}/asientos[?usuario=ID] → {vendidos, retenidos, propios}
func (a *API) ocupacion(w http.ResponseWriter, r *http.Request) {
	fid, err := a.s.Asientos.Resolver(r.Context(), r.PathValue("id"))
	if err != nil {
		fallar(w, err)
		return
	}
	o, err := a.s.Asientos.Ocupacion(r.Context(), fid)
	if err != nil {
		fallar(w, err)
		return
	}
	// ?usuario=ID: incluye qué butacas retenidas son del propio usuario (para restaurar su selección).
	if uid, err := strconv.ParseInt(r.URL.Query().Get("usuario"), 10, 64); err == nil && uid > 0 {
		o.Propios = a.s.Asientos.BloqueosDe(r.Context(), fid, uid)
	}
	httpx.JSON(w, 200, o)
}

// GET /api/ocupacion → {f1: {vendidos, retenidos}, …} de todas las funciones vigentes en una respuesta.
func (a *API) ocupacionVigente(w http.ResponseWriter, r *http.Request) {
	o, err := a.s.Asientos.OcupacionVigente(r.Context())
	if err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, o)
}

type solicitudBloqueo struct {
	UsuarioID int64    `json:"usuario_id"`
	Asientos  []string `json:"asientos"`
}

// POST /api/funciones/{id}/asientos/{asiento}/bloqueo  {usuario_id}
// Candado atómico de la butaca durante la retención (SET NX EX).
func (a *API) bloquear(w http.ResponseWriter, r *http.Request) {
	var s solicitudBloqueo
	if err := httpx.Leer(r, &s); err != nil {
		httpx.Error(w, 400, "usuario_id requerido")
		return
	}
	if err := a.s.Asientos.Bloquear(r.Context(), r.PathValue("id"), r.PathValue("asiento"), s.UsuarioID); err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 201, map[string]any{"asiento": r.PathValue("asiento"), "estado": "bloqueado"})
}

// DELETE /api/funciones/{id}/bloqueos  {usuario_id, asientos}
// Suelta butacas que el usuario bloqueó (deseleccionar, salir de la página).
func (a *API) desbloquear(w http.ResponseWriter, r *http.Request) {
	var s solicitudBloqueo
	if err := httpx.Leer(r, &s); err != nil {
		httpx.Error(w, 400, "Solicitud inválida.")
		return
	}
	if err := a.s.Asientos.Desbloquear(r.Context(), r.PathValue("id"), s.Asientos, s.UsuarioID); err != nil {
		fallar(w, err)
		return
	}
	httpx.JSON(w, 200, map[string]string{"estado": "liberado"})
}

// GET /api/funciones/{id}/stream — Server-Sent Events.
//
// Al conectar envía un evento "estado" con la ocupación completa y después un evento "asientos"
// por cada cambio (bloqueado, liberado, vendido) publicado en Redis por cualquier instancia de la API.
// Cada 20 s reenvía la foto completa: mantiene viva la conexión a través de proxies y refleja los bloqueos vencidos
// aun en servicios de Redis administrados que no permiten activar las notificaciones de expiración.
func (a *API) stream(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.Error(w, 500, "El servidor no admite streaming.")
		return
	}
	fid, err := a.s.Asientos.Resolver(ctx, r.PathValue("id"))
	if err != nil {
		fallar(w, err)
		return
	}
	// Suscribirse antes de leer la ocupación: así ningún cambio cae entre la foto inicial y el stream.
	sub, err := a.s.Asientos.Suscribir(ctx, fid)
	if err != nil {
		fallar(w, err)
		return
	}
	defer sub.Close()
	inicial, err := a.s.Asientos.Ocupacion(ctx, fid)
	if err != nil {
		fallar(w, err)
		return
	}

	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache, no-transform")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no") // nginx: no acumular eventos
	w.WriteHeader(http.StatusOK)

	datos, _ := json.Marshal(inicial)
	fmt.Fprintf(w, "retry: 3000\nevent: estado\ndata: %s\n\n", datos)
	flusher.Flush()

	mensajes := sub.Channel()
	latido := time.NewTicker(20 * time.Second)
	defer latido.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-latido.C:
			if o, err := a.s.Asientos.Ocupacion(ctx, fid); err == nil {
				datos, _ := json.Marshal(o)
				fmt.Fprintf(w, "event: estado\ndata: %s\n\n", datos)
			} else {
				fmt.Fprint(w, ": ping\n\n")
			}
			flusher.Flush()
		case msg, ok := <-mensajes:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: asientos\ndata: %s\n\n", msg.Payload)
			flusher.Flush()
		}
	}
}
