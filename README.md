# Cineight — Prototipo

Prototipo de la plataforma de boletería y eventos masivos descrita en la ERS v1.4 (Análisis de Sistemas II, UMG).
Usa el stack de la Tabla 19 / Sección 3.4.3: **Next.js 16 + Tailwind CSS + Framer Motion**, **Go 1.26**, **PostgreSQL 18** y **Redis 8**.

## Novedades de esta versión

- **Butacas en tiempo real:** cada butaca elegida queda bloqueada a tu nombre 5 min (candado atómico en Redis) y los demás
  clientes la ven bloqueada al instante por **Server-Sent Events**. Si recargas la página recuperas tus propios bloqueos.
- **reCAPTCHA v3 invisible** en inicio de sesión, registro y cola virtual, verificado por el backend antes de procesar credenciales.
- **Catálogo editable:** el agente operativo y el administrador publican películas con póster, ficha técnica, tráiler y
  funciones desde el panel, con detección de traslapes en vivo.
- **Programación ampliada:** 24 películas (8 en cartelera, 8 estrenos, 8 próximamente) y 16 salas; cada película tiene
  4–5 funciones diarias entre las 10:00 y las 22:00 durante 4 días (294 funciones).
- **Interfaz:** logotipo en la barra superior, botones con íconos y animaciones, carruseles horizontales, horarios por día,
  navegación con íconos, menú de usuario con *Cerrar sesión* (lleva a la cartelera) y panel de administración con barra
  lateral fija.
- **Código reorganizado** por responsabilidades en el frontend y arquitectura por capas en el backend (ver estructura).

```
cineight/
├── frontend/                 Next.js (App Router) — interfaz del cliente y panel administrativo
│   └── src/
│       ├── app/              Rutas. (sitio)/ = público con pie de página · panel/ = personal, a pantalla completa
│       ├── components/
│       │   ├── ui/           Piezas reutilizables: Boton, BotonIcono, BotonVolver, Modal, Carrusel, Poster
│       │   ├── layout/       Header, Logo, MenuUsuario, PiePagina, GuardiaRol, Ventanas
│       │   ├── auth/         LoginModal (reCAPTCHA v3), AvisoRecaptcha
│       │   ├── cartelera/    Destacado, TarjetaPelicula, BannerTrivia
│       │   ├── pelicula/     HorariosPorDia, Trailer
│       │   ├── funcion/      MapaButacas, piezas del checkout
│       │   ├── boletos/      Boleto, VisorQR
│       │   ├── trivia/       TriviaJuego, TriviaModal, AvisoTrivia
│       │   └── panel/        MarcoPanel (barra lateral fija) + una sección por archivo
│       │                     (Películas + FormPelicula, Programar, Usuarios, Reportes…)
│       ├── hooks/            useAsientosEnVivo (SSE), useRecaptcha, useCerrarSesion, usePanelDatos…
│       ├── services/         api.ts (cliente HTTP), recaptcha.ts, mapeadores.ts (Go → interfaz)
│       ├── store/            AppProvider: estado global (sesión, compra, créditos)
│       ├── data/             catálogo de demostración y parámetros globales
│       ├── types/            tipos del dominio y de la API
│       └── utils/            formato, programación (traslapes y huecos libres), imagen del póster, CSV, QR, cola
├── backend/                  API REST en Go (arquitectura por capas)
│   ├── cmd/api/              main.go: configuración y cableado de dependencias
│   ├── internal/
│   │   ├── config/           variables de entorno
│   │   ├── domain/           entidades, reglas fijas y errores de negocio
│   │   ├── repository/       PostgreSQL (catálogo, ventas, cuentas) y Redis (candados, reservas, cola, Pub/Sub)
│   │   ├── services/         lógica de negocio (depende de interfaces, no de implementaciones)
│   │   └── handlers/         rutas HTTP, JSON y SSE
│   └── pkg/                  utilidades sin dependencias del dominio: httpx, recaptcha, token
├── db/init.sql               Esquema PostgreSQL (snake_case en español) + datos de demostración y programación
└── docker-compose.yml        PostgreSQL + Redis + API
```

