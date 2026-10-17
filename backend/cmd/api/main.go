// API de Cineight (prototipo). Demuestra las piezas críticas de la ERS:
//   - Bloqueo de butacas en tiempo real con SET NX EX en Redis y difusión por SSE (RF-07, RF-54)
//   - Pago con créditos en una transacción ACID con SELECT ... FOR UPDATE (RF-63, RNF-37)
//   - Índice único parcial en boletos como última barrera contra la sobreventa (RNF-36)
//   - Idempotencia del pago (RF-23) y de los premios de trivia (RF-64)
//   - Cola virtual con ZSET (RF-36, RF-51), rate limiting y reCAPTCHA v3 (RF-53)
//
// Estructura:
//
//	cmd/api              arranque y cableado de dependencias (este archivo)
//	internal/config      configuración desde variables de entorno
//	internal/domain      entidades, reglas fijas y errores de negocio
//	internal/repository  acceso a PostgreSQL y Redis
//	internal/services    lógica de negocio
//	internal/handlers    capa HTTP (rutas, JSON, SSE)
//	pkg/                 utilidades reutilizables sin dependencias del dominio
package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // la imagen alpine no trae la base de zonas horarias

	"github.com/cineight/backend/internal/config"
	"github.com/cineight/backend/internal/handlers"
	"github.com/cineight/backend/internal/repository"
	"github.com/cineight/backend/internal/services"
	"github.com/cineight/backend/pkg/httpx"
	"github.com/cineight/backend/pkg/recaptcha"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Cargar()
	ctx, detener := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer detener()

	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	rdb := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr})
	defer rdb.Close()

	// Repositorios
	pg := repository.NuevoPostgres(db)
	rd := repository.NuevoRedis(rdb)

	// Servicios
	asientos := services.NuevoAsientos(pg, rd, cfg.Retencion)
	srv := handlers.Servicios{
		Catalogo:  pg,
		Asientos:  asientos,
		Reservas:  services.NuevoReservas(asientos, pg, rd, pg, cfg.Retencion),
		Cuentas:   services.NuevoCuentas(pg, pg, pg),
		Cola:      services.NuevaCola(rd, cfg.ColaCapacidad),
		Panel:     services.NuevoPanel(pg, rd, rd),
		Seguridad: services.NuevaSeguridad(recaptcha.Nuevo(cfg.RecaptchaKey, cfg.RecaptchaMin), rd, pg),
		Cartelera: services.NuevaCartelera(pg),
	}

	// Los vencimientos de Redis (TTL) se difunden como "liberado" a los mapas abiertos.
	go asientos.EscucharExpiraciones(ctx)

	origenes := httpx.ListaOrigenes(cfg.OrigenesCORS)
	servidor := &http.Server{
		Addr:              ":" + cfg.Puerto,
		Handler:           handlers.NuevoRouter(srv, handlers.Limites{Sensible: cfg.RateLimit, Interactivo: cfg.RateLimitAlto}, origenes),
		ReadHeaderTimeout: 10 * time.Second,
		// Sin WriteTimeout: las conexiones SSE permanecen abiertas. Sus contextos derivan de ctx,
		// así que al recibir SIGTERM se cierran y Shutdown no queda esperándolas.
		BaseContext: func(net.Listener) context.Context { return ctx },
	}

	go func() {
		<-ctx.Done()
		apagar, cancelar := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelar()
		_ = servidor.Shutdown(apagar)
	}()

	log.Printf("Cineight API escuchando en %s · CORS: %v · reCAPTCHA: %v", servidor.Addr, cfg.OrigenesCORS, cfg.RecaptchaKey != "")
	if err := servidor.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
