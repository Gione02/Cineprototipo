"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { ArrowDown, Armchair, BellRing, Clock, LogIn, Play } from "lucide-react";
import { fechaEstreno } from "@/data/catalogo";
import { posterSinOptimizar } from "@/utils/imagen";
import { fmtDuracion } from "@/utils/formato";
import { useApp } from "@/store/AppProvider";
import { Poster } from "@/components/ui/Poster";
import { Modal } from "@/components/ui/Modal";
import { ModalTrailer } from "@/components/pelicula/Trailer";
import { BotonVolver } from "@/components/ui/BotonVolver";
import { Boton } from "@/components/ui/Boton";
import { HorariosPorDia } from "@/components/pelicula/HorariosPorDia";

export default function FichaPelicula() {
  const { id } = useParams<{ id: string }>();
  const { funciones, peliculas, cargarOcupacion, toast, usuario, abrirLogin } = useApp();
  const [trailer, setTrailer] = useState(false);
  const [aviso, setAviso] = useState(false);
  const p = peliculas.find((x) => x.id === id);

  // Con la API: butacas libres reales de cada horario de esta película.
  const codigos = funciones
    .filter((f) => f.peliculaId === id)
    .map((f) => f.id)
    .join(",");
  useEffect(() => {
    if (codigos) cargarOcupacion(codigos.split(","));
  }, [codigos, cargarOcupacion]);
  if (!p)
    return (
      <div className="flex items-center gap-4">
        <BotonVolver />
        <p className="text-tenue">La película no existe.</p>
      </div>
    );

  const ahora = new Date();
  const funcs = funciones.filter((f) => f.peliculaId === p.id && new Date(f.inicio) > ahora).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const ficha: [string, string][] = [
    ["Título original", p.tituloOriginal],
    [p.director.includes(",") ? "Directores" : "Director", p.director],
    ["Año", p.anio],
    ["Género", p.genero],
    ["Duración", `${p.duracion} min${p.duracionEstimada ? " (estimada)" : ""}`],
    ["Clasificación", p.clasificacion],
    ["Idioma", p.idioma],
    ["Formatos", p.formatos.join(" · ")],
  ];
  const estado = p.categoria === "estreno" ? "Estreno · Preestreno activo" : p.categoria === "proximamente" ? `Estreno el ${fechaEstreno(p)}` : "En cartelera";

  return (
    <div className="space-y-10">
      {/* Cabecera */}
      <section className="a-sangre relative -mt-6 overflow-hidden border-b border-borde pb-10 pt-6 sm:-mt-8">
        <Image src={p.poster} unoptimized={posterSinOptimizar(p.poster)} alt="" aria-hidden fill sizes="480px" quality={60} className="scale-110 object-cover opacity-30 blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-fondo via-fondo/85 to-fondo/50" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <BotonVolver />
          <div className="mt-6 flex flex-col gap-8 sm:flex-row">
            <Poster p={p} className="mx-auto aspect-[2/3] w-44 shrink-0 shadow-2xl sm:mx-0 shadow-black/60 sm:w-60" sizes="(max-width: 640px) 176px, 240px" prioridad />
            <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className={p.categoria === "cartelera" ? "badge-borde" : "badge-vino"}>{estado}</span>
                <span className="badge-borde">{p.clasificacion}</span>
                {p.formatos.map((f) => (
                  <span key={f} className="badge-borde">
                    {f}
                  </span>
                ))}
              </div>
              <h1 className="titulo mt-4 text-3xl leading-[0.95] sm:text-5xl">{p.titulo}</h1>
              {p.tituloOriginal !== p.titulo && <p className="mt-1 text-sm font-semibold text-tenue">{p.tituloOriginal}</p>}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold tracking-wide text-tenue">
                <span>{p.genero}</span>
                <span className="flex items-center gap-1.5">
                  <Clock aria-hidden className="h-3.5 w-3.5" /> {fmtDuracion(p.duracion)}
                  {p.duracionEstimada ? " (est.)" : ""}
                </span>
                <span>{p.anio}</span>
              </div>
              <p className="mt-3 text-sm">
                <span className="etiqueta mr-2">{p.director.includes(",") ? "Dirección" : "Director"}</span>
                <b className="text-oro">{p.director}</b>
              </p>
              <p className="mt-4 max-w-3xl leading-relaxed text-tinta/90">{p.sinopsis}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Boton variante="borde" icono={Play} onClick={() => setTrailer(true)}>
                  Ver tráiler
                </Boton>
                {p.categoria === "proximamente" ? (
                  <Boton icono={BellRing} onClick={() => setAviso(true)}>
                    Activar alerta de venta
                  </Boton>
                ) : (
                  <a href="#horarios" className="btn-vino group">
                    <Armchair aria-hidden className="h-4 w-4" /> Comprar boletos
                    <ArrowDown aria-hidden className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                  </a>
                )}
              </div>
            </m.div>
          </div>
        </div>
      </section>

      {/* Reparto y ficha técnica */}
      <section className="grid gap-8 md:grid-cols-[1fr_360px]">
        <div>
          <p className="etiqueta text-oro">{p.repartoVoces ? "Reparto de voces" : "Reparto principal"}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {p.reparto.map((r) => (
              <div key={r} className="tarjeta flex items-center gap-3 p-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-arena/50 bg-panel-2 text-xs font-black text-arena">
                  {r.split(" ").map((x) => x[0]).join("").slice(0, 2)}
                </span>
                <span className="text-sm font-semibold">{r}</span>
              </div>
            ))}
          </div>
          <p className="etiqueta mt-8 text-oro">Sinopsis</p>
          <p className="mt-2 leading-relaxed text-tenue">{p.sinopsis}</p>
        </div>
        <dl className="tarjeta h-fit divide-y divide-borde px-4">
          <p className="etiqueta py-3 text-oro">Ficha técnica</p>
          {ficha.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
              <dt className="shrink-0 text-tenue">{k}</dt>
              <dd className="text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Horarios */}
      <section id="horarios" className="scroll-mt-24">
        <div className="mb-5">
          <p className="etiqueta text-oro">Elige un día y una función para seleccionar tus butacas</p>
          <h2 className="titulo mt-1 text-2xl">Horarios</h2>
        </div>
        {p.categoria === "proximamente" ? (
          <div className="tarjeta border-dashed p-8 text-center text-tenue">
            Esta película se estrena el <b className="text-oro">{fechaEstreno(p)}</b>. Los horarios se publicarán al abrir la taquilla.
          </div>
        ) : funcs.length === 0 ? (
          <div className="tarjeta border-dashed p-8 text-center text-tenue">No hay funciones programadas por ahora.</div>
        ) : (
          <HorariosPorDia funciones={funcs} />
        )}
      </section>

      <ModalTrailer p={p} abierto={trailer} onCerrar={() => setTrailer(false)} />

      <Modal abierto={aviso} onCerrar={() => setAviso(false)} titulo="Alerta de venta">
        <p className="text-sm text-tenue">
          Te enviaremos un correo{usuario ? ` a ${usuario.correo}` : ""} cuando se abra la taquilla de <b className="text-tinta">{p.titulo}</b> (estreno el{" "}
          {fechaEstreno(p)}).
        </p>
        {usuario ? (
          <Boton icono={BellRing} onClick={() => { setAviso(false); toast(`Listo, te avisaremos cuando abra la taquilla de ${p.titulo}.`, "ok"); }} className="mt-5 w-full">
            Confirmar alerta
          </Boton>
        ) : (
          <Boton icono={LogIn} onClick={() => { setAviso(false); abrirLogin(); }} className="mt-5 w-full">
            Inicia sesión para activarla
          </Boton>
        )}
      </Modal>
    </div>
  );
}
