package services

import (
	"context"
	"errors"
	"testing"

	"github.com/cineight/backend/internal/domain"
)

// cuentasMemoria es un doble de Cuentas: sólo importa qué correos existen y cuántas cuentas se crean.
type cuentasMemoria struct {
	existentes map[string]bool
	creadas    int
}

func (c *cuentasMemoria) ExisteCliente(_ context.Context, correo string) (bool, error) {
	return c.existentes[correo], nil
}
func (c *cuentasMemoria) VincularCliente(_ context.Context, correo, _ string) (int64, int, error) {
	if !c.existentes[correo] {
		c.existentes[correo] = true
		c.creadas++
	}
	return 1, domain.BonoBienvenida, nil
}
func (c *cuentasMemoria) Cuenta(context.Context, int64) (domain.Cuenta, error) { return domain.Cuenta{}, nil }
func (c *cuentasMemoria) AcreditarTrivia(context.Context, int64, string, int) (bool, int, error) {
	return false, 0, nil
}
func (c *cuentasMemoria) Metricas(context.Context) (domain.Metricas, error) { return domain.Metricas{}, nil }
func (c *cuentasMemoria) HistorialClientes(context.Context) ([]domain.HistorialCliente, error) {
	return nil, nil
}

// guardiaFija acepta un único pase y sólo una vez, como CanjearPase en Redis.
type guardiaFija struct{ pase string }

func (g *guardiaFija) ExigirPase(_ context.Context, pase, _ string) error {
	if pase == "" || pase != g.pase {
		return domain.Prohibido("pase requerido")
	}
	g.pase = ""
	return nil
}

func TestSesionExigePaseSoloParaCuentasNuevas(t *testing.T) {
	ctx := context.Background()
	repo := &cuentasMemoria{existentes: map[string]bool{"ana.lopez@correo.com": true}}
	s := NuevoCuentas(repo, nil, nil, &guardiaFija{pase: "P1"})

	if _, _, err := s.Sesion(ctx, "ana.lopez@correo.com", "Ana López", ""); err != nil {
		t.Fatalf("una cuenta existente no debería pedir pase: %v", err)
	}

	_, _, err := s.Sesion(ctx, "bot.nuevo@correo.com", "Bot Nuevo", "")
	var e *domain.Error
	if !errors.As(err, &e) || e.Estado != 403 {
		t.Fatalf("crear una cuenta sin pase debería responder 403, obtuve %v", err)
	}

	if _, _, err := s.Sesion(ctx, "luis.perez@correo.com", "Luis Pérez", "P1"); err != nil {
		t.Fatalf("con pase válido debería crear la cuenta: %v", err)
	}
	if _, _, err := s.Sesion(ctx, "otra.cuenta@correo.com", "Otra Cuenta", "P1"); err == nil {
		t.Fatal("un pase ya usado no debería servir para otra cuenta")
	}
	if repo.creadas != 1 {
		t.Fatalf("se esperaba 1 cuenta creada, hubo %d", repo.creadas)
	}
}
