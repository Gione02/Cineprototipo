"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { Clock, Info, Play, Users } from "lucide-react";
import { EVENTOS, funcionDelEvento, pelicula, sala } from "@/data/catalogo";
import { fmtDuracion, fmtHora } from "@/utils/formato";
import { useApp } from "@/store/AppProvider";
import { posterSinOptimizar } from "@/utils/imagen";
import { Poster } from "@/components/ui/Poster";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { ModalTrailer } from "@/components/pelicula/Trailer";

/** Portada: preestreno de alta demanda con cola virtual. No se muestra si no hay ninguno por delante. */
export function Destacado() {
  const evento = EVENTOS[0];
  const { funciones } = useApp();
  const [trailer, setTrailer] = useState(false);
  const f = funcionDelEvento(funciones, evento.id);
  if (!f) return null;
  const p = pelicula(f.peliculaId);
  const s = sala(f.salaId);

  return (
    <section className="a-sangre relative -mt-6 overflow-hidden border-b border-borde py-10 sm:-mt-8 sm:py-14">
      {/* Fondo desenfocado: es el elemento LCP de la portada. Como va con blur, basta una versión pequeña (calidad 60)
          y se pide con prioridad alta en vez de esperar a la carga diferida. */}
      <Image src={p.poster} unoptimized={posterSinOptimizar(p.poster)} alt="" aria-hidden fill sizes="480px" quality={60} fetchPriority="high" loading="eager" className="scale-110 object-cover opacity-25 blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-r from-fondo via-fondo/90 to-fondo/40" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_300px]">
        <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-wrap gap-2">
            <span className="badge-vino">★ Preestreno exclusivo · Cupo limitado</span>
            <span className="badge-borde">{s.tipo}</span>
          </div>
          <h1 className="titulo mt-4 text-4xl leading-[0.95] sm:text-6xl">{p.titulo}</h1>
          <p className="titulo mt-2 text-lg text-oro sm:text-2xl">Función especial · {f.formato}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold tracking-wide text-tenue">
            <span>{p.genero}</span>
            <span className="flex items-center gap-1.5">
              <Clock aria-hidden className="h-3.5 w-3.5" /> {fmtDuracion(p.duracion)}
            </span>
            <span className="badge-borde">{p.clasificacion}</span>
            <span>
              {s.nombre} · {s.tipo}
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
            <BotonEnlace href={`/cola/${evento.id}`} icono={Users}>
              Entrar a la cola virtual
            </BotonEnlace>
            <Boton variante="borde" icono={Play} onClick={() => setTrailer(true)}>
              Ver tráiler
            </Boton>
            <BotonEnlace href={`/pelicula/${p.id}`} variante="borde" icono={Info}>
              Ficha
            </BotonEnlace>
          </div>
        </m.div>

        <div className="tarjeta hidden overflow-hidden p-3 lg:block">
          <div className="relative">
            <Poster p={p} className="aspect-[2/3] w-full" sizes="280px" />
            <span className="badge-vino absolute right-2 top-2">{f.formato}</span>
          </div>
          <div className="px-1 pb-1 pt-3">
            <p className="etiqueta text-oro">{s.nombre}</p>
            <p className="titulo mt-0.5 text-sm">{s.tipo}</p>
            <p className="mt-1 text-[11px] text-tenue">
              Capacidad: {s.aforo} butacas · {fmtHora(f.inicio)} hrs
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
