"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  titulo?: string;
  children: React.ReactNode;
  ancho?: string;
  cerrable?: boolean; // false: no se cierra con Esc ni clic fuera (p. ej. durante un pago)
  z?: string;
};

export function Modal({ abierto, onCerrar, titulo, children, ancho = "max-w-md", cerrable = true, z = "z-50" }: Props) {
  useEffect(() => {
    if (!abierto || !cerrable) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [abierto, cerrable, onCerrar]);

  useEffect(() => {
    if (!abierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [abierto]);

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          className={`fixed inset-0 ${z} overflow-y-auto bg-black/75 backdrop-blur-sm`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* min-h-full + flex: centra la ventana, y si es más alta que la pantalla se desplaza sin cortarse */}
          <div className="flex min-h-full items-center justify-center p-3 sm:p-6" onMouseDown={(e) => cerrable && e.target === e.currentTarget && onCerrar()}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            className={`relative w-full ${ancho} rounded-xl border border-borde bg-panel p-4 shadow-2xl shadow-black/60 sm:p-6`}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
          >
            {(titulo || cerrable) && (
              <div className="mb-4 flex items-start justify-between gap-4">
                {titulo && <h2 className="titulo text-lg">{titulo}</h2>}
                {cerrable && (
                  <button onClick={onCerrar} aria-label="Cerrar" className="-mr-1 -mt-1 rounded-md px-2 py-1 text-tenue hover:bg-panel-2 hover:text-white">
                    ✕
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
