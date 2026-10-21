package domain

import "testing"

func TestValidarNombre(t *testing.T) {
	validos := []string{"Ana López", "José María Pérez-Gómez", "Seán O'Connor", "  luis   pérez ", "Nuñez Ibáñez"}
	for _, n := range validos {
		if err := ValidarNombre(n); err != nil {
			t.Errorf("%q debería ser válido: %v", n, err)
		}
	}
	invalidos := []string{"", "Ana", "Ana L0pez", "Ana López 2", "Ana_López", "Ana @López", "Ana  -López", "Aaaana López", "A López", "Ana.López", "<script>"}
	for _, n := range invalidos {
		if ValidarNombre(n) == nil {
			t.Errorf("%q debería ser inválido", n)
		}
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
		if ValidarCorreo(c) == nil {
			t.Errorf("%q debería ser inválido", c)
		}
	}
}
