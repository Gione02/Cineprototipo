"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CATEGORIAS, EVENTOS, PARAMETROS, PELICULAS, fechaEstreno, fmtDuracion, fmtHora, pelicula, sala, type Pelicula } from "@/lib/data";
import { useApp } from "@/lib/store";
import { Poster } from "@/components/Poster";
import { ModalTrailer } from "@/components/Trailer";

export default function Cartelera() {
  return (
    <div className="space-y-14">
      <Destacado />
      {CATEGORIAS.map((c) => {
        const pelis = PELICULAS.filter((p) => p.categoria === c.id);
        return (
          <section key={c.id} id={c.id} className="scroll-mt-24">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="etiqueta text-oro">{c.sub}</p>
                <h2 className="titulo mt-1 text-2xl sm:text-3xl">{c.titulo}</h2>
              </div>
              <span className="etiqueta">{pelis.length} películas</span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {pelis.map((p, i) => (
                <TarjetaPelicula key={p.id} p={p} i={i} />
              ))}
            </div>
          </section>
        );
      })}
      <BannerTrivia />
    </div>
  );
}

/* Portada: preestreno de alta demanda con cola virtual */
function Destacado() {
  const evento = EVENTOS[0];
  const { funciones } = useApp();
  const f = funciones.find((x) => x.id === evento.funcionId)!;
  const p = pelicula(f.peliculaId);
  const [trailer, setTrailer] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(f.inicio).getTime() - ahora);
  const partes: [number, string][] = [
    [Math.floor(ms / 86400000), "Días"],
    [Math.floor(ms / 3600000) % 24, "Horas"],
    [Math.floor(ms / 60000) % 60, "Minutos"],
    [Math.floor(ms / 1000) % 60, "Segundos"],
  ];

  return (
    <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-borde px-4 py-10 sm:-mx-6 sm:-mt-8 sm:px-6 sm:py-14">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.poster} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-fondo via-fondo/90 to-fondo/40" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_300px]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-wrap gap-2">
            <span className="badge-vino">★ Preestreno exclusivo · Cupo limitado</span>
            <span className="badge-borde">{sala(f.salaId).tipo}</span>
          </div>
          <h1 className="titulo mt-4 text-4xl leading-[0.95] sm:text-6xl">{p.titulo}</h1>
          <p className="titulo mt-2 text-lg text-oro sm:text-2xl">Función especial · {f.formato}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold tracking-wide text-tenue">
            <span>{p.genero}</span>
            <span>◷ {fmtDuracion(p.duracion)}</span>
            <span className="badge-borde">{p.clasificacion}</span>
            <span>
              {sala(f.salaId).nombre} · {sala(f.salaId).tipo}
            </span>
          </div>

          <div className="tarjeta mt-6 max-w-xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="etiqueta flex items-center gap-2 text-salmon">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rojo" /> La función comienza en
              </span>
              <span className="etiqueta">Cola virtual activa · {evento.limitePorCliente} boletos por cliente</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {partes.map(([v, t]) => (
                <div key={t} className="rounded-md border border-borde bg-fondo py-3 text-center">
                  <p className={`text-3xl font-black tabular-nums ${t === "Días" ? "text-salmon" : ""}`}>{String(v).padStart(2, "0")}</p>
                  <p className="etiqueta mt-0.5">{t}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/cola/${evento.id}`} className="btn-vino">
              ⏵ Entrar a la cola virtual
            </Link>
            <button onClick={() => setTrailer(true)} className="btn-borde">
              ▶ Ver tráiler oficial
            </button>
            <Link href={`/pelicula/${p.id}`} className="btn-borde">
              Ficha de la película
            </Link>
          </div>
        </motion.div>

        <div className="tarjeta hidden overflow-hidden p-3 lg:block">
          <div className="relative">
            <Poster p={p} className="aspect-[2/3] w-full" />
            <span className="badge-vino absolute right-2 top-2">{f.formato}</span>
          </div>
          <div className="px-1 pb-1 pt-3">
            <p className="etiqueta text-oro">{sala(f.salaId).nombre}</p>
            <p className="titulo mt-0.5 text-sm">{sala(f.salaId).tipo}</p>
            <p className="mt-1 text-[11px] text-tenue">
              Capacidad: {sala(f.salaId).aforo} butacas · {fmtHora(f.inicio)} hrs
            </p>
          </div>
        </div>
      </div>
      <ModalTrailer p={p} abierto={trailer} onCerrar={() => setTrailer(false)} />
    </section>
  );
}

function TarjetaPelicula({ p, i }: { p: Pelicula; i: number }) {
  const { funciones } = useApp();
  const proximas = funciones
    .filter((f) => f.peliculaId === p.id && new Date(f.inicio) > new Date())
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const desde = proximas.length ? Math.min(...proximas.map((f) => f.precio)) : PARAMETROS.costoBoleto;
  const conCola = proximas.some((f) => f.eventoId);
  const badge = p.categoria === "estreno" ? (conCola ? "Preestreno IMAX" : "Estreno") : p.categoria === "proximamente" ? fechaEstreno(p) : "En cartelera";

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="tarjeta group flex flex-col overflow-hidden transition hover:border-arena/60"
    >
      <Link href={`/pelicula/${p.id}`} className="relative block p-3 pb-0">
        <Poster p={p} className="aspect-[2/3] w-full transition duration-500 group-hover:brightness-110" />
        <span className={`absolute right-5 top-5 ${p.categoria === "cartelera" ? "badge-borde" : "badge-vino"}`}>{badge}</span>
        <span className="absolute bottom-2 left-5 rounded bg-fondo/85 px-2 py-0.5 text-[10px] font-bold tracking-wide">
          {p.clasificacion} · {fmtDuracion(p.duracion)}
          {p.duracionEstimada ? " (est.)" : ""}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="etiqueta truncate">
          {p.genero.split(" / ")[0]} · {p.director.split(",")[0]}
        </p>
        <Link href={`/pelicula/${p.id}`}>
          <h3 className="titulo mt-1.5 text-base leading-tight group-hover:text-salmon">{p.titulo}</h3>
        </Link>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-tenue">{p.sinopsis}</p>

        {p.categoria === "proximamente" ? (
          <div className="mt-auto pt-4">
            <p className="etiqueta">Apertura de taquilla</p>
            <p className="mt-1 text-sm font-bold text-oro">Estreno el {fechaEstreno(p)}</p>
            <Link href={`/pelicula/${p.id}`} className="btn-borde mt-4 w-full">
              🔔 Ver detalles y alerta
            </Link>
          </div>
        ) : (
          <div className="mt-auto pt-4">
            <p className="etiqueta mb-2">Horarios disponibles</p>
            <div className="flex flex-wrap gap-1.5">
              {proximas.slice(0, 3).map((f) => (
                <Link key={f.id} href={f.eventoId ? `/cola/${f.eventoId}` : `/funcion/${f.id}`} className="chip">
                  {fmtHora(f.inicio)} <span className="text-tenue">{f.formato}</span>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t border-borde pt-3">
              <span className="etiqueta">Tarifa desde</span>
              <span className="text-sm font-bold text-oro">◆ {desde} créditos</span>
            </div>
            <Link href={`/pelicula/${p.id}#horarios`} className="btn-vino mt-3 w-full">
              ♟ Seleccionar asientos
            </Link>
          </div>
        )}
      </div>
    </motion.article>
  );
}