## Tecnologías

| Capa | Tecnología | Estado en el prototipo |
|---|---|---|
| Frontend | Next.js 16 (React 19, App Router), TypeScript, Tailwind CSS 4, Framer Motion, lucide-react, qrcode.react | Implementado. Funciona solo: guarda los datos en el navegador (`localStorage`) |
| Backend | Go 1.26 (`net/http`, pgx, go-redis) | Implementado: bloqueo de butacas en tiempo real (SSE), reservas, pago con créditos, cola virtual, reCAPTCHA v3, rate limiting y métricas |
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

> **Si ya lo habías levantado con una versión anterior**, reinicia la base de datos: esta versión agrega salas, películas,
> funciones y columnas nuevas. `docker compose down -v` y luego `docker compose up -d --build`.

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
- `RETENCION_SEGUNDOS` (API, opcional): vida del bloqueo de una butaca y de una reserva. Por defecto 300.

#### reCAPTCHA v3 (opcional)

El inicio de sesión, el registro y la cola virtual usan reCAPTCHA v3 invisible: no hay casillas ni imágenes.
El navegador obtiene un token con un puntaje y el backend en Go lo verifica con Google **antes** de procesar las credenciales.

1. Crea un sitio tipo **reCAPTCHA v3** en https://www.google.com/recaptcha/admin y agrega el dominio `localhost`.
2. Clave del sitio (pública) → `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` en `frontend/.env.local`.
3. Clave secreta → archivo `.env` en la raíz del proyecto (Docker Compose lo lee solo; no se sube a git):

   ```
   RECAPTCHA_SECRET=tu_clave_secreta
   RECAPTCHA_MIN_SCORE=0.5
   ```

4. Reinicia: `docker compose up -d` y `npm run dev`.

Sin claves, el formulario sigue funcionando con las otras dos capas anti-bots (campo trampa y tiempo mínimo de envío).

### Programación de funciones

`db/init.sql` y `frontend/src/data/catalogo.ts` generan la **misma** programación (mismos códigos `f1…f294`):
cada película se proyecta en dos salas; cada sala alterna dos películas desde las 10:00 (salas 1–8) o las 11:30 (salas 9–16)
y la siguiente función empieza al terminar la anterior más 20 min de limpieza (RF-31), sin inicios después de las 22:00.
Antes de las 13:00 hay 10 créditos de descuento. El preestreno con cola virtual es la última función de *Duna: Parte Dos*
de mañana en la Sala 1. Las fechas son relativas al día en que se crea la base de datos.

## Recorrido sugerido

1. **Iniciar sesión** → elige un acceso de demostración (Cliente, Agente Operativo, Administrador o Auditor).
2. **Cliente:** cartelera en carruseles horizontales (*En cartelera*, *Estrenos*, *Próximamente*) → ficha de la película
   (director, reparto, sinopsis, tráiler en ventana emergente) → horarios por día → mapa de butacas → *Comprar boletos*.
   Abre la misma función en dos navegadores con clientes distintos: lo que bloquea uno aparece al instante en el otro.
   La compra continúa en una ventana emergente con cuenta regresiva de 5 min: *Confirmar compra* (retiene créditos) →
   *Pagar* → ventana de compra exitosa.
3. **Mis Entradas (seguridad):** los QR aparecen borrosos; al tocarlos se abre un visor con código dinámico que cambia cada minuto, marca de agua con el correo del titular,
   cierre automático a los 2 min o al cambiar de pestaña. Cada usuario tiene sus propios créditos, boletos y movimientos. El validador del acceso rechaza códigos vencidos (capturas).
   La sesión se cierra sola tras 15 min sin actividad.
