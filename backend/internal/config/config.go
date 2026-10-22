// Package config lee la configuración de la API desde variables de entorno.
package config

import (
	"os"
	"strconv"
	"time"
)

// Config agrupa todos los parámetros de arranque. Los valores por defecto sirven para desarrollo local.
type Config struct {
	Puerto        string
	DatabaseURL   string
	RedisAddr     string
	RedisURL      string // redis:// o rediss:// (TLS); si está definida tiene prioridad sobre RedisAddr
	OrigenesCORS  string
	ConfiarProxy  bool          // detrás del proxy de un hosting: la IP del cliente sale de X-Forwarded-For
	RateLimit     int64         // solicitudes por minuto por IP en rutas sensibles (reservas, cola)
	RateLimitAlto int64         // límite para rutas interactivas (bloqueo de butacas, captcha)
	ColaCapacidad int64         // clientes que eligen butacas a la vez desde la cola virtual
	ColaTurno     time.Duration // tiempo de cada turno de la cola virtual
	Retencion     time.Duration // vida del bloqueo de una butaca y de una reserva (RF-07)
	RecaptchaKey  string        // clave secreta de reCAPTCHA v3; vacía = verificación desactivada
	RecaptchaMin  float64       // puntaje mínimo aceptado (0.0–1.0)
}

// Cargar construye la configuración a partir del entorno.
func Cargar() Config {
	return Config{
		Puerto:        texto("PORT", "8080"),
		DatabaseURL:   texto("DATABASE_URL", "postgres://cineight:cineight@localhost:5432/cineight"),
		RedisAddr:     texto("REDIS_ADDR", "localhost:6379"),
		RedisURL:      os.Getenv("REDIS_URL"),
		OrigenesCORS:  texto("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"),
		ConfiarProxy:  os.Getenv("TRUST_PROXY") == "true" || os.Getenv("TRUST_PROXY") == "1",
		RateLimit:     int64(entero("RATE_LIMIT", 5)),
		RateLimitAlto: int64(entero("RATE_LIMIT_INTERACTIVO", 120)),
		// Pocos turnos simultáneos: con un puñado de clientes ya se ve la fila avanzar (para producción, subirlo).
		ColaCapacidad: int64(entero("COLA_CAPACIDAD", 2)),
		ColaTurno:     time.Duration(entero("COLA_TURNO_MINUTOS", 3)) * time.Minute,
		Retencion:     time.Duration(entero("RETENCION_SEGUNDOS", 300)) * time.Second,
		RecaptchaKey:  os.Getenv("RECAPTCHA_SECRET"),
		RecaptchaMin:  decimal("RECAPTCHA_MIN_SCORE", 0.5),
	}
}

func texto(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func entero(k string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(k)); err == nil {
		return n
	}
	return def
}

func decimal(k string, def float64) float64 {
	if n, err := strconv.ParseFloat(os.Getenv(k), 64); err == nil {
		return n
	}
	return def
}