function BannerTrivia() {
  const { usuario, abrirLogin } = useApp();
  return (
    <section className="relative overflow-hidden rounded-xl border border-rojo/40 bg-gradient-to-r from-panel via-panel to-vino/60 p-6 sm:p-8">
      <div className="grid items-center gap-6 md:grid-cols-[auto_1fr_auto]">
        <span className="grid h-14 w-14 place-items-center rounded-lg border border-rojo/50 bg-vino text-2xl">🎬</span>
        <div>
          <p className="etiqueta text-salmon">Trivia de cine · {PARAMETROS.preguntasTrivia} preguntas</p>
          <h2 className="titulo mt-1 text-xl sm:text-2xl">¿Te faltan créditos para el próximo estreno?</h2>
          <p className="mt-1 text-sm text-tenue">
            Responde la trivia y gana {PARAMETROS.creditosPorRespuesta} créditos por acierto, o{" "}
            <b className="text-oro">{PARAMETROS.bonoTriviaPerfecta} créditos</b> si aciertas todas. Accede tocando <b className="text-oro">◆ tus créditos</b> en
            la parte superior.
          </p>
        </div>
        {usuario ? (
          <Link href="/trivia" className="btn-vino whitespace-nowrap">
            🎮 Jugar trivia ahora
          </Link>
        ) : (
          <button onClick={() => abrirLogin()} className="btn-vino whitespace-nowrap">
            🎮 Inicia sesión para jugar
          </button>
        )}
      </div>
    </section>
  );
}
