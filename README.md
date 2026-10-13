# Cineight — Prototipo

Prototipo de la plataforma de boletería y eventos masivos descrita en la ERS v1.4 (Análisis de Sistemas II, UMG).
Usa el stack de la Tabla 19 / Sección 3.4.3: **Next.js 16 + Tailwind CSS + Framer Motion**, **Go 1.26**, **PostgreSQL 18** y **Redis 8**.

```
cineight/
├── frontend/          Next.js (App Router) — interfaz del cliente y panel administrativo
├── backend/           API REST en Go — reservas, pagos con créditos, cola virtual, métricas
├── db/init.sql        Esquema PostgreSQL (snake_case en español) + datos de demostración
└── docker-compose.yml PostgreSQL + Redis + API
```

## Tecnologías

| Capa | Tecnología | Estado en el prototipo |
|---|---|---|
| Frontend | Next.js 16 (React 19, App Router), TypeScript, Tailwind CSS 4, Framer Motion, qrcode.react | Implementado. Funciona solo: guarda los datos en el navegador (`localStorage`) |
| Backend | Go 1.26 (`net/http`, pgx, go-redis) | Implementado: reservas, pago con créditos, cola virtual, rate limiting y métricas |
| Base de datos | PostgreSQL 18 | Implementado en Docker (`db/init.sql`) |
| Caché / candados | Redis 8 | Implementado en Docker (retención de 5 min con TTL, cola, rate limiting) |
| Infraestructura local | Docker Compose | PostgreSQL + Redis + API |

**Pendiente:** el frontend todavía no consume la API en Go (usa datos simulados), y el despliegue en la nube
(Vercel, Render/Railway, Supabase, Upstash) no está configurado.

## Ejecutar

**Frontend** (funciona solo, con datos simulados en el navegador):

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

**Backend + base de datos + Redis** (requiere Docker):

```bash
docker compose up -d --build   # API en http://localhost:8080
```

## Recorrido sugerido

1. **Iniciar sesión** → elige un acceso de demostración (Cliente, Agente Operativo, Administrador o Auditor).
2. **Cliente:** cartelera dividida en *En cartelera*, *Estrenos* y *Próximamente* → ficha de la película
   (director, reparto, sinopsis, tráiler en ventana emergente) → horarios → mapa de butacas → *Comprar boletos*.
   La compra continúa en una ventana emergente con cuenta regresiva de 5 min: *Confirmar compra* (retiene créditos) →
   *Pagar* → ventana de compra exitosa.
3. **Mis Entradas (seguridad):** los QR aparecen borrosos; al tocarlos se abre un visor con código dinámico que cambia cada minuto, marca de agua con el correo del titular,
   cierre automático a los 2 min o al cambiar de pestaña. Cada usuario tiene sus propios créditos, boletos y movimientos. El validador del acceso rechaza códigos vencidos (capturas).
   La sesión se cierra sola tras 15 min sin actividad.
4. **Créditos y trivia:** la trivia sólo se abre tocando **◆ créditos** en el encabezado (un aviso emergente lo recuerda).
   3 preguntas: 10 créditos por acierto y 50 si se aciertan las 3.
5. **Noche de estreno (alta demanda):** la función de estreno de *Duna: Parte Dos* se vende con verificación anti-bots →
   cola virtual con posición y tiempo estimado → turno de 3 min para elegir asiento (límite 2 boletos por cliente).
6. **Agente Operativo:** programar función (detecta traslapes con +20 min de limpieza y sugiere horarios),
   inventario por función y validación de boletos en el acceso (pega el código del boleto).
7. **Administrador → Usuarios & roles:** crear, editar y eliminar (dar de baja) cuentas de cualquier rol. Cada acción pide
   reconfirmar la contraseña del administrador (demo: `cineight123`, 3 intentos, vale 5 min). No puede cambiar su propio rol
   ni darse de baja, y siempre queda al menos un administrador activo. Una cuenta dada de baja no puede iniciar sesión.
8. **Mis Entradas:** los boletos de la misma función se agrupan en una tarjeta («2 entradas»); el visor muestra el QR de cada
   butaca y se cambia con flechas, teclado, deslizando o tocando la butaca.
9. **Administrador:** métricas en vivo, parámetros globales, reportes (exporta CSV) y bitácora.
10. **Auditor:** reportes y bitácora en solo lectura.

## Qué es real y qué está simulado

| Pieza | Frontend (prototipo) | Backend en Go |
|---|---|---|
| Retención de 5 min | temporizador en el navegador | `SET NX` + TTL de 300 s en Redis |
| Sobreventa (RF-54, RNF-36) | simula ~10 % de "otro cliente ganó la butaca" | `SET NX` atómico + índice único parcial en `boletos` |
| Pago con créditos | estado local | transacción con `SELECT … FOR UPDATE`, todo o nada |
| Pago repetido (RF-23) | — | devuelve los mismos boletos sin volver a cobrar |
| Cola virtual | avance simulado | `ZADD NX` / `ZRANK` en Redis |
| Anti-bots (RF-53) | casilla de verificación | límite de 5 solicitudes/min por IP, intentos registrados en la bitácora |

El frontend todavía no consume la API: es un prototipo de interfaz con datos simulados.
El backend se prueba con `curl`:

```bash
curl localhost:8080/api/funciones
curl -X POST localhost:8080/api/reservas -d '{"funcion_id":1,"usuario_id":1,"asientos":["C-4","C-5"]}'
curl -X POST localhost:8080/api/reservas/<reserva_id>/pagar
curl localhost:8080/api/funciones/1/asientos
curl -X POST localhost:8080/api/cola/e1 -d '{"usuario_id":1}'
curl localhost:8080/api/metricas
```

Pendiente para la siguiente iteración: conectar el frontend a la API, autenticación con JWT y bcrypt,
notificaciones por WebSocket/SSE, envío de correo SMTP y pruebas de carga (k6) para RNF-01 y RNF-43.
