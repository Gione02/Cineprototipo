"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { BellRing, CalendarClock, Gem } from "lucide-react";
import { fechaEstreno } from "@/data/catalogo";
import { PARAMETROS } from "@/data/parametros";
import { fmtDiaRelativo, fmtDuracion, fmtHora } from "@/utils/formato";
import type { Pelicula } from "@/types/catalogo";
import { useApp } from "@/store/AppProvider";
import { Poster } from "@/components/ui/Poster";
import { BotonEnlace } from "@/components/ui/Boton";

/** Tarjeta de una película dentro de un carrusel de la cartelera. */
export function TarjetaPelicula({ p, i }: { p: Pelicula; i: number }) {
  const { funciones } = useApp();
  const proximas = funciones.filter((f) => f.peliculaId === p.id && new Date(f.inicio) > new Date()).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const desde = proximas.length ? Math.min(...proximas.map((f) => f.precio)) : PARAMETROS.costoBoleto;
  const conCola = proximas.some((f) => f.eventoId);
  const badge = p.categoria === "estreno" ? (conCola ? "Preestreno IMAX" : "Estreno") : p.categoria === "proximamente" ? fechaEstreno(p) : "En cartelera";

  return (
    // Entrada animada sólo con transform y únicamente al aparecer en pantalla (whileInView, una vez).
    // Sin opacity 0 inicial: las tarjetas que aún no se ven en el carrusel siguen siendo legibles para lectores de pantalla.
    // transition-colors (y no `transition`) evita que el hover anime box-shadow, que no se compone en GPU.
    <m.article
      initial={{ y: 16 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "0px -40px 0px 0px" }}
      transition={{ delay: Math.min(i, 5) * 0.05, duration: 0.35 }}
      className="tarjeta group flex h-full flex-col overflow-hidden transition-colors hover:border-arena/60"
    >
      <Link href={`/pelicula/${p.id}`} className="relative block p-1.5 pb-0 sm:p-3 sm:pb-0" draggable={false}>
        <Poster p={p} className="aspect-[2/3] w-full transition-[filter] duration-500 group-hover:brightness-110" sizes="(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 290px" />
        <span className={`absolute right-2.5 top-2.5 sm:right-5 sm:top-5 ${p.categoria === "cartelera" ? "badge-borde" : "badge-vino"}`}>{badge}</span>
        <span className="absolute bottom-1.5 left-2.5 rounded bg-fondo/85 px-1.5 py-0.5 text-[11px] font-bold tracking-wide sm:bottom-2 sm:left-5 sm:px-2">
          {p.clasificacion} · {fmtDuracion(p.duracion)}
          {p.duracionEstimada ? " (est.)" : ""}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="etiqueta truncate">
          {p.genero.split(" / ")[0]}
          <span className="hidden sm:inline"> · {p.director.split(",")[0]}</span>
        </p>
        <Link href={`/pelicula/${p.id}`}>
          <h3 className="titulo mt-1 line-clamp-2 text-lg leading-none group-hover:text-salmon sm:mt-1.5 sm:text-xl">{p.titulo}</h3>
        </Link>
        <p className="mt-1.5 hidden text-xs leading-relaxed text-tenue sm:line-clamp-2">{p.sinopsis}</p>

        {p.categoria === "proximamente" ? (
          <div className="mt-auto pt-3 sm:pt-4">
            <p className="etiqueta hidden sm:block">Apertura de taquilla</p>
            <p className="text-xs font-bold text-oro sm:mt-1 sm:text-sm">Estreno el {fechaEstreno(p)}</p>
            <BotonEnlace href={`/pelicula/${p.id}`} variante="borde" icono={BellRing} className="mt-3 w-full !px-2 !py-2.5 sm:mt-4 sm:!px-5 sm:!py-3">
              Detalles
            </BotonEnlace>
          </div>
        ) : (
          <div className="mt-auto pt-3 sm:pt-4">
            <p className="etiqueta mb-1.5 hidden sm:mb-2 sm:block">Próximos horarios</p>
            <div className="flex flex-wrap gap-1.5">
              {proximas.slice(0, 3).map((f, k) => (
                <Link
                  key={f.id}
                  href={f.eventoId ? `/cola/${f.eventoId}` : `/funcion/${f.id}`}
                  className={`chip !px-2 !py-1 sm:!px-3 sm:!py-1.5 ${k > 0 ? "hidden sm:inline-block" : ""}`}
                >
                  <span className="text-tenue">{fmtDiaRelativo(f.inicio)}</span> {fmtHora(f.inicio)}
                </Link>
              ))}
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-borde pt-2 sm:mt-4 sm:pt-3">
              <span className="etiqueta">Desde</span>
              <span className="flex items-center gap-1 text-xs font-bold text-oro sm:text-sm">
                <Gem aria-hidden className="h-3 w-3" /> {desde} cr.
              </span>
            </div>
            <BotonEnlace href={`/pelicula/${p.id}#horarios`} icono={CalendarClock} className="mt-2 w-full !px-2 !py-2.5 sm:mt-3 sm:!px-5 sm:!py-3">
              Horarios
            </BotonEnlace>
          </div>
        )}
      </div>
    </m.article>
  );
}
