"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PARAMETROS, PREGUNTAS } from "@/lib/data";
import { useApp } from "@/lib/store";

const POR_PARTIDA = PARAMETROS.preguntasTrivia;
const SEGUNDOS = 15;

type Fase = "inicio" | "jugando" | "fin";

export default function Trivia() {
  const { usuario, acreditarTrivia, listo, abrirLogin } = useApp();
  const [fase, setFase] = useState<Fase>("inicio");
  const [partida, setPartida] = useState("");
  const [orden, setOrden] = useState<number[]>([]);
  const [i, setI] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [elegida, setElegida] = useState<number | null>(null);
  const [tiempo, setTiempo] = useState(SEGUNDOS);

  const pregunta = useMemo(() => PREGUNTAS[orden[i]], [orden, i]);

  const iniciar = () => {
    setOrden([...PREGUNTAS.keys()].sort(() => Math.random() - 0.5).slice(0, POR_PARTIDA));
    setPartida("T-" + Date.now().toString(36).toUpperCase());
    setI(0);
    setAciertos(0);
    setElegida(null);
    setTiempo(SEGUNDOS);
    setFase("jugando");
  };

  const responder = (op: number) => {
    if (elegida !== null) return;
    setElegida(op);
    if (op === pregunta.correcta) setAciertos((a) => a + 1);
    setTimeout(() => {
      if (i + 1 >= POR_PARTIDA) setFase("fin");
      else {
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

  // 10 créditos por acierto; si acierta todas, el premio sube a 50.
  const ganados = aciertos === POR_PARTIDA ? PARAMETROS.bonoTriviaPerfecta : aciertos * PARAMETROS.creditosPorRespuesta;
  useEffect(() => {
    if (fase === "fin") acreditarTrivia(partida, ganados);
  }, [fase, partida, ganados, acreditarTrivia]);

  if (listo && !usuario)
    return (
      <div className="tarjeta mx-auto max-w-md p-8 text-center">
        <p className="titulo text-lg">Trivia de cine</p>
        <p className="mt-2 text-sm text-tenue">Inicia sesión para jugar la trivia y ganar créditos.</p>
        <button onClick={() => abrirLogin()} className="btn-vino mt-5">
          Iniciar sesión
        </button>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <p className="etiqueta text-salmon">Programa de créditos Cineight</p>
      <h1 className="titulo mt-1 text-3xl">Trivia de cine</h1>
      <p className="mt-1 text-sm text-tenue">
        {POR_PARTIDA} preguntas, {SEGUNDOS} s cada una. Recarga créditos para comprar tus boletos.
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className={`rounded-md border p-2.5 ${n === 3 ? "border-oro/50 bg-oro/10" : "border-borde bg-panel"}`}>
            <p className="etiqueta">{n} de 3</p>
            <p className={`mt-0.5 text-lg font-black ${n === 3 ? "text-oro" : "text-tinta"}`}>
              {n === 3 ? PARAMETROS.bonoTriviaPerfecta : n * PARAMETROS.creditosPorRespuesta}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 min-h-80 rounded-xl border border-rojo/40 bg-gradient-to-br from-panel via-panel to-vino/40 p-6 sm:p-8">
        {fase === "inicio" && (
          <div className="grid h-full place-items-center py-12 text-center">
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-xl border border-rojo/50 bg-vino text-4xl">🎬</div>
              <p className="etiqueta mt-4">Preguntas sobre las películas de la cartelera</p>
              <button onClick={iniciar} className="btn-vino mt-5 px-8">
                Comenzar partida
              </button>
            </div>
          </div>
        )}

        {fase === "jugando" && pregunta && (
          <>
            <div className="etiqueta mb-4 flex items-center justify-between">
              <span>
                Pregunta {i + 1}/{POR_PARTIDA}
              </span>
              <span className={`text-base font-black ${tiempo <= 5 ? "text-salmon" : "text-oro"}`}>{tiempo}s</span>
            </div>
            <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-fondo">
              <motion.div
                className={`h-full ${tiempo <= 5 ? "bg-rojo" : "bg-oro"}`}
                animate={{ width: `${(tiempo / SEGUNDOS) * 100}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <h2 className="text-lg font-bold leading-snug">{pregunta.texto}</h2>
                <div className="mt-4 grid gap-2">
                  {pregunta.opciones.map((op, k) => {
                    const estado =
                      elegida === null ? "hover:border-arena" : k === pregunta.correcta ? "!border-oro bg-oro/15 text-oro" : k === elegida ? "!border-rojo bg-vino text-salmon" : "opacity-40";
                    return (
                      <motion.button
                        whileHover={elegida === null ? { scale: 1.02 } : undefined}
                        whileTap={{ scale: 0.98 }}
                        key={k}
                        onClick={() => responder(k)}
                        className={`rounded-md border border-borde bg-fondo px-4 py-3 text-left text-sm font-semibold transition ${estado}`}
                      >
                        <span className="mr-2 font-black text-arena">{"ABCD"[k]}.</span>
                        {op}
                        {elegida !== null && k === pregunta.correcta && <span className="float-right">✓</span>}
                        {elegida === k && k !== pregunta.correcta && <span className="float-right">✕</span>}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {fase === "fin" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-xl border border-oro/50 bg-oro/10 text-4xl">{aciertos === POR_PARTIDA ? "🏆" : ganados ? "🎉" : "🍿"}</div>
            <h2 className="titulo mt-4 text-xl">{aciertos === POR_PARTIDA ? `¡Pleno! Ganaste ${ganados} créditos` : ganados ? `¡Ganaste ${ganados} créditos!` : "Esta vez no ganaste créditos"}</h2>
            <p className="mt-1 text-sm text-tenue">
              {aciertos} de {POR_PARTIDA} respuestas correctas · Partida {partida}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button onClick={iniciar} className="btn-vino">
                Jugar otra vez
              </button>
              <Link href="/" className="btn-borde">
                Ir a comprar
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
