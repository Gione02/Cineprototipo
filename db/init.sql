-- Esquema de Cineight (PostgreSQL 18). Nomenclatura snake_case en español (RNF-14).
-- Los campos `codigo` / `slug` coinciden con los identificadores del frontend (f1…f21, s1…s3, the-batman…)
-- para que la interfaz y la API hablen de las mismas funciones, salas y películas.

CREATE TABLE roles (
  id      SMALLINT PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE
);
INSERT INTO roles VALUES (1, 'cliente'), (2, 'agente'), (3, 'admin'), (4, 'auditor');

CREATE TABLE usuarios (
  id               BIGSERIAL PRIMARY KEY,
  nombre           TEXT NOT NULL,
  correo           TEXT NOT NULL UNIQUE,
  hash_contrasena  TEXT NOT NULL,           -- bcrypt (RNF-09)
  rol_id           SMALLINT NOT NULL REFERENCES roles(id),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  intentos_fallidos SMALLINT NOT NULL DEFAULT 0,
  bloqueado_hasta  TIMESTAMPTZ,
  creado           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cuentas_credito (
  usuario_id  BIGINT PRIMARY KEY REFERENCES usuarios(id),
  saldo       INTEGER NOT NULL DEFAULT 0 CHECK (saldo >= 0)
);

CREATE TABLE movimientos_credito (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('recarga','retencion','debito','liberacion','reembolso')),
  monto       INTEGER NOT NULL,
  referencia  TEXT NOT NULL,
  fecha       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo, referencia)                 -- idempotencia: una partida de trivia o un pago se acredita/debita una sola vez
);

