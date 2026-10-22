"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { useBloqueoScroll } from "@/hooks/useBloqueoScroll";
import { BotonIcono } from "./Boton";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  titulo?: string;
  /** Nombre accesible cuando la ventana no muestra título (lo anuncian los lectores de pantalla). */
  etiqueta?: string;
  children: React.ReactNode;
  ancho?: string;
  cerrable?: boolean; // false: no se cierra con Esc ni clic fuera (p. ej. durante un pago)
  z?: string;
};

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ventana emergente accesible (patrón de diálogo modal de WAI-ARIA):
 * - Nombre accesible (título visible o `etiqueta`).
 * - Al abrir, el foco entra a la ventana (primer campo o primer control); Tab y Shift+Tab quedan dentro.
 * - Esc cierra la ventana superior; al cerrar, el foco vuelve al control que la abrió.
 * - Bloquea el scroll del fondo y se cierra con clic fuera (si es cerrable).
 */
export function Modal({ abierto, onCerrar, titulo, etiqueta, children, ancho = "max-w-md", cerrable = true, z = "z-50" }: Props) {
  useBloqueoScroll(abierto);
  const dialogo = useRef<HTMLDivElement>(null);
  const idTitulo = useId();

  // Gestión del foco: entra al abrir y vuelve al elemento anterior al cerrar.
  useEffect(() => {
    if (!abierto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const t = requestAnimationFrame(() => {
      const d = dialogo.current;
      if (!d || d.contains(document.activeElement)) return;
      const campo = d.querySelector<HTMLElement>("input:not([type=hidden]):not([tabindex='-1']), select, textarea");
      const primero = campo ?? d.querySelector<HTMLElement>(ENFOCABLES);
      (primero ?? d).focus();
    });
    return () => {
      cancelAnimationFrame(t);
      if (anterior?.isConnected) anterior.focus();
    };
  }, [abierto]);

  const teclado = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && cerrable) {
      e.stopPropagation();
      onCerrar();
      return;
    }
    if (e.key !== "Tab" || !dialogo.current) return;
    const enfocables = [...dialogo.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (enfocables.length === 0) return e.preventDefault();
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (e.shiftKey && (document.activeElement === primero || document.activeElement === dialogo.current)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

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
              ref={dialogo}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titulo ? idTitulo : undefined}
              aria-label={titulo ? undefined : etiqueta}
              tabIndex={-1}
              onKeyDown={teclado}
              className={`relative w-full ${ancho} rounded-xl border border-borde bg-panel p-4 shadow-2xl shadow-black/60 outline-none sm:p-6`}
              // Sólo transform y opacity: se animan en el compositor, sin recalcular layout.
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
            >
              {titulo ? (
                <div className="mb-4 flex items-start justify-between gap-4">
                  <h2 id={idTitulo} className="titulo text-lg">
                    {titulo}
                  </h2>
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
