"use client";

import { useId, useMemo, useRef, useState } from "react";
import { m } from "framer-motion";
import { AlertTriangle, CalendarPlus, CheckCircle2, ImagePlus, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { SALAS, sala } from "@/data/catalogo";
import { PARAMETROS } from "@/data/parametros";
import type { Categoria, NuevaFuncion, NuevaPelicula } from "@/types/catalogo";
import { useApp } from "@/store/AppProvider";
import { prepararPoster } from "@/utils/imagen";
import { finCon, funcionQueChoca, horariosLibres, nFunciones, primerHueco, type Ocupada } from "@/utils/programacion";
import { fmtHora } from "@/utils/formato";
import { Boton, BotonIcono } from "@/components/ui/Boton";

const CATEGORIAS: { id: Categoria; txt: string }[] = [
  { id: "cartelera", txt: "En cartelera" },
  { id: "estreno", txt: "Estreno" },
  { id: "proximamente", txt: "Próximamente" },
];
const CLASIFICACIONES = ["G", "PG", "PG-13", "R", "NC-17"];
const FORMATOS = ["IMAX Láser", "Dolby Atmos", "4DX 3D", "3D", "2D", "2D VIP"];
const IDIOMAS = ["Subtitulada", "Español"];

/** Formato de una función según el tipo de sala. */
const formatoDeSala = (salaId: string) => ({ Tradicional: "2D", VIP: "2D VIP" })[sala(salaId).tipo] ?? sala(salaId).tipo;
const precioDeSala = (salaId: string) => ({ "IMAX Láser": 70, "Dolby Atmos": 60, "4DX 3D": 75, VIP: 80 })[sala(salaId).tipo] ?? 50;

/** Acepta un enlace de YouTube (watch, youtu.be, embed, shorts) o el id directo. */
function idTrailer(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  const m = t.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

type Fila = { clave: number; salaId: string; fecha: string; hora: string; precio: number };

const manana = () => new Date(Date.now() + 86400000).toLocaleDateString("en-CA");

/**
 * Alta de película con su ficha, póster y funciones. Todo se valida aquí (y de nuevo en la API) antes de guardar:
 * campos obligatorios, imagen, y que cada función no se traslape con otra de la misma sala (incluida la limpieza).
 */
export function FormPelicula({ onListo }: { onListo: (id: string) => void }) {
  const { funciones, crearPelicula, toast } = useApp();
  const idForm = useId();
  const archivo = useRef<HTMLInputElement>(null);
  const [d, setD] = useState({
    titulo: "",
    tituloOriginal: "",
    categoria: "cartelera" as Categoria,
    clasificacion: "PG-13",
    duracion: 120,
    anio: String(new Date().getFullYear()),
    genero: "",
    idioma: "Subtitulada",
    director: "",
    reparto: "",
    formatos: ["2D"] as string[],
    sinopsis: "",
    trailer: "",
    estrenoEnDias: 30,
  });
  const [poster, setPoster] = useState("");
  const [procesandoImg, setProcesandoImg] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  // La primera función propuesta ya viene en un hueco libre (la programación base ocupa de 10:00 a 22:00).
  const [filas, setFilas] = useState<Fila[]>(() => {
    const h = primerHueco(funciones, SALAS.map((s) => s.id), 120);
    return [{ clave: 1, ...h, precio: precioDeSala(h.salaId) }];
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const conFunciones = d.categoria !== "proximamente";
  const cambiar = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }));

  // Estado de cada función: traslape con la programación existente o con otra fila del formulario.
  const revision = useMemo(() => {
    return filas.map((f, i) => {
      const inicio = new Date(`${f.fecha}T${f.hora}:00`);
      if (Number.isNaN(inicio.getTime())) return { inicio: "", fin: null, problema: "Fecha u hora inválida" };
      const iso = inicio.toISOString();
      const fin = finCon(iso, d.duracion);
      if (inicio < new Date()) return { inicio: iso, fin, problema: "Está en el pasado" };
      const choque = funcionQueChoca(funciones, f.salaId, iso, d.duracion);
      if (choque) return { inicio: iso, fin, problema: `Choca con una función de ${fmtHora(choque.inicio)}` };
      const otra = filas.findIndex((g, j) => {
        if (j >= i || g.salaId !== f.salaId) return false;
        const gi = new Date(`${g.fecha}T${g.hora}:00`);
        return inicio < finCon(gi.toISOString(), d.duracion) && gi < fin;
      });
      if (otra >= 0) return { inicio: iso, fin, problema: `Choca con la función ${otra + 1} de esta lista` };
      return { inicio: iso, fin, problema: "" };
    });
  }, [filas, funciones, d.duracion]);

  const cargarImagen = async (f: File | undefined) => {
    if (!f) return;
    setProcesandoImg(true);
    setError("");
    try {
      setPoster(await prepararPoster(f));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcesandoImg(false);
    }
  };

  const agregarFila = () => {
    const ultima = filas[filas.length - 1];
    const salaId = ultima?.salaId ?? "s1";
    const fecha = ultima?.fecha ?? manana();
    // Sugiere el siguiente hueco libre: misma sala y fecha si cabe; si no, la primera sala/fecha disponible.
    // Las filas ya agregadas cuentan como ocupadas para no proponer dos funciones encimadas.
    const ocupadas: Ocupada[] = [
      ...funciones,
      ...filas.map((g) => {
        const inicio = new Date(`${g.fecha}T${g.hora}:00`).toISOString();
        return { id: `fila-${g.clave}`, peliculaId: "", salaId: g.salaId, inicio, fin: finCon(inicio, d.duracion), formato: "", idioma: "", precio: 0 };
      }),
    ];
    const misma = horariosLibres(ocupadas, salaId, fecha, d.duracion, 1)[0];
    const h = misma ? { salaId, fecha, hora: misma } : primerHueco(ocupadas, SALAS.map((s) => s.id), d.duracion);
    setFilas((x) => [...x, { clave: Date.now(), ...h, precio: precioDeSala(h.salaId) }]);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trailer = idTrailer(d.trailer);
    const fallo =
      d.titulo.trim().length < 2
        ? "Escribe el título."
        : !poster
          ? "Sube la imagen del póster."
          : d.duracion < 30 || d.duracion > 300
            ? "La duración debe estar entre 30 y 300 minutos."
            : d.genero.trim() === "" || d.director.trim() === ""
              ? "Completa género y director."
              : d.sinopsis.trim().length < 20
                ? "La sinopsis debe tener al menos 20 caracteres."
                : trailer === ""
                  ? "El enlace del tráiler no es de YouTube."
                  : d.formatos.length === 0
                    ? "Elige al menos un formato."
                    : conFunciones && revision.some((r) => r.problema)
                      ? "Corrige las funciones marcadas en rojo."
                      : "";
    if (fallo) return setError(fallo);

    const pelicula: NuevaPelicula = {
      titulo: d.titulo.trim(),
      tituloOriginal: d.tituloOriginal.trim() || d.titulo.trim(),
      categoria: d.categoria,
      clasificacion: d.clasificacion,
      duracion: d.duracion,
      genero: d.genero.trim(),
      idioma: d.idioma,
      formatos: d.formatos,
      director: d.director.trim(),
      reparto: d.reparto.split(",").map((x) => x.trim()).filter(Boolean),
      anio: d.anio.trim(),
      sinopsis: d.sinopsis.trim(),
      poster,
      ...(trailer ? { trailer } : {}),
      ...(d.categoria === "proximamente" ? { estrenoEnDias: d.estrenoEnDias } : {}),
    };
    const nuevas: NuevaFuncion[] = conFunciones
      ? filas.map((f, i) => ({ salaId: f.salaId, inicio: revision[i].inicio, formato: formatoDeSala(f.salaId), idioma: d.idioma, precio: f.precio }))
      : [];

    setGuardando(true);
    const r = await crearPelicula(pelicula, nuevas);
    setGuardando(false);
    if (!r.ok) return setError(r.error!);
    toast(`«${pelicula.titulo}» publicada${r.funciones ? ` con ${nFunciones(r.funciones)}` : ""}.`, "ok");
    onListo(r.id!);
  };

  const campo = "campo normal-case tracking-normal";

  return (
    <form id={idForm} onSubmit={guardar} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        {/* Póster */}
        <div>
          <p className="etiqueta mb-2">Póster *</p>
          <button
            type="button"
            onClick={() => archivo.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              cargarImagen(e.dataTransfer.files[0]);
            }}
            className={`group relative grid aspect-[2/3] w-full max-w-[220px] place-items-center overflow-hidden rounded-lg border-2 border-dashed transition-colors ${
              arrastrando ? "border-oro bg-oro/10" : poster ? "border-borde" : "border-borde bg-fondo hover:border-arena"
            }`}
          >
            {poster ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de un data URL local */}
                <img src={poster} alt="Vista previa del póster" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-fondo/85 py-2 text-[10px] font-bold uppercase tracking-[0.12em] opacity-0 transition-opacity group-hover:opacity-100">
                  <Upload aria-hidden className="h-3.5 w-3.5" /> Cambiar imagen
                </span>
              </>
            ) : (
              <span className="px-4 text-center text-tenue">
                {procesandoImg ? <Loader2 aria-hidden className="mx-auto h-8 w-8 animate-spin" /> : <ImagePlus aria-hidden className="mx-auto h-8 w-8 text-arena" />}
                <span className="mt-2 block text-xs font-semibold">Arrastra la imagen o haz clic</span>
                <span className="mt-1 block text-[10px]">JPG, PNG o WebP · vertical 2:3</span>
              </span>
            )}
          </button>
          <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => cargarImagen(e.target.files?.[0])} />
        </div>

        {/* Ficha */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="etiqueta block sm:col-span-2">
            Título *
            <input value={d.titulo} onChange={(e) => cambiar("titulo", e.target.value)} maxLength={120} className={campo} placeholder="Ej. Dune: Parte Tres" />
          </label>
          <label className="etiqueta block">
            Título original
            <input value={d.tituloOriginal} onChange={(e) => cambiar("tituloOriginal", e.target.value)} className={campo} placeholder="Igual al título si se deja vacío" />
          </label>
          <div>
            <p className="etiqueta">Categoría *</p>
            <div className="mt-1 grid grid-cols-3 rounded-md border border-borde bg-fondo p-1">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => cambiar("categoria", c.id)}
                  aria-pressed={d.categoria === c.id}
                  className={`rounded px-1 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${d.categoria === c.id ? "bg-vino text-salmon" : "text-tenue hover:text-tinta"}`}
                >
                  {c.txt}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <label className="etiqueta block">
              Clasificación
              <select value={d.clasificacion} onChange={(e) => cambiar("clasificacion", e.target.value)} className={campo}>
                {CLASIFICACIONES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="etiqueta block">
              Duración (min) *
              <input type="number" min={30} max={300} value={d.duracion} onChange={(e) => cambiar("duracion", +e.target.value)} className={campo} />
            </label>
            <label className="etiqueta block">
              Año
              <input value={d.anio} onChange={(e) => cambiar("anio", e.target.value)} maxLength={20} className={campo} />
            </label>
          </div>
          <label className="etiqueta block">
            Género *
            <input value={d.genero} onChange={(e) => cambiar("genero", e.target.value)} className={campo} placeholder="Acción / Ciencia Ficción" />
          </label>
          <label className="etiqueta block">
            Idioma
            <select value={d.idioma} onChange={(e) => cambiar("idioma", e.target.value)} className={campo}>
              {IDIOMAS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </label>
          <label className="etiqueta block">
            Director(es) *
            <input value={d.director} onChange={(e) => cambiar("director", e.target.value)} className={campo} placeholder="Separados por coma" />
          </label>
          <label className="etiqueta block">
            Reparto principal
            <input value={d.reparto} onChange={(e) => cambiar("reparto", e.target.value)} className={campo} placeholder="Actor 1, Actriz 2, …" />
          </label>
          <div className="sm:col-span-2">
            <p className="etiqueta">Formatos *</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {FORMATOS.map((f) => {
                const activo = d.formatos.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => cambiar("formatos", activo ? d.formatos.filter((x) => x !== f) : [...d.formatos, f])}
                    className={`chip ${activo ? "!border-oro text-oro" : "text-tenue"}`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="etiqueta block sm:col-span-2">
            Sinopsis *<span className="float-right font-normal normal-case tracking-normal text-apagado">{d.sinopsis.trim().length} caracteres</span>
            <textarea value={d.sinopsis} onChange={(e) => cambiar("sinopsis", e.target.value)} rows={4} maxLength={1200} className={`${campo} resize-y`} />
          </label>
          <label className="etiqueta block">
            Tráiler (YouTube)
            <input value={d.trailer} onChange={(e) => cambiar("trailer", e.target.value)} className={campo} placeholder="https://youtu.be/…" />
          </label>
          {d.categoria === "proximamente" && (
            <label className="etiqueta block">
              Estreno en (días)
              <input type="number" min={1} max={365} value={d.estrenoEnDias} onChange={(e) => cambiar("estrenoEnDias", +e.target.value)} className={campo} />
            </label>
          )}
        </div>
      </div>

      {/* Funciones */}
      <section className="rounded-lg border border-borde bg-fondo/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="titulo text-sm">Funciones</p>
            <p className="text-xs text-tenue">
              {conFunciones
                ? `Cada función ocupa ${d.duracion} min + ${PARAMETROS.limpiezaMinutos} min de limpieza. Se revisa en vivo que no choque con la programación.`
                : "Las películas «Próximamente» se publican sin funciones; prográmalas cuando abra la taquilla."}
            </p>
          </div>
          {conFunciones && (
            <Boton variante="borde" tamano="sm" icono={Plus} onClick={agregarFila} disabled={filas.length >= 40}>
              Agregar función
            </Boton>
          )}
        </div>
        {conFunciones && (
          <div className="space-y-2">
            {filas.length === 0 && <p className="py-3 text-center text-xs text-tenue">Sin funciones: la película quedará publicada sin horarios.</p>}
            {filas.map((f, i) => {
              const r = revision[i];
              const set = (cambio: Partial<Fila>) => setFilas((x) => x.map((y) => (y.clave === f.clave ? { ...y, ...cambio } : y)));
              return (
                <m.div
                  key={f.clave}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`grid grid-cols-2 items-end gap-2 rounded-md border p-2.5 sm:grid-cols-[28px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_40px] ${
                    r.problema ? "border-rojo/60 bg-vino/20" : "border-borde bg-panel"
                  }`}
                >
                  <span className="hidden self-center text-center text-xs font-black text-tenue sm:block">{i + 1}</span>
                  <label className="etiqueta col-span-2 block sm:col-span-1">
                    Sala
                    <select value={f.salaId} onChange={(e) => set({ salaId: e.target.value, precio: precioDeSala(e.target.value) })} className={`${campo} !py-2`}>
                      {SALAS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} · {s.tipo}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="etiqueta block">
                    Fecha
                    <input type="date" value={f.fecha} min={new Date().toLocaleDateString("en-CA")} onChange={(e) => set({ fecha: e.target.value })} className={`${campo} !py-2`} />
                  </label>
                  <label className="etiqueta block">
                    Hora
                    <input type="time" value={f.hora} onChange={(e) => set({ hora: e.target.value })} className={`${campo} !py-2`} />
                  </label>
                  <label className="etiqueta block">
                    Precio
                    <input type="number" min={1} max={500} value={f.precio} onChange={(e) => set({ precio: +e.target.value })} className={`${campo} !py-2`} />
                  </label>
                  <p className={`col-span-2 flex items-center gap-1.5 self-center text-[11px] font-semibold sm:col-span-1 ${r.problema ? "text-salmon" : "text-oro"}`}>
                    {r.problema ? <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 aria-hidden className="h-3.5 w-3.5 shrink-0" />}
                    <span className="min-w-0">{r.problema || (r.fin ? `${formatoDeSala(f.salaId)} · termina ${fmtHora(r.fin)}` : "")}</span>
                  </p>
                  <BotonIcono icono={Trash2} etiqueta={`Quitar función ${i + 1}`} tamano="sm" onClick={() => setFilas((x) => x.filter((y) => y.clave !== f.clave))} className="self-end justify-self-end sm:order-last sm:self-center" />
                </m.div>
              );
            })}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-rojo/60 bg-vino/50 p-3 text-sm text-salmon">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 border-t border-borde pt-4 sm:flex-row sm:justify-end">
        <Boton type="submit" icono={conFunciones && filas.length ? CalendarPlus : Save} tamano="lg" cargando={guardando} disabled={procesandoImg} className="sm:min-w-64">
          {guardando ? "Publicando…" : conFunciones && filas.length ? `Publicar con ${nFunciones(filas.length)}` : "Publicar película"}
        </Boton>
      </div>
    </form>
  );
}
