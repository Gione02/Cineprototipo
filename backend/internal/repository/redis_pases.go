package repository

import (
	"context"
	"time"

	"github.com/cineight/backend/pkg/token"
	"github.com/redis/go-redis/v9"
)

// EmitirPase guarda un pase anti-bots de un solo uso que vence solo (TTL).
// Lo recibe quien supera reCAPTCHA y lo presenta en la siguiente solicitud sensible.
func (r *Redis) EmitirPase(ctx context.Context, ttl time.Duration) (string, error) {
	pase := token.Nuevo(24)
	return pase, falla(r.rdb.Set(ctx, "pase:"+pase, 1, ttl).Err())
}

// CanjearPase consume el pase de forma atómica (GETDEL): dos solicitudes no pueden usar el mismo.
func (r *Redis) CanjearPase(ctx context.Context, pase string) (bool, error) {
	if pase == "" {
		return false, nil
	}
	err := r.rdb.GetDel(ctx, "pase:"+pase).Err()
	if err == redis.Nil {
		return false, nil
	}
	return err == nil, falla(err)
}
