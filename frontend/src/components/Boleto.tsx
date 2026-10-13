"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { fmtFecha, fmtHora, pelicula, sala } from "@/lib/data";
import type { Boleto } from "@/lib/store";
import { useApp } from "@/lib/store";
import { Modal } from "./Modal";
import { Poster } from "./Poster";
import { ROTACION_S, codigoDinamico, enmascarar, ventanaActual } from "@/lib/seguridad";

const ESTADO = {
  VÁLIDO: "border-oro/50 bg-oro/10 text-oro",
  UTILIZADO: "border-borde bg-panel-2 text-tenue",
  ANULADO: "border-rojo/60 bg-vino text-salmon",
  REEMBOLSADO: "border-arena/50 bg-arena/10 text-arena",
};

const AUTOCIERRE_S = 120; // el visor se cierra solo a los 2 minutos

// Agrupa los boletos de una misma función (misma película, horario, formato y sala).
export function agruparBoletos(boletos: Boleto[]): Boleto[][] {
  const grupos = new Map<string, Boleto[]>();
  for (const b of boletos) grupos.set(b.funcionId, [...(grupos.get(b.funcionId) ?? []), b]);
  return [...grupos.values()].map((g) => [...g].sort((a, b) => a.asiento.localeCompare(b.asiento)));
}

