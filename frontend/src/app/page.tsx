"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
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
            {/* Móvil: 2 columnas con tarjetas compactas; tableta: 3; escritorio: 4 */}
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
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

  return (
    <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-borde px-4 py-10 sm:-mx-6 sm:-mt-8 sm:px-6 sm:py-14">
      {/* Fondo desenfocado: es el elemento LCP de la portada. Como va con blur, basta una versión pequeña (calidad 60)
          y se pide con prioridad alta en vez de esperar a la carga diferida. */}
      <Image src={p.poster} alt="" aria-hidden fill sizes="480px" quality={60} fetchPriority="high" loading="eager" className="scale-110 object-cover opacity-25 blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-r from-fondo via-fondo/90 to-fondo/40" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_300px]">
        <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
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
            <CuentaRegresiva inicio={f.inicio} />
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
        </m.div>

        <div className="tarjeta hidden overflow-hidden p-3 lg:block">
          <div className="relative">
            <Poster p={p} className="aspect-[2/3] w-full" sizes="280px" />
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

// Cuenta regresiva aislada: sólo este bloque se vuelve a pintar cada segundo, no toda la portada.
function CuentaRegresiva({ inicio }: { inicio: string }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(inicio).getTime() - ahora);
  const partes: [number, string][] = [
    [Math.floor(ms / 86400000), "Días"],
    [Math.floor(ms / 3600000) % 24, "Horas"],
    [Math.floor(ms / 60000) % 60, "Minutos"],
    [Math.floor(ms / 1000) % 60, "Segundos"],
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {partes.map(([v, t]) => (
        <div key={t} className="rounded-md border border-borde bg-fondo py-2.5 text-center sm:py-3">
          <p className={`text-2xl font-black tabular-nums sm:text-3xl ${t === "Días" ? "text-salmon" : ""}`}>{String(v).padStart(2, "0")}</p>
          <p className="etiqueta mt-0.5 !text-[8px] sm:!text-[10px]">{t}</p>
        </div>
      ))}
    </div>
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
    // Entrada animada sólo con opacity/transform y únicamente al aparecer en pantalla (whileInView, una vez):
    // las tarjetas fuera de la vista no consumen hilo principal durante la carga.
    // transition-colors (y no `transition`) evita que el hover anime box-shadow, que no se compone en GPU.
    <m.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ delay: (i % 4) * 0.05, duration: 0.35 }}
      className="tarjeta group flex flex-col overflow-hidden transition-colors hover:border-arena/60"
    >
      <Link href={`/pelicula/${p.id}`} className="relative block p-1.5 pb-0 sm:p-3 sm:pb-0">
        <Poster p={p} className="aspect-[2/3] w-full transition-[filter] duration-500 group-hover:brightness-110" sizes="(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 290px" />
        <span className={`absolute right-2.5 top-2.5 !text-[8px] sm:right-5 sm:top-5 sm:!text-[10px] ${p.categoria === "cartelera" ? "badge-borde" : "badge-vino"}`}>{badge}</span>
        <span className="absolute bottom-1.5 left-2.5 rounded bg-fondo/85 px-1.5 py-0.5 text-[9px] font-bold tracking-wide sm:bottom-2 sm:left-5 sm:px-2 sm:text-[10px]">
          {p.clasificacion} · {fmtDuracion(p.duracion)}
          {p.duracionEstimada ? " (est.)" : ""}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <p className="etiqueta truncate !text-[8px] sm:!text-[10px]">
          {p.genero.split(" / ")[0]}
          <span className="hidden sm:inline"> · {p.director.split(",")[0]}</span>
        </p>
        <Link href={`/pelicula/${p.id}`}>
          <h3 className="titulo mt-1 line-clamp-2 text-xs leading-tight group-hover:text-salmon sm:mt-1.5 sm:text-base">{p.titulo}</h3>
        </Link>
        <p className="mt-1.5 hidden text-xs leading-relaxed text-tenue sm:line-clamp-2">{p.sinopsis}</p>

        {p.categoria === "proximamente" ? (
          <div className="mt-auto pt-3 sm:pt-4">
            <p className="etiqueta hidden sm:block">Apertura de taquilla</p>
            <p className="text-[11px] font-bold text-oro sm:mt-1 sm:text-sm">Estreno el {fechaEstreno(p)}</p>
            <Link href={`/pelicula/${p.id}`} className="btn-borde mt-2.5 w-full !px-2 !py-2 !text-[10px] sm:mt-4 sm:!px-5 sm:!py-3 sm:!text-xs">
              🔔 <span className="sm:hidden">Detalles</span>
              <span className="hidden sm:inline">Ver detalles y alerta</span>
            </Link>
          </div>
        ) : (
          <div className="mt-auto pt-3 sm:pt-4">
            <p className="etiqueta mb-1.5 hidden sm:mb-2 sm:block">Horarios disponibles</p>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {proximas.slice(0, 3).map((f, k) => (
                <Link
                  key={f.id}
                  href={f.eventoId ? `/cola/${f.eventoId}` : `/funcion/${f.id}`}
                  className={`chip !px-1.5 !py-1 !text-[10px] sm:!px-3 sm:!py-1.5 sm:!text-xs ${k > 1 ? "hidden sm:inline-block" : ""}`}
                >
                  {fmtHora(f.inicio)} <span className="hidden text-tenue sm:inline">{f.formato}</span>
                </Link>
              ))}
            </div>
            <div className="mt-2.5 flex items-baseline justify-between border-t border-borde pt-2 sm:mt-4 sm:pt-3">
              <span className="etiqueta !text-[8px] sm:!text-[10px]">Desde</span>
              <span className="text-[11px] font-bold text-oro sm:text-sm">◆ {desde} cr.</span>
            </div>
            <Link href={`/pelicula/${p.id}#horarios`} className="btn-vino mt-2 w-full !px-2 !py-2 !text-[10px] sm:mt-3 sm:!px-5 sm:!py-3 sm:!text-xs">
              ♟ <span className="sm:hidden">Asientos</span>
              <span className="hidden sm:inline">Seleccionar asientos</span>
            </Link>
          </div>
        )}
      </div>
    </m.article>
  );
}

function BannerTrivia() {
  const { usuario, abrirLogin, abrirTrivia } = useApp();
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
          <button onClick={abrirTrivia} className="btn-vino whitespace-nowrap">
            🎮 Jugar trivia ahora
          </button>
        ) : (
          <button onClick={() => abrirLogin()} className="btn-vino whitespace-nowrap">
            🎮 Inicia sesión para jugar
          </button>
        )}
      </div>
    </section>
  );
}
