package domain

import (
	"errors"
	"net/http"
	"testing"
)

func TestValidarNombre(t *testing.T) {
	validos := []string{"Ana López", "José María Pérez-Gómez", "Seán O'Connor", "  luis   pérez ", "Nuñez Ibáñez"}
	for _, n := range validos {
		if err := ValidarNombre(n); err != nil {
			t.Errorf("%q debería ser válido: %v", n, err)
		}
	}
	invalidos := []string{"", "Ana", "Ana L0pez", "Ana López 2", "Ana_López", "Ana @López", "Ana  -López", "Aaaana López", "A López", "Ana.López", "<script>"}
	for _, n := range invalidos {
		err := ValidarNombre(n)
		if err == nil {
			t.Errorf("%q debería ser inválido", n)
			continue
		}
		if !errors.Is(err, ErrNombreInvalido) {
			t.Errorf("%q: el error debería ser ErrNombreInvalido, fue %v", n, err)
		}
	}
}

// Los rechazos de correo se reconocen con errors.Is y siguen respondiendo 400 con un mensaje para el usuario.
func TestValidarCorreoDevuelveErrorEstructurado(t *testing.T) {
	err := ValidarCorreo("ana@@correo.com")
	if !errors.Is(err, ErrCorreoInvalido) {
		t.Fatalf("se esperaba ErrCorreoInvalido, fue %v", err)
	}
	var e *Error
	if !errors.As(err, &e) || e.Estado != http.StatusBadRequest || e.Mensaje == "" {
		t.Fatalf("se esperaba un error de dominio 400 con mensaje, fue %#v", err)
	}
}

func TestValidarCorreo(t *testing.T) {
	validos := []string{"ana.lopez@correo.com", "Luis.Perez+cine@gmail.com", "agente@cineight.gt", "a_b-c@sub.dominio.com.gt"}
	for _, c := range validos {
		if err := ValidarCorreo(c); err != nil {
			t.Errorf("%q debería ser válido: %v", c, err)
		}
	}
	invalidos := []string{"", "ana", "ana@", "@correo.com", "ana@correo", "ana@@correo.com", "ana..lopez@correo.com", ".ana@correo.com",
		"ana@correo.c", "ana lopez@correo.com", "ana@correo.123", "ana@-correo.com", "ana@mailinator.com", "ana@example.com"}
	for _, c := range invalidos {
		if err := ValidarCorreo(c); !errors.Is(err, ErrCorreoInvalido) {
			t.Errorf("%q debería ser inválido (ErrCorreoInvalido), fue %v", c, err)
		}
	}
}
