"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { fechaEstreno, fmtDuracion, fmtFechaLarga, fmtHora, sala, PELICULAS } from "@/lib/data";
import { useApp } from "@/lib/store";
import { Poster } from "@/components/Poster";
import { Modal } from "@/components/Modal";
import { ModalTrailer } from "@/components/Trailer";
import { BotonVolver } from "@/components/BotonVolver";

export default function FichaPelicula() {
  const { id } = useParams<{ id: string }>();
  const { funciones, ocupacion, cargarOcupacion, toast, usuario, abrirLogin } = useApp();
  const [trailer, setTrailer] = useState(false);
  const [aviso, setAviso] = useState(false);
  const p = PELICULAS.find((x) => x.id === id);

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
      <div className="space-y-4">
        <BotonVolver />
        <p className="text-tenue">La película no existe.</p>
      </div>
    );

  const ahora = new Date();
  const funcs = funciones.filter((f) => f.peliculaId === p.id && new Date(f.inicio) > ahora).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const porDia = new Map<string, typeof funcs>();
  for (const f of funcs) {
    const k = new Date(f.inicio).toLocaleDateString("en-CA");
    porDia.set(k, [...(porDia.get(k) ?? []), f]);
  }
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
      <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-borde px-4 pb-10 pt-6 sm:-mx-6 sm:-mt-8 sm:px-6">
        <Image src={p.poster} alt="" aria-hidden fill sizes="480px" quality={60} className="scale-110 object-cover opacity-30 blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-fondo via-fondo/85 to-fondo/50" />
        <div className="relative mx-auto max-w-7xl">
          <BotonVolver />
          <div className="mt-6 flex flex-col gap-8 sm:flex-row">
            <Poster p={p} className="aspect-[2/3] w-44 shrink-0 shadow-2xl shadow-black/60 sm:w-60" sizes="(max-width: 640px) 176px, 240px" prioridad />
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
                <span>
                  ◷ {fmtDuracion(p.duracion)}
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
                <button onClick={() => setTrailer(true)} className="btn-borde">
                  ▶ Ver tráiler oficial
                </button>
                {p.categoria === "proximamente" ? (
                  <button onClick={() => setAviso(true)} className="btn-vino">
                    🔔 Activar alerta de venta
                  </button>
                ) : (
                  <a href="#horarios" className="btn-vino">
                    ♟ Comprar boletos ↓
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
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="etiqueta text-oro">Elige una función para seleccionar tus butacas</p>
            <h2 className="titulo mt-1 text-2xl">Horarios</h2>
          </div>
          <BotonVolver />
        </div>
        {p.categoria === "proximamente" ? (
          <div className="tarjeta border-dashed p-8 text-center text-tenue">
            Esta película se estrena el <b className="text-oro">{fechaEstreno(p)}</b>. Los horarios se publicarán al abrir la taquilla.
          </div>
        ) : funcs.length === 0 ? (
          <div className="tarjeta border-dashed p-8 text-center text-tenue">No hay funciones programadas por ahora.</div>
        ) : (
          <div className="space-y-6">
            {[...porDia.entries()].map(([dia, lista]) => (
              <div key={dia}>
                <h3 className="etiqueta mb-3 text-tinta first-letter:uppercase">{fmtFechaLarga(lista[0].inicio)}</h3>
                <div className="flex flex-wrap gap-3">
                  {lista.map((f) => {
                    const o = ocupacion(f.id);
                    const s = sala(f.salaId);
                    const libres = s.aforo - o.vendidos.size - o.retenidos.size;
                    return (
                      <Link
                        key={f.id}
                        href={f.eventoId ? `/cola/${f.eventoId}` : `/funcion/${f.id}`}
                        className={`min-w-44 rounded-lg border p-4 transition hover:-translate-y-0.5 ${
                          f.eventoId ? "border-rojo/60 bg-vino/40 hover:border-salmon" : "border-borde bg-panel hover:border-arena"
                        }`}
                      >
                        <span className="block text-3xl font-black tabular-nums">{fmtHora(f.inicio)}</span>
                        <span className="etiqueta mt-1 block">
                          {s.nombre} · {s.tipo}
                        </span>
                        <span className="mt-0.5 block text-xs text-tenue">
                          {f.formato} · {f.idioma}
                        </span>
                        <span className="mt-3 flex justify-between border-t border-borde pt-2 text-xs font-bold">
                          <span className="text-oro">◆ {f.precio}</span>
                          <span className={libres < 15 ? "text-salmon" : "text-tenue"}>{libres} libres</span>
                        </span>
                        {f.eventoId && <span className="mt-2 block text-[9px] font-black uppercase tracking-[0.14em] text-salmon">Preestreno · Cola virtual</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ModalTrailer p={p} abierto={trailer} onCerrar={() => setTrailer(false)} />

      <Modal abierto={aviso} onCerrar={() => setAviso(false)} titulo="Alerta de venta">
        <p className="text-sm text-tenue">
          Te enviaremos un correo{usuario ? ` a ${usuario.correo}` : ""} cuando se abra la taquilla de <b className="text-tinta">{p.titulo}</b> (estreno el{" "}
          {fechaEstreno(p)}).
        </p>
        {usuario ? (
          <button onClick={() => { setAviso(false); toast(`Listo, te avisaremos cuando abra la taquilla de ${p.titulo}.`, "ok"); }} className="btn-vino mt-5 w-full">
            Confirmar alerta
          </button>
        ) : (
          <button onClick={() => { setAviso(false); abrirLogin(); }} className="btn-vino mt-5 w-full">
            Inicia sesión para activarla
          </button>
        )}
      </Modal>
    </div>
  );
}
