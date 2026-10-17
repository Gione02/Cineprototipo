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

**Pendiente:** autenticación real (JWT + bcrypt) y despliegue en la nube (Vercel, Render/Railway, Supabase, Upstash).

## Cómo abrirlo en tu computadora

### 1. Requisitos

| Programa | Versión | Para qué | Descarga |
|---|---|---|---|
| Git | cualquiera | Descargar el proyecto | https://git-scm.com/downloads |
| Node.js | 20 o superior (LTS) | Frontend | https://nodejs.org |
| Docker Desktop | reciente | API en Go, PostgreSQL y Redis | https://www.docker.com/products/docker-desktop |

Docker es opcional: sin él, el frontend funciona en **modo demostración** con datos simulados en el navegador.
No hace falta instalar Go, PostgreSQL ni Redis: Docker los ejecuta.

### 2. Descargar el proyecto

```bash
git clone https://github.com/Gione02/Cineprototipo.git
cd Cineprototipo
```

¿Ya lo tenías descargado? Actualízalo con `git pull`.

### 3. Levantar el backend (API + base de datos + Redis)

Abre Docker Desktop y espera a que diga *Engine running*. Luego, en la carpeta del proyecto:

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos. Comprueba que funciona abriendo http://localhost:8080/api/salud (debe responder).

> Si ya lo habías levantado con una versión anterior, reinicia la base de datos para cargar los datos nuevos:
> `docker compose down -v` y luego `docker compose up -d --build`.

### 4. Levantar el frontend

```bash
cd frontend
npm install
```

Crea el archivo de configuración copiando el de ejemplo:

```bash
cp .env.example .env.local          # macOS / Linux / Git Bash
copy .env.example .env.local        # Windows (CMD o PowerShell)
```

Y arranca la aplicación:

```bash
npm run dev
```

Abre **http://localhost:3000**. El pie de página indica el modo:

- **API conectada:** los datos vienen de PostgreSQL y Redis.
- **Modo demostración:** la API no responde; todo funciona igual con datos simulados en el navegador.

### 5. Detener todo

- Frontend: `Ctrl + C` en la terminal donde corre `npm run dev`.
- Backend: `docker compose down` (añade `-v` para borrar también la base de datos).

### Problemas comunes

| Síntoma | Solución |
|---|---|
| El pie dice *Modo demostración* | Verifica que Docker Desktop esté abierto y que `docker compose ps` muestre `api`, `postgres` y `redis` en ejecución. Revisa que exista `frontend/.env.local` y reinicia `npm run dev`. |
| `port is already allocated` (5432, 6379 u 8080) | Otro programa usa ese puerto (por ejemplo un PostgreSQL instalado). Detenlo o cambia el puerto izquierdo en `docker-compose.yml`. |
| `port 3000 is in use` | Next.js usará el 3001; en ese caso agrega `http://localhost:3001` a `CORS_ORIGINS` en `docker-compose.yml` y vuelve a ejecutar `docker compose up -d`. |
| `npm` o `node` no se reconoce | Instala Node.js y abre una terminal nueva. |
| Faltan datos o hay errores tras actualizar | `docker compose down -v` y `docker compose up -d --build`. |

### Accesos de demostración

En **Iniciar sesión** hay botones para entrar como *Cliente*, *Agente Operativo*, *Administrador* o *Auditor*.
La contraseña para reconfirmar acciones de administrador es `cineight123`.

### Versión de producción (opcional)

Para medir rendimiento con Lighthouse usa la compilación de producción en una ventana de incógnito:

```bash
cd frontend
npm run build
npm start          # http://localhost:3000
```

### Configuración

- `NEXT_PUBLIC_API_URL` (en `frontend/.env.local`): URL de la API. Si se omite, el frontend usa sólo el modo demostración.
- `CORS_ORIGINS` (en `docker-compose.yml`): orígenes que pueden llamar a la API. Por defecto `http://localhost:3000,http://127.0.0.1:3000`.

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

Con la API conectada, el frontend usa datos reales para la cartelera, la ocupación de butacas, las reservas
y el pago, el saldo y los movimientos del cliente, los créditos de la trivia, la validación de boletos y las
métricas del panel. Siguen simulados: inicio de sesión (sin JWT), gestión de usuarios, bitácora y cola virtual.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/funciones` | Cartelera vigente con butacas disponibles |
| GET | `/api/funciones/{codigo\|id}/asientos` | Butacas vendidas y retenidas |
| POST | `/api/reservas` | `{funcion, usuario_id, asientos}` → retención de 5 min |
| POST | `/api/reservas/{id}/pagar` | Pago idempotente → boletos y saldo |
| DELETE | `/api/reservas/{id}` | Libera la retención |
| POST | `/api/sesion` | `{correo, nombre}` → usuario y cuenta (bono de 120) |
| GET | `/api/usuarios/{id}/cuenta` | Saldo, movimientos y boletos |
| POST | `/api/creditos/trivia` | `{usuario_id, partida, aciertos}` → acreditación única por partida |
| POST | `/api/boletos/{token}/validar` | Validación atómica en el acceso |
| GET | `/api/metricas` | KPIs del panel de administración |

```bash
curl localhost:8080/api/funciones
curl -X POST localhost:8080/api/reservas -d '{"funcion":"f5","usuario_id":1,"asientos":["C-04","C-05"]}'
curl -X POST localhost:8080/api/reservas/<reserva_id>/pagar
curl localhost:8080/api/funciones/f5/asientos
curl localhost:8080/api/metricas
```

Pendiente para la siguiente iteración: autenticación con JWT y bcrypt, usuarios y bitácora en la API,
notificaciones por WebSocket/SSE, envío de correo SMTP y pruebas de carga (k6) para RNF-01 y RNF-43.
