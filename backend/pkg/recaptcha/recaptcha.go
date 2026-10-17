// Package recaptcha verifica tokens de Google reCAPTCHA v3 (invisible, basado en puntaje).
//
// El navegador obtiene un token con grecaptcha.execute(clave, {action}) y el backend lo confirma
// contra https://www.google.com/recaptcha/api/siteverify antes de procesar las credenciales.
// Sin clave secreta configurada el verificador queda desactivado y aprueba todo (entorno local).
package recaptcha

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const urlVerificacion = "https://www.google.com/recaptcha/api/siteverify"

// Verificador consulta la API de Google. Es seguro para uso concurrente.
type Verificador struct {
	secreto string
	minimo  float64
	cliente *http.Client
}

// Resultado de una verificación.
type Resultado struct {
	Valido  bool    `json:"valido"`
	Puntaje float64 `json:"puntaje"`
	Accion  string  `json:"accion,omitempty"`
	Motivo  string  `json:"motivo,omitempty"`
	Activo  bool    `json:"activo"` // false: verificación desactivada (sin RECAPTCHA_SECRET)
}

// Nuevo crea un verificador. minimo es el puntaje mínimo aceptado (0.0 = bot, 1.0 = humano; Google sugiere 0.5).
func Nuevo(secreto string, minimo float64) *Verificador {
	return &Verificador{secreto: secreto, minimo: minimo, cliente: &http.Client{Timeout: 5 * time.Second}}
}

// Activo indica si hay clave secreta configurada.
func (v *Verificador) Activo() bool { return v.secreto != "" }

type respuestaGoogle struct {
	Success     bool     `json:"success"`
	Score       float64  `json:"score"`
	Action      string   `json:"action"`
	Hostname    string   `json:"hostname"`
	ErrorCodes  []string `json:"error-codes"`
	ChallengeTS string   `json:"challenge_ts"`
}

// Verificar confirma que el token sea válido, corresponda a la acción esperada y supere el puntaje mínimo.
func (v *Verificador) Verificar(ctx context.Context, tokenCliente, accion, ip string) (Resultado, error) {
	if !v.Activo() {
		return Resultado{Valido: true, Puntaje: 1, Accion: accion, Motivo: "verificación desactivada", Activo: false}, nil
	}
	if tokenCliente == "" {
		return Resultado{Activo: true, Motivo: "token ausente"}, nil
	}
	form := url.Values{"secret": {v.secreto}, "response": {tokenCliente}}
	if ip != "" {
		form.Set("remoteip", ip)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, urlVerificacion, strings.NewReader(form.Encode()))
	if err != nil {
		return Resultado{Activo: true}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := v.cliente.Do(req)
	if err != nil {
		return Resultado{Activo: true}, fmt.Errorf("recaptcha: %w", err)
	}
	defer res.Body.Close()
	var g respuestaGoogle
	if err := json.NewDecoder(res.Body).Decode(&g); err != nil {
		return Resultado{Activo: true}, fmt.Errorf("recaptcha: respuesta inválida: %w", err)
	}

	r := Resultado{Puntaje: g.Score, Accion: g.Action, Activo: true}
	switch {
	case !g.Success:
		r.Motivo = "token rechazado: " + strings.Join(g.ErrorCodes, ", ")
	case accion != "" && g.Action != accion:
		r.Motivo = "acción inesperada: " + g.Action
	case g.Score < v.minimo:
		r.Motivo = fmt.Sprintf("puntaje bajo (%.1f)", g.Score)
	default:
		r.Valido = true
	}
	return r, nil
}
