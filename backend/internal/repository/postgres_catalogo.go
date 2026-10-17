package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/cineight/backend/internal/domain"
	"github.com/jackc/pgx/v5"
)

// candadoProgramacion serializa la creación de películas y funciones: evita que dos agentes
// generen el mismo código de función o programen a la vez funciones que se traslapan.
const candadoProgramacion = 7310

// CrearPelicula inserta la película y sus funciones en una sola transacción: si alguna función
// se traslapa con otra de la misma sala, no se guarda nada.
func (p *Postgres) CrearPelicula(ctx context.Context, pel domain.PeliculaAlta, funciones []domain.NuevaFuncion) (slug string, codigos []string, err error) {
	err = pgx.BeginFunc(ctx, p.db, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, candadoProgramacion); err != nil {
			return err
		}
		slug, err = slugLibre(ctx, tx, pel.Slug)
		if err != nil {
			return err
		}
		var id int
		if err := tx.QueryRow(ctx, `
			INSERT INTO peliculas (slug, titulo, titulo_original, clasificacion, duracion_min, estado, genero, idioma, formatos,
			                       director, reparto, anio, sinopsis, trailer, estreno_en_dias, poster, poster_tipo, personalizada, creada_por)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,TRUE,$18) RETURNING id`,
			slug, pel.Titulo, pel.TituloOriginal, pel.Clasificacion, pel.Duracion, pel.Categoria, pel.Genero, pel.Idioma, pel.Formatos,
			pel.Director, pel.Reparto, pel.Anio, pel.Sinopsis, pel.Trailer, pel.EstrenoEnDias, pel.Poster, pel.PosterTipo, pel.CreadaPor).Scan(&id); err != nil {
			return err
		}
		for _, f := range funciones {
			codigo, err := insertarFuncion(ctx, tx, id, pel.Duracion, f)
			if err != nil {
				return err
			}
			codigos = append(codigos, codigo)
		}
		_, err := tx.Exec(ctx, `INSERT INTO bitacora_auditoria (accion, entidad, valor_nuevo) VALUES ('PELICULA_CREADA', 'peliculas', $1)`,
			map[string]any{"slug": slug, "funciones": codigos, "por": pel.CreadaPor})
		return err
	})
	return slug, codigos, err
}

// ProgramarFuncion agrega una función a una película existente.
func (p *Postgres) ProgramarFuncion(ctx context.Context, pelicula string, f domain.NuevaFuncion) (string, error) {
	var codigo string
	err := pgx.BeginFunc(ctx, p.db, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, candadoProgramacion); err != nil {
			return err
		}
		var id, duracion int
		if err := tx.QueryRow(ctx, `SELECT id, duracion_min FROM peliculas WHERE slug = $1`, pelicula).Scan(&id, &duracion); err != nil {
			return domain.ErrNoExiste
		}
		var err error
		codigo, err = insertarFuncion(ctx, tx, id, duracion, f)
		return err
	})
	return codigo, err
}

// insertarFuncion valida la sala y el traslape (inicio + duración + limpieza, RF-31) y genera el siguiente código fN.
func insertarFuncion(ctx context.Context, tx pgx.Tx, peliculaID, duracion int, f domain.NuevaFuncion) (string, error) {
	var salaID int
	if err := tx.QueryRow(ctx, `SELECT id FROM salas WHERE codigo = $1 AND activa`, f.Sala).Scan(&salaID); err != nil {
		return "", domain.Invalido("La sala " + f.Sala + " no existe.")
	}
	fin := f.Inicio.Add(time.Duration(duracion+domain.LimpiezaMin) * time.Minute)
	var t domain.ErrTraslape
	err := tx.QueryRow(ctx, `
		SELECT s.nombre, p.titulo, f.inicio, f.fin FROM funciones f
		JOIN peliculas p ON p.id = f.pelicula_id JOIN salas s ON s.id = f.sala_id
		WHERE f.sala_id = $1 AND f.estado = 'programada' AND f.inicio < $3 AND f.fin > $2
		ORDER BY f.inicio LIMIT 1`, salaID, f.Inicio, fin).Scan(&t.Sala, &t.Titulo, &t.Inicio, &t.Fin)
	if err == nil {
		return "", &t
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	var codigo string
	if err := tx.QueryRow(ctx, `
		INSERT INTO funciones (codigo, pelicula_id, sala_id, inicio, fin, formato, idioma, precio)
		SELECT 'f' || (coalesce(max(substring(codigo FROM 2)::int), 0) + 1), $1, $2, $3, $4, $5, $6, $7
		FROM funciones WHERE codigo ~ '^f[0-9]+$'
		RETURNING codigo`, peliculaID, salaID, f.Inicio, fin, f.Formato, f.Idioma, f.Precio).Scan(&codigo); err != nil {
		return "", err
	}
	return codigo, nil
}

// slugLibre agrega un sufijo numérico si el slug ya existe (matrix → matrix-2).
func slugLibre(ctx context.Context, tx pgx.Tx, base string) (string, error) {
	for n := 1; n < 100; n++ {
		slug := base
		if n > 1 {
			slug = fmt.Sprintf("%s-%d", base, n)
		}
		var existe bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM peliculas WHERE slug = $1)`, slug).Scan(&existe); err != nil {
			return "", err
		}
		if !existe {
			return slug, nil
		}
	}
	return "", domain.Conflicto("Ya existen demasiadas películas con ese título.")
}

// PeliculasPersonalizadas lista las películas creadas desde el panel (las de demostración viven en el frontend).
func (p *Postgres) PeliculasPersonalizadas(ctx context.Context) ([]domain.Pelicula, error) {
	rows, err := p.db.Query(ctx, `
		SELECT slug, titulo, coalesce(titulo_original, titulo), estado, clasificacion, duracion_min, genero, idioma, formatos,
		       director, reparto, anio, sinopsis, trailer, estreno_en_dias::int, '/api/peliculas/' || slug || '/poster'
		FROM peliculas WHERE personalizada ORDER BY creada`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[domain.Pelicula])
}

// Poster devuelve la imagen de una película y su tipo MIME.
func (p *Postgres) Poster(ctx context.Context, slug string) ([]byte, string, error) {
	var datos []byte
	var tipo *string
	err := p.db.QueryRow(ctx, `SELECT poster, poster_tipo FROM peliculas WHERE slug = $1 AND poster IS NOT NULL`, slug).Scan(&datos, &tipo)
	if err != nil || tipo == nil {
		return nil, "", domain.ErrNoExiste
	}
	return datos, *tipo, nil
}
