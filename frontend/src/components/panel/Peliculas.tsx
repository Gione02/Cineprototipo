"use client";

import { useState } from "react";
import { Film, Plus, Search } from "lucide-react";
import { fechaEstreno } from "@/data/catalogo";
import type { Categoria } from "@/types/catalogo";
import { useApp } from "@/store/AppProvider";
import { fmtDuracion } from "@/utils/formato";
import { nFunciones } from "@/utils/programacion";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { Poster } from "@/components/ui/Poster";
import { FormPelicula } from "./FormPelicula";

const ETIQUETA: Record<Categoria, string> = { cartelera: "En cartelera", estreno: "Estreno", proximamente: "Próximamente" };

/** Catálogo del cine: el agente operativo y el administrador publican películas nuevas con sus funciones. */
export function Peliculas() {
  const { peliculas, funciones, modoApi } = useApp();
  const [filtro, setFiltro] = useState<Categoria | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [alta, setAlta] = useState(false);
  const [recien, setRecien] = useState<string | null>(null);

  const ahora = new Date();
  const lista = peliculas
    .filter((p) => (filtro === "todas" || p.categoria === filtro) && `${p.titulo} ${p.director}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => Number(!!b.personalizada) - Number(!!a.personalizada));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {(["todas", "cartelera", "estreno", "proximamente"] as const).map((c) => (
            <button key={c} type="button" onClick={() => setFiltro(c)} className={`chip ${filtro === c ? "!border-oro text-oro" : ""}`}>
              {c === "todas" ? "Todas" : ETIQUETA[c]}{" "}
              <span className="text-tenue">{c === "todas" ? peliculas.length : peliculas.filter((p) => p.categoria === c).length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:ml-auto">
          <label className="relative block sm:w-64">
            <span className="sr-only">Buscar película</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-apagado" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título o director…" className="campo !mt-0 !pl-9" />
          </label>
          <Boton icono={Plus} onClick={() => setAlta(true)}>
            Nueva película
          </Boton>
        </div>
      </div>

      <p className="text-xs text-tenue">
        {modoApi === "conectado"
          ? "Las películas nuevas se guardan en PostgreSQL (póster incluido) y aparecen al instante en la cartelera."
          : "Modo demostración: las películas nuevas se guardan en este navegador."}
      </p>

      {lista.length === 0 ? (
        <div className="tarjeta border-dashed p-10 text-center text-sm text-tenue">
          <Film aria-hidden className="mx-auto mb-2 h-8 w-8 text-apagado" /> No hay películas con ese filtro.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {lista.map((p) => {
            const proximas = funciones.filter((f) => f.peliculaId === p.id && new Date(f.inicio) > ahora).length;
            return (
              <article key={p.id} className={`tarjeta flex flex-col overflow-hidden ${recien === p.id ? "ring-2 ring-oro" : ""}`}>
                <div className="relative p-2 pb-0">
                  <Poster p={p} className="aspect-[2/3] w-full" sizes="(max-width: 640px) 45vw, 220px" />
                  <span className={`absolute right-3.5 top-3.5 !text-[9px] ${p.categoria === "cartelera" ? "badge-borde" : "badge-vino"}`}>{ETIQUETA[p.categoria]}</span>
                  {p.personalizada && <span className="badge-vino absolute bottom-1.5 left-3.5 !border-oro/60 !bg-oro !text-[9px] !text-fondo">Nueva</span>}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="titulo line-clamp-2 text-sm leading-tight">{p.titulo}</h3>
                  <p className="mt-1 truncate text-[11px] text-tenue">
                    {p.clasificacion} · {fmtDuracion(p.duracion)} · {p.genero.split(" / ")[0]}
                  </p>
                  <p className="mt-auto pt-2 text-[11px] font-bold text-oro">
                    {p.categoria === "proximamente" ? `Estreno el ${fechaEstreno(p)}` : `${nFunciones(proximas)} próximas`}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal abierto={alta} onCerrar={() => setAlta(false)} titulo="Nueva película" ancho="max-w-5xl">
        {alta && (
          <FormPelicula
            onListo={(id) => {
              setAlta(false);
              setRecien(id);
              setFiltro("todas");
            }}
          />
        )}
      </Modal>
    </div>
  );
}
