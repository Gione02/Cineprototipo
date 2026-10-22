"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { AlertTriangle, CalendarPlus, Check } from "lucide-react";
import { SALAS, finFuncion, pelicula, sala } from "@/data/catalogo";
import { PARAMETROS } from "@/data/parametros";
import { fmtFecha, fmtHora } from "@/utils/formato";
import { finCon, funcionQueChoca, horariosLibres, primerHueco } from "@/utils/programacion";
import type { Funcion } from "@/types/catalogo";
import { useApp } from "@/store/AppProvider";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { Poster } from "@/components/ui/Poster";
import { card } from "@/components/panel/Elementos";

const formatoDeSala = (salaId: string) => ({ Tradicional: "2D", VIP: "2D VIP" })[sala(salaId).tipo] ?? sala(salaId).tipo;

/* ─────────── Programación (RF-05, RF-31, RF-67) ─────────── */
export function Programar() {
  const { funciones, peliculas, programarFuncion } = useApp();
  const enVenta = peliculas.filter((p) => p.categoria !== "proximamente");
  const [exito, setExito] = useState<Funcion | null>(null);
  const [peli, setPeli] = useState(enVenta[0]?.id ?? "");
  // Valor inicial: el primer hueco libre para la primera película (la programación base va de 10:00 a 23:00).
  const [inicial] = useState(() => primerHueco(funciones, SALAS.map((s) => s.id), pelicula(enVenta[0]?.id ?? "").duracion));
  const [salaId, setSalaId] = useState(inicial.salaId);
  const [fecha, setFecha] = useState(inicial.fecha);
  const [hora, setHora] = useState(inicial.hora);
  const [precio, setPrecio] = useState(50);
  const [conflicto, setConflicto] = useState<{ con: Funcion; libres: string[] } | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const p = pelicula(peli);
  const inicio = new Date(`${fecha}T${hora}:00`).toISOString();
  const fin = finCon(inicio, p.duracion);

  const guardar = async () => {
    setError("");
    if (new Date(inicio) < new Date()) return setError("No se pueden programar funciones en el pasado.");
    const c = funcionQueChoca(funciones, salaId, inicio, p.duracion);
    if (c) return setConflicto({ con: c, libres: horariosLibres(funciones, salaId, fecha, p.duracion) });
    setConflicto(null);
    setGuardando(true);
    const datos = { peliculaId: peli, salaId, inicio, formato: formatoDeSala(salaId), idioma: p.idioma, precio };
    const r = await programarFuncion(datos);
    setGuardando(false);
    if (!r.ok) return setError(r.error!);
    setExito({ id: r.id!, ...datos });
  };

  const ocupadas = funciones.filter((o) => o.salaId === salaId && new Date(o.inicio).toLocaleDateString("en-CA") === fecha).sort((a, b) => a.inicio.localeCompare(b.inicio));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={`${card} space-y-4`}>
        <label className="etiqueta block">
          Película
          <select value={peli} onChange={(e) => setPeli(e.target.value)} className="campo normal-case tracking-normal">
            {enVenta.map((x) => (
              <option key={x.id} value={x.id}>
                {x.titulo} ({x.duracion} min){x.personalizada ? " · nueva" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="etiqueta block">
          Sala
          <select value={salaId} onChange={(e) => setSalaId(e.target.value)} className="campo normal-case tracking-normal">
            {SALAS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} · {s.tipo}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="etiqueta block">
            Fecha
            <input type="date" value={fecha} min={new Date().toLocaleDateString("en-CA")} onChange={(e) => setFecha(e.target.value)} className="campo" />
          </label>
          <label className="etiqueta block">
            Hora inicio
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="campo" />
          </label>
          <label className="etiqueta block">
            Precio (cr.)
            <input type="number" min={1} max={500} value={precio} onChange={(e) => setPrecio(+e.target.value)} className="campo" />
          </label>
        </div>
        <p className="text-xs text-tenue">
          Hora final calculada: <b className="text-oro">{fmtHora(fin)}</b> (duración {p.duracion} min + {PARAMETROS.limpiezaMinutos} min de limpieza)
        </p>
        <Boton icono={CalendarPlus} tamano="lg" cargando={guardando} onClick={guardar} disabled={!peli} className="w-full">
          Programar y publicar
        </Boton>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-rojo/60 bg-vino/50 p-3 text-sm text-salmon">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}
        {conflicto && (
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-md border border-rojo/60 bg-vino/40 p-3 text-sm">
            <p className="font-bold text-salmon">Conflicto de horario</p>
            <p className="text-salmon/80">
              Se traslapa con «{pelicula(conflicto.con.peliculaId).titulo}» ({fmtHora(conflicto.con.inicio)}–{fmtHora(finFuncion(conflicto.con))}).
            </p>
            <p className="etiqueta mt-2">Horarios libres sugeridos</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {conflicto.libres.length === 0 && <span className="text-xs text-tenue">No quedan horarios libres en esta sala ese día.</span>}
              {conflicto.libres.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setHora(h);
                    setConflicto(null);
                  }}
                  className="chip"
                >
                  {h}
                </button>
              ))}
            </div>
          </m.div>
        )}
      </div>
      <div className={card}>
        <h3 className="titulo mb-4 text-sm">
          {sala(salaId).nombre} · {sala(salaId).tipo} · {fmtFecha(fecha + "T12:00:00")}
        </h3>
        {ocupadas.length === 0 ? (
          <p className="text-sm text-tenue">Sin funciones este día.</p>
        ) : (
          <ul className="space-y-2">
            {ocupadas.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 rounded-md border border-borde bg-fondo px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Poster p={pelicula(o.peliculaId)} className="aspect-[2/3] w-7 shrink-0" rounded="rounded-sm" sizes="28px" />
                  <span className="truncate">{pelicula(o.peliculaId).titulo}</span>
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-tenue">
                  {fmtHora(o.inicio)}–{fmtHora(finFuncion(o))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal abierto={!!exito} onCerrar={() => setExito(null)} etiqueta="Función programada">
        {exito && (
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-oro/60 bg-oro/15 text-oro">
              <Check aria-hidden className="h-6 w-6" />
            </div>
            <h2 className="titulo mt-3 text-xl">Función programada con éxito</h2>
            <p className="mt-2 text-sm text-tenue">
              {pelicula(exito.peliculaId).titulo} · {sala(exito.salaId).nombre} · {fmtFecha(exito.inicio)} {fmtHora(exito.inicio)}–{fmtHora(finFuncion(exito))}
            </p>
            <p className="mt-1 text-xs text-apagado">Se generó la matriz de {sala(exito.salaId).aforo} asientos y la función ya aparece en la cartelera.</p>
            <Boton onClick={() => setExito(null)} className="mt-5 w-full">
              Aceptar
            </Boton>
          </div>
        )}
      </Modal>
    </div>
  );
}
