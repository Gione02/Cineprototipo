package config

import (
	"net/url"
	"testing"
)

// limpiar deja vacías las variables de conexión para que cada prueba controle las suyas.
func limpiar(t *testing.T) {
	for _, k := range []string{"DATABASE_URL", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_SSLMODE", "DB_MAX_CONNS", "DB_MIN_CONNS"} {
		t.Setenv(k, "")
	}
}

func TestSinCredencialesNoArranca(t *testing.T) {
	limpiar(t)
	if _, err := Cargar(); err == nil {
		t.Fatal("sin DATABASE_URL ni DB_* la configuración debería fallar, no usar credenciales por defecto")
	}
}

func TestArmaLaURLConVariablesSeparadas(t *testing.T) {
	limpiar(t)
	t.Setenv("DB_HOST", "db.ejemplo.supabase.co")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "cl@ve#segura/2026")
	c, err := Cargar()
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(c.DatabaseURL)
	if err != nil {
		t.Fatalf("URL inválida %q: %v", c.DatabaseURL, err)
	}
	clave, _ := u.User.Password()
	if u.Host != "db.ejemplo.supabase.co:5432" || u.User.Username() != "postgres" || clave != "cl@ve#segura/2026" || u.Query().Get("sslmode") != "require" {
		t.Fatalf("URL mal armada: %q", c.DatabaseURL)
	}
	if c.DBMaxConns != 25 || c.DBMinConns != 5 {
		t.Fatalf("pool por defecto: se esperaba 25/5, fue %d/%d", c.DBMaxConns, c.DBMinConns)
	}
}

func TestPoolInconsistenteSeRechaza(t *testing.T) {
	limpiar(t)
	t.Setenv("DATABASE_URL", "postgres://u:p@localhost:5432/db")
	t.Setenv("DB_MAX_CONNS", "4")
	t.Setenv("DB_MIN_CONNS", "10")
	if _, err := Cargar(); err == nil {
		t.Fatal("DB_MIN_CONNS mayor que DB_MAX_CONNS debería rechazarse")
	}
}
