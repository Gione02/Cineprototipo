package services

import (
	"context"
	"testing"
	"time"

	"github.com/cineight/backend/internal/domain"
)

// cacheMemoria es un doble de Cache en memoria.
type cacheMemoria map[string][]byte

func (c cacheMemoria) LeerCache(_ context.Context, k string) ([]byte, bool) {
	d, ok := c[k]
	return d, ok
}
func (c cacheMemoria) GuardarCache(_ context.Context, k string, d []byte, _ time.Duration) {
	c[k] = d
}
func (c cacheMemoria) BorrarCache(_ context.Context, k string) { delete(c, k) }

// catalogoContador cuenta cuántas veces se consultó la base de datos.
type catalogoContador struct {
	catalogoFalso
	consultas int
}

func (c *catalogoContador) Funciones(context.Context) ([]domain.Funcion, error) {
	c.consultas++
	return []domain.Funcion{{Codigo: "f1", Pelicula: "dune-2"}}, nil
}

func TestCarteleraSeSirveDesdeLaCache(t *testing.T) {
	cat := &catalogoContador{}
	s := NuevaCartelera(nil, cat, cacheMemoria{}, 15*time.Second)
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		lista, err := s.Funciones(ctx)
		if err != nil || len(lista) != 1 || lista[0].Codigo != "f1" {
			t.Fatalf("consulta %d: %v %+v", i, err, lista)
		}
	}
	if cat.consultas != 1 {
		t.Fatalf("5 consultas deberían llegar 1 sola vez a la base de datos, llegaron %d", cat.consultas)
	}
	s.InvalidarCartelera(ctx)
	if _, _ = s.Funciones(ctx); cat.consultas != 2 {
		t.Fatalf("tras invalidar, la siguiente consulta debe ir a la base de datos (fueron %d)", cat.consultas)
	}
}

func TestReglasDeLaFicha(t *testing.T) {
	valida := domain.Pelicula{Titulo: "  Duna  ", Categoria: "cartelera", Clasificacion: "PG-13", Duracion: 166, Sinopsis: "Paul Atreides se une a los Fremen en Arrakis."}
	p, err := normalizarFicha(valida, 3)
	if err != nil || p.Titulo != "Duna" || p.TituloOriginal != "Duna" {
		t.Fatalf("una ficha válida debería aceptarse y normalizarse: %v %+v", err, p)
	}
	vacio := ""
	if p, err := normalizarFicha(domain.Pelicula{Titulo: "Duna", Categoria: "cartelera", Clasificacion: "PG-13", Duracion: 166, Sinopsis: valida.Sinopsis, Trailer: &vacio}, 0); err != nil || p.Trailer != nil {
		t.Fatalf("un tráiler vacío se descarta: %v %+v", err, p.Trailer)
	}
	malas := map[string]func(p *domain.Pelicula) int{
		"título corto":               func(p *domain.Pelicula) int { p.Titulo = "D"; return 0 },
		"categoría":                  func(p *domain.Pelicula) int { p.Categoria = "otra"; return 0 },
		"clasificación":              func(p *domain.Pelicula) int { p.Clasificacion = "X"; return 0 },
		"duración":                   func(p *domain.Pelicula) int { p.Duracion = 10; return 0 },
		"sinopsis corta":             func(p *domain.Pelicula) int { p.Sinopsis = "corta"; return 0 },
		"tráiler inválido":           func(p *domain.Pelicula) int { x := "no-es-youtube"; p.Trailer = &x; return 0 },
		"próximamente con funciones": func(p *domain.Pelicula) int { p.Categoria = "proximamente"; return 1 },
		"demasiadas funciones":       func(p *domain.Pelicula) int { return maxFuncionesAlta + 1 },
	}
	for nombre, cambiar := range malas {
		p := valida
		n := cambiar(&p)
		if _, err := normalizarFicha(p, n); err == nil {
			t.Errorf("%s: debería rechazarse", nombre)
		}
	}
}

func TestCarteleraSinCacheConsultaSiempre(t *testing.T) {
	cat := &catalogoContador{}
	s := NuevaCartelera(nil, cat, cacheMemoria{}, 0)
	for i := 0; i < 3; i++ {
		_, _ = s.Funciones(context.Background())
	}
	if cat.consultas != 3 {
		t.Fatalf("con la caché desactivada cada consulta va a la base de datos (fueron %d)", cat.consultas)
	}
}
