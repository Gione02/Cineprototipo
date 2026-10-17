// Package token genera identificadores aleatorios criptográficamente seguros.
package token

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
)

// Nuevo devuelve n bytes aleatorios en hexadecimal en mayúsculas (2n caracteres).
func Nuevo(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return strings.ToUpper(hex.EncodeToString(b))
}
