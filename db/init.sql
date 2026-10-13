-- Esquema de Cineight (PostgreSQL 18). Nomenclatura snake_case en español (RNF-14).

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
  bloqueado_hasta  TIMESTAMPTZ
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
  nombre    TEXT NOT NULL,
  filas     SMALLINT NOT NULL,
  columnas  SMALLINT NOT NULL,
  aforo     SMALLINT NOT NULL,
  activa    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE peliculas (
  id             SERIAL PRIMARY KEY,
  titulo         TEXT NOT NULL,
  clasificacion  TEXT NOT NULL,
  duracion_min   SMALLINT NOT NULL,
  genero         TEXT,
  idioma         TEXT,
  sinopsis       TEXT,
  estado         TEXT NOT NULL DEFAULT 'anunciada'
);

CREATE TABLE funciones (
  id           SERIAL PRIMARY KEY,
  pelicula_id  INT NOT NULL REFERENCES peliculas(id),
  sala_id      INT NOT NULL REFERENCES salas(id),
  inicio       TIMESTAMPTZ NOT NULL,
  fin          TIMESTAMPTZ NOT NULL,        -- inicio + duración + 20 min de limpieza (RF-31)
  formato      TEXT NOT NULL DEFAULT '2D',
  precio       INTEGER NOT NULL,            -- créditos
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

CREATE TABLE bitacora_auditoria (
  id           BIGSERIAL PRIMARY KEY,
  usuario_id   BIGINT,
  accion       TEXT NOT NULL,
  entidad      TEXT,
  valor_anterior JSONB,
  valor_nuevo  JSONB,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Datos de demostración. El hash es un marcador: el inicio de sesión del prototipo se simula en el frontend.
INSERT INTO usuarios (nombre, correo, hash_contrasena, rol_id) VALUES
  ('Ana López',      'ana.lopez@correo.com', '$2a$10$Q9r1m0h0pZ3x1x7nqv8b0eW8m0n2Zq4S2Wc6l2y2a3o7xJ5h1m6yG', 1),
  ('Carlos Agente',  'agente@cineight.gt',   '$2a$10$Q9r1m0h0pZ3x1x7nqv8b0eW8m0n2Zq4S2Wc6l2y2a3o7xJ5h1m6yG', 2),
  ('Admin Sistema',  'admin@cineight.gt',    '$2a$10$Q9r1m0h0pZ3x1x7nqv8b0eW8m0n2Zq4S2Wc6l2y2a3o7xJ5h1m6yG', 3),
  ('Laura Auditora', 'auditor@cineight.gt',  '$2a$10$Q9r1m0h0pZ3x1x7nqv8b0eW8m0n2Zq4S2Wc6l2y2a3o7xJ5h1m6yG', 4);
INSERT INTO cuentas_credito VALUES (1, 120);
INSERT INTO movimientos_credito (usuario_id, tipo, monto, referencia) VALUES (1, 'recarga', 120, 'bono-bienvenida');

INSERT INTO salas (nombre, filas, columnas, aforo) VALUES ('Sala 1 · IMAX Láser', 12, 16, 192), ('Sala 2 · Dolby Atmos', 10, 14, 140), ('Sala 3 · Tradicional', 10, 12, 120);

INSERT INTO peliculas (titulo, clasificacion, duracion_min, genero, idioma, estado) VALUES
  ('The Batman', 'PG-13', 176, 'Acción / Crimen / Drama', 'Subtitulada', 'en_cartelera'),
  ('Intensa-Mente 2', 'PG', 96, 'Animación / Aventura / Comedia', 'Español', 'estreno_general'),
  ('Gladiador', 'R', 155, 'Acción / Aventura / Drama Histórico', 'Subtitulada', 'en_cartelera'),
  ('Duna: Parte Dos', 'PG-13', 166, 'Ciencia Ficción / Aventura', 'Subtitulada', 'preestreno');

INSERT INTO funciones (pelicula_id, sala_id, inicio, fin, formato, precio)
SELECT p.id, v.sala, v.inicio, v.inicio + make_interval(mins => p.duracion_min + 20), v.formato, v.precio
FROM (VALUES
  (1, 2, date_trunc('day', now()) + interval '1 day 19 hours 30 minutes', '2D', 50),
  (2, 1, date_trunc('day', now()) + interval '1 day 17 hours', '2D', 50),
  (3, 3, date_trunc('day', now()) + interval '1 day 21 hours 15 minutes', '2D', 50),
  (4, 2, date_trunc('day', now()) + interval '2 days 20 hours', '3D', 70)
) AS v(pelicula, sala, inicio, formato, precio)
JOIN peliculas p ON p.id = v.pelicula;