CREATE TABLE salas (
  id        SERIAL PRIMARY KEY,
  codigo    TEXT NOT NULL UNIQUE,
  nombre    TEXT NOT NULL,
  tipo      TEXT NOT NULL,
  filas     SMALLINT NOT NULL,
  columnas  SMALLINT NOT NULL,
  aforo     SMALLINT NOT NULL,
  activa    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE peliculas (
  id             SERIAL PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  titulo         TEXT NOT NULL,
  clasificacion  TEXT NOT NULL,
  duracion_min   SMALLINT NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'cartelera' CHECK (estado IN ('cartelera','estreno','proximamente'))
);

CREATE TABLE funciones (
  id           SERIAL PRIMARY KEY,
  codigo       TEXT NOT NULL UNIQUE,
  pelicula_id  INT NOT NULL REFERENCES peliculas(id),
  sala_id      INT NOT NULL REFERENCES salas(id),
  inicio       TIMESTAMPTZ NOT NULL,
  fin          TIMESTAMPTZ NOT NULL,        -- inicio + duración + 20 min de limpieza (RF-31)
  formato      TEXT NOT NULL DEFAULT '2D',
  idioma       TEXT NOT NULL DEFAULT 'Subtitulada',
  precio       INTEGER NOT NULL,            -- créditos
  evento       TEXT,                        -- preestreno con cola virtual (RF-36)
  estado       TEXT NOT NULL DEFAULT 'programada'
);

-- RF-54 / RNF-36: la restricción UNIQUE hace imposible vender dos veces la misma butaca de una función.
CREATE TABLE boletos (
  id           BIGSERIAL PRIMARY KEY,
  token        TEXT NOT NULL UNIQUE,
  funcion_id   INT NOT NULL REFERENCES funciones(id),
  asiento      TEXT NOT NULL,
  usuario_id   BIGINT NOT NULL REFERENCES usuarios(id),
  precio       INTEGER NOT NULL,
  estado       TEXT NOT NULL DEFAULT 'valido' CHECK (estado IN ('valido','utilizado','anulado','reembolsado')),
  reserva_id   TEXT NOT NULL,
  fecha_venta  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_boletos_asiento_activo ON boletos (funcion_id, asiento) WHERE estado IN ('valido','utilizado');
CREATE INDEX ix_boletos_usuario ON boletos (usuario_id);

CREATE TABLE bitacora_auditoria (
  id           BIGSERIAL PRIMARY KEY,
  usuario_id   BIGINT,
  accion       TEXT NOT NULL,
  entidad      TEXT,
  valor_anterior JSONB,
  valor_nuevo  JSONB,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────── Datos de demostración ─────────
-- El hash es un marcador: el inicio de sesión del prototipo todavía se valida en el frontend (pendiente: JWT + bcrypt).
INSERT INTO usuarios (nombre, correo, hash_contrasena, rol_id) VALUES
  ('Ana López',       'ana.lopez@correo.com',  '$2a$10$Q9r1m0h0pZ3x1x7nqv8b0eW8m0n2Zq4S2Wc6l2y2a3o7xJ5h1m6yG', 1),
  ('Luis Pérez',      'luis.perez@correo.com', '$2a$10$Q9r1m0h0pZ3x1x7nqv8b0eW8m0n2Zq4S2Wc6l2y2a3o7xJ5h1m6yG', 1),
  ('Carlos Agente',   'agente@cineight.gt',    '$2a$10$Q9r1m0h0pZ3x1x7nqv8b0eW8m0n2Zq4S2Wc6l2y2a3o7xJ5h1m6yG', 2),
  ('Admin Sistema',   'admin@cineight.gt',     '$2a$10$Q9r1m0h0pZ3x1x7nqv8b0eW8m0n2Zq4S2Wc6l2y2a3o7xJ5h1m6yG', 3),
  ('Laura Auditora',  'auditor@cineight.gt',   '$2a$10$Q9r1m0h0pZ3x1x7nqv8b0eW8m0n2Zq4S2Wc6l2y2a3o7xJ5h1m6yG', 4),
  ('Taquilla física', 'taquilla@cineight.gt',  '$2a$10$Q9r1m0h0pZ3x1x7nqv8b0eW8m0n2Zq4S2Wc6l2y2a3o7xJ5h1m6yG', 2);
INSERT INTO cuentas_credito VALUES (1, 120), (2, 120), (6, 0);
INSERT INTO movimientos_credito (usuario_id, tipo, monto, referencia) VALUES
  (1, 'recarga', 120, 'bono-bienvenida:1'),
  (2, 'recarga', 120, 'bono-bienvenida:2');

INSERT INTO salas (codigo, nombre, tipo, filas, columnas, aforo) VALUES
  ('s1', 'Sala 1', 'IMAX Láser', 12, 16, 192),
  ('s2', 'Sala 2', 'Dolby Atmos', 10, 14, 140),
  ('s3', 'Sala 3', 'Tradicional', 10, 12, 120);

INSERT INTO peliculas (slug, titulo, clasificacion, duracion_min, estado) VALUES
  ('the-batman',         'The Batman',                          'PG-13', 176, 'cartelera'),
  ('avatar-agua',        'Avatar: El Camino del Agua',          'PG-13', 192, 'cartelera'),
  ('gladiador',          'Gladiador',                           'R',     155, 'cartelera'),
  ('dark-knight',        'El Caballero de la Noche',            'PG-13', 152, 'cartelera'),
  ('deadpool-wolverine', 'Deadpool & Wolverine',                'R',     128, 'estreno'),
  ('dune-2',             'Duna: Parte Dos',                     'PG-13', 166, 'estreno'),
  ('intensa-mente-2',    'Intensa-Mente 2',                     'PG',     96, 'estreno'),
  ('oppenheimer',        'Oppenheimer',                         'R',     180, 'estreno'),
  ('spider-verse',       'Spider-Man: Beyond the Spider-Verse', 'PG',    145, 'proximamente'),
  ('avatar-fuego',       'Avatar: Fuego y Ceniza',              'PG-13', 190, 'proximamente'),
  ('gladiator-2',        'Gladiator II',                        'R',     148, 'proximamente'),
  ('batman-2',           'The Batman: Parte II',                'PG-13', 170, 'proximamente');

-- Programación relativa a "hoy" en la hora de Guatemala (misma tabla que funcionesBase() del frontend).
INSERT INTO funciones (codigo, pelicula_id, sala_id, inicio, fin, formato, idioma, precio, evento)
SELECT v.codigo, p.id, s.id, i.inicio, i.inicio + make_interval(mins => p.duracion_min + 20), v.formato, v.idioma, v.precio, v.evento
FROM (VALUES
  ('f1',  'dune-2',             's1', 0, '14:00', 'IMAX Láser',  'Subtitulada', 70, NULL),
  ('f2',  'avatar-agua',        's1', 0, '17:30', 'IMAX 3D',     'Español',     70, NULL),
  ('f3',  'the-batman',         's1', 0, '21:15', 'IMAX Láser',  'Subtitulada', 70, NULL),
  ('f4',  'avatar-agua',        's1', 1, '15:30', 'IMAX 3D',     'Español',     70, NULL),
  ('f5',  'dune-2',             's1', 1, '20:00', 'IMAX Láser',  'Subtitulada', 80, 'e1'),
  ('f6',  'oppenheimer',        's1', 2, '16:00', 'IMAX Láser',  'Subtitulada', 70, NULL),
  ('f7',  'dune-2',             's1', 2, '19:45', 'IMAX Láser',  'Subtitulada', 70, NULL),
  ('f8',  'intensa-mente-2',    's2', 0, '13:00', 'Dolby Atmos', 'Español',     50, NULL),
  ('f9',  'dark-knight',        's2', 0, '15:30', 'Dolby Atmos', 'Subtitulada', 60, NULL),
  ('f10', 'deadpool-wolverine', 's2', 0, '19:00', 'Dolby Atmos', 'Subtitulada', 60, NULL),
  ('f11', 'gladiador',          's2', 1, '16:00', 'Dolby Atmos', 'Subtitulada', 60, NULL),
  ('f12', 'deadpool-wolverine', 's2', 1, '19:30', 'Dolby Atmos', 'Subtitulada', 60, NULL),
  ('f13', 'intensa-mente-2',    's2', 2, '11:00', 'Dolby Atmos', 'Español',     40, NULL),
  ('f14', 'the-batman',         's2', 2, '18:00', 'Dolby Atmos', 'Subtitulada', 60, NULL),
  ('f15', 'gladiador',          's3', 0, '16:00', '2D',          'Subtitulada', 50, NULL),
  ('f16', 'oppenheimer',        's3', 0, '19:30', '2D',          'Subtitulada', 50, NULL),
  ('f17', 'intensa-mente-2',    's3', 1, '12:00', '3D',          'Español',     50, NULL),
  ('f18', 'dark-knight',        's3', 1, '17:00', '2D',          'Subtitulada', 50, NULL),
  ('f19', 'the-batman',         's3', 1, '20:30', '2D',          'Subtitulada', 50, NULL),
  ('f20', 'avatar-agua',        's3', 3, '15:00', '3D',          'Español',     60, NULL),
  ('f21', 'oppenheimer',        's3', 3, '19:00', '2D',          'Subtitulada', 50, NULL)
) AS v(codigo, pelicula, sala, dias, hora, formato, idioma, precio, evento)
JOIN peliculas p ON p.slug = v.pelicula
JOIN salas s ON s.codigo = v.sala
CROSS JOIN LATERAL (
  SELECT ((date_trunc('day', now() AT TIME ZONE 'America/Guatemala') + make_interval(days => v.dias) + v.hora::time)
          AT TIME ZONE 'America/Guatemala') AS inicio
) i;

-- Ocupación inicial: ventas de taquilla física (~28 %, 55 % en el preestreno), reproducible.
INSERT INTO boletos (token, funcion_id, asiento, usuario_id, precio, reserva_id)
SELECT 'CE-SEED-' || f.id || '-' || fila || '-' || col, f.id,
       chr(65 + fila) || '-' || lpad((col + 1)::text, 2, '0'), 6, f.precio, 'SEED-' || f.codigo
FROM funciones f
JOIN salas s ON s.id = f.sala_id
CROSS JOIN LATERAL generate_series(0, s.filas - 1) AS fila
CROSS JOIN LATERAL generate_series(0, s.columnas - 1) AS col
WHERE (hashtext(f.codigo || ':' || fila || ':' || col) & 1023) / 1024.0 < CASE WHEN f.evento IS NOT NULL THEN 0.55 ELSE 0.28 END;
-- Las ventas de taquilla no cuentan como "vendidos hoy" en línea: se fechan el día anterior.
UPDATE boletos SET fecha_venta = now() - interval '1 day' WHERE reserva_id LIKE 'SEED-%';
