"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { PARAMETROS } from "@/lib/data";
import { useApp } from "@/lib/store";

const CLAVE = "cineight-aviso-trivia";

// Recordatorio discreto: la trivia sólo se abre desde la píldora de créditos del encabezado.
export function AvisoTrivia() {
  const { usuario, saldo, abrirTrivia, triviaAbierta } = useApp();
  const ruta = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (usuario?.rol !== "cliente" || ruta === "/trivia") return;
    let descartado = false;
    try {
      descartado = sessionStorage.getItem(CLAVE) === "1";
    } catch {}
    if (descartado) return;
    const t = setTimeout(() => setVisible(true), saldo < PARAMETROS.costoBoleto ? 800 : 4000);
    return () => clearTimeout(t);
  }, [usuario, ruta, saldo]);

  const cerrar = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(CLAVE, "1");
    } catch {}
  };

  const mostrar = visible && !triviaAbierta && usuario?.rol === "cliente" && ruta !== "/trivia";

  return (
    <AnimatePresence>
      {mostrar && (
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-20 left-4 z-40 flex lg:bottom-4 w-[min(88vw,310px)] items-start gap-3 rounded-lg border border-rojo/50 bg-panel/95 p-3 text-sm shadow-xl shadow-black/50 backdrop-blur"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-rojo/50 bg-vino text-sm">🎬</span>
          <div className="flex-1">
            <p className="text-xs leading-relaxed text-tinta">
              {saldo < PARAMETROS.costoBoleto ? "¿Te faltan créditos?" : "¿Sabías que…?"} Toca <b className="text-oro">◆ tus créditos</b> arriba y
              juega la trivia: hasta <b className="text-oro">{PARAMETROS.bonoTriviaPerfecta} créditos</b> por partida.
            </p>
            <button onClick={() => { cerrar(); abrirTrivia(); }} className="mt-1.5 inline-block text-[10px] font-bold uppercase tracking-[0.14em] text-salmon hover:text-white">
              Jugar ahora →
            </button>
          </div>
          <button onClick={cerrar} aria-label="Cerrar aviso" className="text-tenue hover:text-white">
            ✕
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
