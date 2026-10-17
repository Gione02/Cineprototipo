// Package httpx reúne utilidades HTTP sin lógica de negocio: respuestas JSON, errores y CORS.
package httpx

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
)

// JSON escribe v como JSON con el código de estado indicado.
func JSON(w http.ResponseWriter, estado int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(estado)
	_ = json.NewEncoder(w).Encode(v)
}

// Error responde {"error": mensaje}, el formato que espera el frontend.
func Error(w http.ResponseWriter, estado int, mensaje string) {
	JSON(w, estado, map[string]string{"error": mensaje})
}

// Leer decodifica el cuerpo JSON de la solicitud en destino (máximo 64 KB).
func Leer(r *http.Request, destino any) error {
	return LeerHasta(r, destino, 64<<10)
}

// LeerHasta decodifica el cuerpo JSON con un límite de tamaño propio (p. ej. solicitudes con imágenes).
func LeerHasta(r *http.Request, destino any, maxBytes int64) error {
	return json.NewDecoder(http.MaxBytesReader(nil, r.Body, maxBytes)).Decode(destino)
}

// IP devuelve la dirección del cliente (sin puerto).
func IP(r *http.Request) string {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// CORS aplica una lista blanca de orígenes ("*" permite cualquiera).
// Las solicitudes de un origen no permitido se atienden sin cabeceras CORS, así que el navegador las bloquea.
func CORS(origenes map[string]bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origen := r.Header.Get("Origin")
		w.Header().Add("Vary", "Origin")
		if origen != "" && (origenes[origen] || origenes["*"]) {
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

// ListaOrigenes convierte "a,b,c" en un conjunto.
func ListaOrigenes(csv string) map[string]bool {
	out := map[string]bool{}
	for _, o := range strings.Split(csv, ",") {
		if o = strings.TrimSpace(o); o != "" {
			out[o] = true
		}
	}
	return out
}
