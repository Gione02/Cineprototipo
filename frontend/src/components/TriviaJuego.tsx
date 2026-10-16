"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { PARAMETROS, PREGUNTAS } from "@/lib/data";
import { premioTrivia, useApp } from "@/lib/store";

const POR_PARTIDA = PARAMETROS.preguntasTrivia;
const SEGUNDOS = 15;

type Fase = "inicio" | "jugando" | "fin";
type Cobro = { estado: "pendiente" | "acreditado" | "repetida" | "error"; monto: number; error?: string };

/**
 * Juego de trivia. Se usa en la página /trivia y dentro de TriviaModal.
 * `onTerminar`: si existe (modo ventana), el botón final devuelve al usuario a donde estaba.
 */
export function TriviaJuego({ onTerminar, textoTerminar = "Volver" }: { onTerminar?: () => void; textoTerminar?: string }) {
  const { acreditarTrivia, saldo } = useApp();
  const [fase, setFase] = useState<Fase>("inicio");
  const [partida, setPartida] = useState("");
  const [orden, setOrden] = useState<number[]>([]);
  const [i, setI] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [elegida, setElegida] = useState<number | null>(null);
  const [tiempo, setTiempo] = useState(SEGUNDOS);
  const [cobro, setCobro] = useState<Cobro | null>(null);
  const cobrada = useRef("");

  const pregunta = useMemo(() => PREGUNTAS[orden[i]], [orden, i]);

  const iniciar = () => {
    setOrden([...PREGUNTAS.keys()].sort(() => Math.random() - 0.5).slice(0, POR_PARTIDA));
    setPartida("T-" + Date.now().toString(36).toUpperCase());
    setI(0);
    setAciertos(0);
    setElegida(null);
    setTiempo(SEGUNDOS);
    setCobro(null);
    setFase("jugando");
  };

  const responder = (op: number) => {
    if (elegida !== null) return;
    setElegida(op);
    if (op === pregunta.correcta) setAciertos((a) => a + 1);
    setTimeout(() => {
      if (i + 1 >= POR_PARTIDA) {
        setCobro({ estado: "pendiente", monto: 0 });
        setFase("fin");
      } else {
        setI(i + 1);
        setElegida(null);
        setTiempo(SEGUNDOS);
      }
    }, 900);
  };

  // Tiempo límite por pregunta (en producción lo controla Redis con TTL por sesión de trivia)
  useEffect(() => {
    if (fase !== "jugando" || elegida !== null) return;
    const t = setTimeout(() => {
      if (tiempo <= 1) {
        setTiempo(0);
        responder(-1);
      } else setTiempo((s) => s - 1);
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, tiempo, elegida]);

  // Acredita el premio una sola vez por partida (con la API, el servidor calcula el monto).
  useEffect(() => {
    if (fase !== "fin" || cobrada.current === partida) return;
    cobrada.current = partida;
    acreditarTrivia(partida, aciertos).then((r) =>
      setCobro({ estado: r.error ? "error" : r.ok ? "acreditado" : "repetida", monto: r.monto, error: r.error }),
    );
  }, [fase, partida, aciertos, acreditarTrivia]);

  const ganados = cobro?.estado === "acreditado" ? cobro.monto : premioTrivia(aciertos);

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className={`rounded-md border p-2 sm:p-2.5 ${n === 3 ? "border-oro/50 bg-oro/10" : "border-borde bg-panel"}`}>
            <p className="etiqueta">
              {n} de {POR_PARTIDA}
            </p>
            <p className={`mt-0.5 text-base font-black sm:text-lg ${n === 3 ? "text-oro" : "text-tinta"}`}>{premioTrivia(n)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 min-h-72 rounded-xl border border-rojo/40 bg-gradient-to-br from-panel via-panel to-vino/40 p-5 sm:p-7">
        {fase === "inicio" && (
          <div className="grid h-full place-items-center py-8 text-center">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl border border-rojo/50 bg-vino text-3xl">🎬</div>
              <p className="etiqueta mt-4">
                {POR_PARTIDA} preguntas · {SEGUNDOS} s cada una · saldo actual ◆ {saldo}
              </p>
              <button onClick={iniciar} className="btn-vino mt-5 px-8">
                Comenzar partida
              </button>
            </div>
          </div>
        )}

        {fase === "jugando" && pregunta && (
          <>
            <div className="etiqueta mb-3 flex items-center justify-between">
              <span>
                Pregunta {i + 1}/{POR_PARTIDA}
              </span>
              <span className={`text-base font-black ${tiempo <= 5 ? "text-salmon" : "text-oro"}`}>{tiempo}s</span>
            </div>
            {/* Barra de tiempo con scaleX (compositor) en lugar de width (layout) */}
            <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-fondo">
              <m.div
                className={`h-full origin-left ${tiempo <= 5 ? "bg-rojo" : "bg-oro"}`}
                animate={{ scaleX: tiempo / SEGUNDOS }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
            <AnimatePresence mode="wait">
              <m.div key={i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <h2 className="text-base font-bold leading-snug sm:text-lg">{pregunta.texto}</h2>
                <div className="mt-4 grid gap-2">
                  {pregunta.opciones.map((op, k) => {
                    const estado =
                      elegida === null
                        ? "hover:border-arena active:scale-[0.98]"
                        : k === pregunta.correcta
                          ? "!border-oro bg-oro/15 text-oro"
                          : k === elegida
                            ? "!border-rojo bg-vino text-salmon"
                            : "opacity-40";
                    return (
                      <button
                        key={k}
                        onClick={() => responder(k)}
                        className={`rounded-md border border-borde bg-fondo px-4 py-3 text-left text-sm font-semibold transition-[transform,opacity,border-color,background-color] ${estado}`}
                      >
                        <span className="mr-2 font-black text-arena">{"ABCD"[k]}.</span>
                        {op}
                        {elegida !== null && k === pregunta.correcta && <span className="float-right">✓</span>}
                        {elegida === k && k !== pregunta.correcta && <span className="float-right">✕</span>}
                      </button>
                    );
                  })}
                </div>
              </m.div>
            </AnimatePresence>
          </>
        )}

        {fase === "fin" && (
          <m.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl border border-oro/50 bg-oro/10 text-3xl">
              {aciertos === POR_PARTIDA ? "🏆" : ganados ? "🎉" : "🍿"}
            </div>
            <h2 className="titulo mt-4 text-xl">
              {aciertos === POR_PARTIDA ? `¡Pleno! Ganaste ${ganados} créditos` : ganados ? `¡Ganaste ${ganados} créditos!` : "Esta vez no ganaste créditos"}
            </h2>
            <p className="mt-1 text-sm text-tenue">
              {aciertos} de {POR_PARTIDA} respuestas correctas · Partida {partida}
            </p>
            <p className="mt-2 text-xs" aria-live="polite">
              {cobro?.estado === "pendiente" && <span className="text-tenue">Acreditando…</span>}
              {cobro?.estado === "acreditado" && cobro.monto > 0 && <span className="text-oro">Acreditados. Saldo actual: ◆ {saldo}</span>}
              {cobro?.estado === "repetida" && cobro.monto > 0 && <span className="text-tenue">Esta partida ya se había acreditado.</span>}
              {cobro?.estado === "error" && <span className="text-salmon">No se pudo acreditar: {cobro.error}</span>}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button onClick={iniciar} className="btn-borde">
                Jugar otra vez
              </button>
              {onTerminar ? (
                <button onClick={onTerminar} className="btn-vino">
                  {textoTerminar}
                </button>
              ) : (
                <Link href="/" className="btn-vino">
                  Ir a comprar
                </Link>
              )}
            </div>
          </m.div>
        )}
      </div>
    </div>
  );
}
