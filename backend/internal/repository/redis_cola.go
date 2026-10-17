package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// EntrarCola agrega al usuario a la cola del evento. NX conserva la posición original si repite la solicitud (RF-51).
func (r *Redis) EntrarCola(ctx context.Context, evento, usuario string) error {
	return r.rdb.ZAddNX(ctx, "cola:"+evento, redis.Z{Score: float64(time.Now().UnixMilli()), Member: usuario}).Err()
}

// PosicionCola devuelve el rango (0 = primero) y el total de la cola. ok=false si el usuario no está en ella.
func (r *Redis) PosicionCola(ctx context.Context, evento, usuario string) (rango, total int64, ok bool, err error) {
	clave := "cola:" + evento
	rango, err = r.rdb.ZRank(ctx, clave, usuario).Result()
	if err == redis.Nil {
		return 0, 0, false, nil
	}
	if err != nil {
		return 0, 0, false, err
	}
	total, err = r.rdb.ZCard(ctx, clave).Result()
	return rango, total, true, err
}

// Colas devuelve el tamaño de cada cola virtual activa (métricas).
func (r *Redis) Colas(ctx context.Context) map[string]int64 {
	out := map[string]int64{}
	iter := r.rdb.Scan(ctx, 0, "cola:*", 100).Iterator()
	for iter.Next(ctx) {
		out[strings.TrimPrefix(iter.Val(), "cola:")], _ = r.rdb.ZCard(ctx, iter.Val()).Result()
	}
	return out
}

// Contar incrementa el contador de solicitudes de una IP en la ventana del minuto actual (RF-53).
func (r *Redis) Contar(ctx context.Context, grupo, ip string) (int64, error) {
	clave := fmt.Sprintf("rl:%s:%s:%d", grupo, ip, time.Now().Unix()/60)
	n, err := r.rdb.Incr(ctx, clave).Result()
	if err == nil && n == 1 {
		r.rdb.Expire(ctx, clave, time.Minute)
	}
	return n, err
}