/** Tarjeta de una compra: un boleto, o varios de la misma función agrupados. */
export function GrupoBoletos({ boletos }: { boletos: Boleto[] }) {
  const { funciones } = useApp();
  const [visor, setVisor] = useState<number | null>(null);
  const f = funciones.find((x) => x.id === boletos[0].funcionId);
  if (!f) return null;
  const p = pelicula(f.peliculaId);
  const varios = boletos.length > 1;
  const validos = boletos.filter((b) => b.estado === "VÁLIDO").length;
  const estadoGrupo = validos ? "VÁLIDO" : boletos[0].estado;
  const primeroValido = Math.max(0, boletos.findIndex((b) => b.estado === "VÁLIDO"));

  return (
    <>
      <div className="flex overflow-hidden rounded-xl border border-borde bg-panel">
        <Poster p={p} className="hidden w-20 shrink-0 sm:block" rounded="rounded-none" />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${ESTADO[estadoGrupo]}`}>
              {varios ? `${validos} de ${boletos.length} válidas` : boletos[0].estado}
            </span>
            {varios && <span className="badge-vino">{boletos.length} entradas</span>}
          </div>
          <h3 className="titulo mt-2 truncate">{p.titulo}</h3>
          <p className="text-xs text-tenue">
            {f.formato} · {f.idioma}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="etiqueta">Sala</dt>
              <dd className="mt-0.5 font-bold">{sala(f.salaId).nombre}</dd>
            </div>
            <div>
              <dt className="etiqueta">Función</dt>
              <dd className="mt-0.5 font-bold">
                {fmtFecha(f.inicio)} {fmtHora(f.inicio)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="etiqueta">{varios ? "Butacas" : "Butaca"}</dt>
              <dd className="mt-0.5 truncate font-black text-oro">{boletos.map((b) => b.asiento).join(", ")}</dd>
            </div>
          </dl>
          {!varios && <p className="mt-3 text-[10px] tracking-wider text-apagado">N.º {enmascarar(boletos[0].token)}</p>}
        </div>

        {/* QR protegido: borroso hasta que el titular lo abre en el visor seguro */}
        <button
          onClick={() => validos && setVisor(primeroValido)}
          disabled={!validos}
          className="group relative flex w-28 shrink-0 select-none flex-col items-center justify-center border-l border-dashed border-borde bg-white p-3 disabled:cursor-not-allowed sm:w-32"
          aria-label={validos ? (varios ? `Mostrar los ${boletos.length} códigos QR` : "Mostrar código QR") : `Boleto ${boletos[0].estado.toLowerCase()}`}
        >
          {/* En grupos, el QR se ve "apilado" para indicar varias entradas */}
          {varios && <span className="absolute inset-2 translate-x-1.5 translate-y-1.5 rounded bg-black/10" aria-hidden />}
          <div className="pointer-events-none relative blur-[6px]" aria-hidden>
            <QRCodeSVG value="CINEIGHT-PROTEGIDO" size={84} />
          </div>
          <span className="absolute inset-0 grid place-items-center bg-white/30 transition group-hover:bg-white/10">
            <span className="rounded border border-rojo/60 bg-vino px-2.5 py-1 text-center text-[9px] font-black uppercase leading-tight tracking-[0.12em] text-salmon">
              {validos ? (varios ? `🔒 Ver ${boletos.length} QR` : "🔒 Toca para ver") : boletos[0].estado}
            </span>
          </span>
        </button>
      </div>
      {visor !== null && <VisorQR boletos={boletos} inicial={visor} onCerrar={() => setVisor(null)} />}
    </>
  );
}

function VisorQR({ boletos, inicial, onCerrar }: { boletos: Boleto[]; inicial: number; onCerrar: () => void }) {
  const { usuario, funciones, registrar, toast } = useApp();
  const [i, setI] = useState(inicial);
  const [dir, setDir] = useState(1);
  const [ahora, setAhora] = useState(() => Date.now());
  const [desde] = useState(() => Date.now());
  const b = boletos[i];
  const f = funciones.find((x) => x.id === b.funcionId)!;
  const total = boletos.length;

  const ir = (n: number) => {
    if (n < 0 || n >= total) return;
    setDir(n > i ? 1 : -1);
    setI(n);
  };

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (b.estado === "VÁLIDO") registrar("QR_VISUALIZADO", `${enmascarar(b.token)} · ${b.asiento}`);
  }, [registrar, b.token, b.asiento, b.estado]);

  // Flechas del teclado, cierre al cambiar de pestaña y bloqueo de capturas.
  useEffect(() => {
    const oculto = () => document.hidden && onCerrar();
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") ir(i + 1);
      if (e.key === "ArrowLeft") ir(i - 1);
      if (e.key === "PrintScreen") {
        onCerrar();
        toast("Las capturas no sirven para entrar: el código del QR cambia cada minuto.", "error");
      }
    };
    document.addEventListener("visibilitychange", oculto);
    window.addEventListener("keyup", teclas);
    return () => {
      document.removeEventListener("visibilitychange", oculto);
      window.removeEventListener("keyup", teclas);
    };
  });

  const restanteCierre = AUTOCIERRE_S - Math.floor((ahora - desde) / 1000);
  useEffect(() => {
    if (restanteCierre <= 0) onCerrar();
  }, [restanteCierre, onCerrar]);

  const ventana = ventanaActual(ahora);
  const codigo = codigoDinamico(b.token, ventana);
  const seg = ROTACION_S - Math.floor((ahora / 1000) % ROTACION_S);
  const valido = b.estado === "VÁLIDO";

  return (
    <Modal abierto onCerrar={onCerrar} titulo={total > 1 ? `Tus entradas · ${i + 1} de ${total}` : "Tu boleto"} z="z-[55]">
      <div className="text-center" onContextMenu={(e) => e.preventDefault()}>
        <p className="titulo">{pelicula(f.peliculaId).titulo}</p>
        <p className="text-sm text-tenue">
          {sala(f.salaId).nombre} · {fmtFecha(f.inicio)} {fmtHora(f.inicio)} · {f.formato}
        </p>

        <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-md border border-rojo/60 bg-vino px-4 py-1.5">
          <span className="etiqueta text-salmon">Butaca</span>
          <span className="text-xl font-black text-white">{b.asiento}</span>
        </div>

        <div className="relative mt-4 flex items-center justify-center gap-2 sm:gap-4">
          {total > 1 && (
            <button onClick={() => ir(i - 1)} disabled={i === 0} aria-label="Entrada anterior" className="btn-borde h-11 w-11 shrink-0 p-0 text-lg disabled:opacity-25">
              ‹
            </button>
          )}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={b.token}
                custom={dir}
                initial={{ x: dir * 80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: dir * -80, opacity: 0 }}
                transition={{ duration: 0.22 }}
                drag={total > 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) ir(i + 1);
                  else if (info.offset.x > 60) ir(i - 1);
                }}
                className="relative w-fit select-none overflow-hidden rounded-lg border-4 border-tinta/90 bg-white p-3 sm:p-4"
                draggable={false}
              >
                {valido ? (
                  <>
                    <QRCodeSVG value={JSON.stringify({ t: b.token, f: f.id, a: b.asiento, c: codigo, w: ventana })} size={200} className="h-[min(200px,55vw)] w-[min(200px,55vw)]" />
                    {/* Marca de agua con el titular: desalienta la reventa de capturas */}
                    <div className="pointer-events-none absolute inset-0 flex -rotate-[30deg] flex-col justify-center gap-6 text-[10px] font-semibold text-black/15" aria-hidden>
                      {Array.from({ length: 6 }).map((_, k) => (
                        <span key={k} className="whitespace-nowrap">
                          {usuario?.correo} · {usuario?.correo}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="grid h-[min(200px,55vw)] w-[min(200px,55vw)] place-items-center text-center text-black">
                    <div>
                      <p className="text-3xl">✕</p>
                      <p className="mt-1 text-sm font-black uppercase">{b.estado}</p>
                      <p className="text-xs text-black/60">Esta entrada ya no permite el acceso.</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          {total > 1 && (
            <button onClick={() => ir(i + 1)} disabled={i === total - 1} aria-label="Entrada siguiente" className="btn-borde h-11 w-11 shrink-0 p-0 text-lg disabled:opacity-25">
              ›
            </button>
          )}
        </div>

        {total > 1 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {boletos.map((x, k) => (
              <button
                key={x.token}
                onClick={() => ir(k)}
                aria-label={`Ver entrada de la butaca ${x.asiento}`}
                className={`rounded px-2 py-1 text-[10px] font-bold transition ${k === i ? "border border-oro/60 bg-oro/15 text-oro" : "border border-borde bg-panel-2 text-tenue hover:text-tinta"} ${x.estado !== "VÁLIDO" ? "line-through" : ""}`}
              >
                {x.asiento}
              </button>
            ))}
          </div>
        )}

        {valido && (
          <>
            <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded border border-borde bg-panel-2 px-3 py-1 text-xs">
              <span className="font-black tracking-[0.25em] text-oro">{codigo}</span>
              <span className="text-tenue">se renueva en {seg}s</span>
            </div>
            <div className="mx-auto mt-2 h-1 w-48 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full bg-oro transition-all duration-500" style={{ width: `${(seg / ROTACION_S) * 100}%` }} />
            </div>
          </>
        )}
        <p className="mt-2 text-[10px] tracking-wider text-apagado">N.º {enmascarar(b.token)}</p>

        <ul className="mt-4 space-y-1.5 text-left text-xs text-tenue">
          {total > 1 && <li>↔ Usa las flechas, desliza o toca una butaca para ver el QR de cada entrada.</li>}
          <li>🔄 El código cambia cada minuto: una captura de pantalla no sirve para entrar.</li>
          <li>👤 Lleva tu correo como marca de agua y cada entrada se valida una sola vez.</li>
          <li>⏳ Esta ventana se cierra sola en {Math.max(0, restanteCierre)} s o al cambiar de pestaña.</li>
        </ul>
      </div>
    </Modal>
  );
}
