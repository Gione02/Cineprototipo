package domain

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Reglas de datos de cuentas. Son las mismas que aplica el frontend (frontend/src/utils/validacion.ts):
// el servidor nunca confía en que el navegador ya validó.

const (
	NombreMax = 60
	CorreoMax = 254
)

var (
	// Letras de cualquier idioma separadas por un espacio, guion o apóstrofo (O'Connor, Pérez-Gómez).
	patronNombre = regexp.MustCompile(`^\p{L}+(?:[ '’-]\p{L}+)*$`)
	// Usuario con letras, números y . _ % + - (sin punto al inicio o al final); dominio con extensión de 2 a 24 letras.
	patronCorreo = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$`)
	espacios     = regexp.MustCompile(`\s+`)
)

// Dominios temporales o reservados para ejemplos: no sirven para recibir boletos ni recuperar la cuenta.
var dominiosNoValidos = map[string]bool{
	"mailinator.com": true, "yopmail.com": true, "10minutemail.com": true, "guerrillamail.com": true, "sharklasers.com": true,
	"tempmail.com": true, "temp-mail.org": true, "trashmail.com": true, "getnada.com": true, "dispostable.com": true,
	"maildrop.cc": true, "throwawaymail.com": true, "fakeinbox.com": true, "mintemail.com": true,
	"example.com": true, "example.org": true, "example.net": true, "test.com": true, "prueba.com": true, "localhost.com": true,
}

// NormalizarNombre quita espacios sobrantes.
func NormalizarNombre(s string) string { return espacios.ReplaceAllString(strings.TrimSpace(s), " ") }

// NormalizarCorreo quita espacios y pasa a minúsculas.
func NormalizarCorreo(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

// ValidarNombre exige sólo letras (con tildes y ñ), sin números ni símbolos, y al menos nombre y apellido.
func ValidarNombre(nombre string) error {
	n := NormalizarNombre(nombre)
	malo := func(msg string) error { return invalidoPor(ErrNombreInvalido, msg) }
	switch {
	case n == "":
		return malo("Escribe tu nombre.")
	case strings.IndexFunc(n, unicode.IsDigit) >= 0:
		return malo("El nombre no puede contener números.")
	case !patronNombre.MatchString(n):
		return malo("Usa sólo letras y espacios (se permiten tildes, ñ, guion y apóstrofo).")
	case utf8.RuneCountInString(n) > NombreMax:
		return malo("El nombre es demasiado largo.")
	}
	palabras := strings.Split(n, " ")
	for _, p := range palabras {
		if utf8.RuneCountInString(strings.NewReplacer("'", "", "’", "", "-", "").Replace(p)) < 2 {
			return malo("Cada nombre o apellido debe tener al menos 2 letras.")
		}
	}
	if len(palabras) < 2 {
		return malo("Escribe tu nombre y apellido.")
	}
	if letrasRepetidas(n, 3) {
		return malo("El nombre tiene letras repetidas de más.")
	}
	return nil
}

// ValidarCorreo comprueba el formato y rechaza dominios temporales o de ejemplo.
// El formato es el "dot-atom" de RFC 5322 (el que usan los proveedores reales), sin las formas obsoletas que el
// RFC también admite —partes entre comillas, comentarios o IP literales— porque no sirven para recibir boletos.
// Todo rechazo cumple errors.Is(err, ErrCorreoInvalido).
func ValidarCorreo(correo string) error {
	c := NormalizarCorreo(correo)
	malo := func(msg string) error { return invalidoPor(ErrCorreoInvalido, msg) }
	switch {
	case c == "":
		return malo("Escribe tu correo electrónico.")
	case len(c) > CorreoMax:
		return malo("El correo es demasiado largo.")
	case strings.Count(c, "@") != 1 || strings.Contains(c, "..") || !patronCorreo.MatchString(c):
		return malo("Correo no válido. Ejemplo: nombre@dominio.com")
	case dominiosNoValidos[c[strings.Index(c, "@")+1:]]:
		return malo("Usa un correo real: no se aceptan correos temporales ni de ejemplo.")
	}
	return nil
}

// letrasRepetidas indica si alguna letra aparece n veces seguidas ("aaa"). RE2 no admite referencias hacia atrás.
func letrasRepetidas(s string, n int) bool {
	var previa rune
	cuenta := 0
	for _, r := range strings.ToLower(s) {
		if r == previa && unicode.IsLetter(r) {
			cuenta++
			if cuenta >= n {
				return true
			}
		} else {
			previa, cuenta = r, 1
		}
	}
	return false
}
