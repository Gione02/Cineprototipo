package repository

import (
	"context"
	"time"
)

// Caché de lecturas frecuentes en Redis (clave "cache:{nombre}"). Es un apoyo, no la fuente de verdad:
// si Redis falla, las lecturas se tratan como "no está en caché" y se consulta PostgreSQL.

// LeerCache devuelve el valor guardado y si existía.
func (r *Redis) LeerCache(ctx context.Context, clave string) ([]byte, bool) {
	datos, err := r.rdb.Get(ctx, "cache:"+clave).Bytes()
	return datos, err == nil
}

// GuardarCache guarda un valor que vence solo tras ttl.
func (r *Redis) GuardarCache(ctx context.Context, clave string, datos []byte, ttl time.Duration) {
	_ = r.rdb.Set(ctx, "cache:"+clave, datos, ttl).Err()
}

// BorrarCache invalida un valor (p. ej. al programar una función nueva).
func (r *Redis) BorrarCache(ctx context.Context, clave string) {
	_ = r.rdb.Del(ctx, "cache:"+clave).Err()
}
