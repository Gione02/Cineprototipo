"use client";

import { useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { useBloqueoScroll } from "@/hooks/useBloqueoScroll";
import { BotonIcono } from "./Boton";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  titulo?: string;
  children: React.ReactNode;
  ancho?: string;
  cerrable?: boolean; // false: no se cierra con Esc ni clic fuera (p. ej. durante un pago)
  z?: string;
};

/** Ventana emergente accesible: bloquea el scroll de fondo, cierra con Esc o clic fuera (si es cerrable). */
export function Modal({ abierto, onCerrar, titulo, children, ancho = "max-w-md", cerrable = true, z = "z-50" }: Props) {
  useBloqueoScroll(abierto);

  useEffect(() => {
    if (!abierto || !cerrable) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [abierto, cerrable, onCerrar]);

  return (
    <AnimatePresence>
      {abierto && (
        <m.div
          className={`fixed inset-0 ${z} overflow-y-auto overscroll-contain bg-black/75 backdrop-blur-sm`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* min-h-full + flex: centra la ventana, y si es más alta que la pantalla se desplaza sin cortarse */}
          <div className="flex min-h-full items-center justify-center p-3 sm:p-6" onMouseDown={(e) => cerrable && e.target === e.currentTarget && onCerrar()}>
            <m.div
              role="dialog"
              aria-modal="true"
              aria-label={titulo}
              className={`relative w-full ${ancho} rounded-xl border border-borde bg-panel p-4 shadow-2xl shadow-black/60 sm:p-6`}
              // Sólo transform y opacity: se animan en el compositor, sin recalcular layout.
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
            >
              {titulo ? (
                <div className="mb-4 flex items-start justify-between gap-4">
                  <h2 className="titulo text-lg">{titulo}</h2>
                  {cerrable && <BotonIcono icono={X} etiqueta="Cerrar" tamano="sm" onClick={onCerrar} className="-mr-1 -mt-1 shrink-0" />}
                </div>
              ) : (
                // Sin título: la X flota en la esquina y no reserva una fila vacía sobre el contenido.
                cerrable && <BotonIcono icono={X} etiqueta="Cerrar" tamano="sm" onClick={onCerrar} className="absolute right-3 top-3 z-10" />
              )}
              {children}
            </m.div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