4. **Créditos y trivia:** la trivia sólo se abre tocando **tus créditos** en el encabezado (un aviso emergente lo recuerda).
   3 preguntas: 10 créditos por acierto y 50 si se aciertan las 3.
5. **Noche de estreno (alta demanda):** la función de estreno de *Duna: Parte Dos* se vende con verificación anti-bots →
   cola virtual con posición y tiempo estimado → turno de 3 min para elegir asiento (límite 2 boletos por cliente).
6. **Agente Operativo / Administrador → Películas:** *Nueva película* con póster (arrastrar o elegir imagen), ficha técnica,
   tráiler y sus funciones. Cada función se revisa en vivo contra la programación (duración + 20 min de limpieza) y se
   propone el primer horario libre. Con la API se guarda en PostgreSQL (póster incluido) y si alguna función choca no se
   guarda nada; sin API, se guarda en el navegador.
7. **Agente Operativo / Administrador → Programación:** programar una función para cualquier película (detecta traslapes
   y sugiere horarios libres). El agente además tiene inventario por función y validación de boletos en el acceso.
8. **Administrador → Usuarios & roles:** crear, editar y eliminar (dar de baja) cuentas de cualquier rol. Cada acción pide
   reconfirmar la contraseña del administrador (demo: `cineight123`, 3 intentos, vale 5 min). No puede cambiar su propio rol
   ni darse de baja, y siempre queda al menos un administrador activo. Una cuenta dada de baja no puede iniciar sesión.
9. **Mis Entradas:** los boletos de la misma función se agrupan en una tarjeta («2 entradas»); el visor muestra el QR de cada
   butaca y se cambia con flechas, teclado, deslizando o tocando la butaca.
10. **Administrador:** métricas en vivo, parámetros globales, reportes (exporta CSV) y bitácora.
11. **Auditor:** reportes y bitácora en solo lectura.
12. **Cerrar sesión:** desde el menú del usuario (esquina superior derecha); limpia la sesión y vuelve a la cartelera.

## Qué es real y qué está simulado

| Pieza | Frontend (prototipo) | Backend en Go |
|---|---|---|
| Bloqueo al elegir una butaca | simula ~5 % de "otro cliente la tomó primero" | candado atómico por butaca (script Lua equivalente a `SET NX EX 300`), máx. 6 por cliente |
| Mapa en tiempo real | — | SSE (`/api/funciones/{id}/stream`) alimentado por Redis Pub/Sub y por los vencimientos de TTL |
| Retención de 5 min | temporizador en el navegador | `SET NX` + TTL de 300 s en Redis |
| Sobreventa (RF-54, RNF-36) | — | candados atómicos + índice único parcial en `boletos` |
| reCAPTCHA v3 (RF-53) | se obtiene el token, pero no hay servidor que lo valide | `POST /api/captcha/verificar` contra Google (puntaje y acción) |
| Pago con créditos | estado local | transacción con `SELECT … FOR UPDATE`, todo o nada |
| Pago repetido (RF-23) | — | devuelve los mismos boletos sin volver a cobrar |
| Cola virtual | avance simulado | `ZADD NX` / `ZRANK` en Redis |
| Anti-bots (RF-53) | campo trampa + tiempo mínimo de envío | además, límite de 5 solicitudes/min por IP en reservas y cola; los bloqueos quedan en la bitácora |
| Alta de películas | se guardan en el navegador (póster como imagen comprimida) | transacción en PostgreSQL con póster (`bytea`), validación del tipo real de imagen y de traslapes |

Con la API conectada, el frontend usa datos reales para la cartelera, las películas y funciones creadas desde el panel,
la ocupación de butacas en tiempo real, las reservas y el pago, el saldo y los movimientos del cliente, los créditos de
la trivia, la validación de boletos y las métricas del panel. Siguen simulados: inicio de sesión (sin JWT), gestión de
usuarios, bitácora y cola virtual.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/funciones` | Cartelera vigente con butacas disponibles |
| GET | `/api/funciones/{codigo\|id}/asientos[?usuario=ID]` | Butacas vendidas y retenidas (y con `usuario`, cuáles son suyas) |
| GET | `/api/funciones/{codigo\|id}/stream` | **SSE**: evento `estado` (foto inicial) y `asientos` (`bloqueado`, `liberado`, `vendido`) |
| POST | `/api/funciones/{codigo\|id}/asientos/{butaca}/bloqueo` | `{usuario_id}` → candado de la butaca por 5 min (409 si la tiene otro) |
| DELETE | `/api/funciones/{codigo\|id}/bloqueos` | `{usuario_id, asientos}` → suelta butacas propias |
| POST | `/api/reservas` | `{funcion, usuario_id, asientos}` → retención de 5 min |
| POST | `/api/reservas/{id}/pagar` | Pago idempotente → boletos y saldo |
| DELETE | `/api/reservas/{id}` | Libera la retención |
| POST | `/api/sesion` | `{correo, nombre}` → usuario y cuenta (bono de 120) |
| GET | `/api/usuarios/{id}/cuenta` | Saldo, movimientos y boletos |
| POST | `/api/creditos/trivia` | `{usuario_id, partida, aciertos}` → acreditación única por partida |
| POST | `/api/boletos/{token}/validar` | Validación atómica en el acceso |
| GET | `/api/metricas` | KPIs del panel de administración |
| GET | `/api/ocupacion` | Ocupación de todas las funciones vigentes en una respuesta (panel) |
| GET | `/api/peliculas` | Películas creadas desde el panel (ficha completa) |
| POST | `/api/peliculas` | Agente/administrador: ficha + póster (data URL, máx. 2 MB) + funciones, en una transacción. 409 si alguna función se traslapa |
| GET | `/api/peliculas/{slug}/poster` | Imagen del póster guardada en PostgreSQL |
| POST | `/api/funciones` | `{pelicula, sala, inicio, formato, idioma, precio}` → programa una función (409 si se traslapa) |
| POST | `/api/captcha/verificar` | `{token, accion}` → verificación de reCAPTCHA v3 (403 si no supera el puntaje) |

```bash
curl localhost:8080/api/funciones
curl -X POST localhost:8080/api/reservas -d '{"funcion":"f5","usuario_id":1,"asientos":["C-04","C-05"]}'
curl -X POST localhost:8080/api/reservas/<reserva_id>/pagar
curl localhost:8080/api/funciones/f5/asientos
curl localhost:8080/api/metricas
curl -N localhost:8080/api/funciones/f5/stream     # deja la terminal abierta y bloquea butacas desde el navegador
```

### Cómo se evita la doble venta

1. Al tocar una butaca libre, el frontend pide `POST …/bloqueo`. Un script Lua en Redis comprueba y escribe en un solo paso:
   si la clave `asiento:{función}:{butaca}` no existe (o ya es del mismo cliente) la crea con TTL de 300 s; si es de otro, responde 409.
2. Cada cambio se publica en el canal `asientos:{función}`; todas las instancias de la API lo reenvían por SSE a los navegadores
   que tienen abierto ese mapa. Cuando un TTL vence, Redis lo notifica (`notify-keyspace-events Ex`) y se difunde como `liberado`.
3. Al reservar, las butacas bloqueadas por el cliente pasan a la reserva de forma atómica (todas o ninguna).
4. Al pagar, la transacción en PostgreSQL y el índice único parcial de `boletos` son la última barrera.

Pendiente para la siguiente iteración: autenticación con JWT y bcrypt (hoy el `usuario_id` viaja en el cuerpo de la
solicitud y los permisos de rol, como crear películas, se aplican sólo en el frontend), usuarios y bitácora en la API,
edición y baja de películas, envío de correo SMTP y pruebas de carga (k6) para RNF-01 y RNF-43.
