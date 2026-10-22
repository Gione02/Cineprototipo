"use client";

import { AnimatePresence, m } from "framer-motion";
import { CircleCheck, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Boton } from "@/components/ui/Boton";

export type Toast = { id: number; texto: string; tipo: "ok" | "error" | "info" };
export type Aviso = { titulo: string; texto: string; icono: LucideIcon };

/** Mensajes breves apilados en la esquina inferior derecha (se anuncian a lectores de pantalla). */
export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <m.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            className={`rounded-lg border px-4 py-3 text-sm shadow-xl backdrop-blur ${
              t.tipo === "ok" ? "border-oro/40 bg-panel/95 text-tinta" : t.tipo === "error" ? "border-rojo/60 bg-vino/95 text-salmon" : "border-borde bg-panel/95 text-tinta"
            }`}
          >
            {t.tipo === "ok" && <CircleCheck aria-hidden className="mr-2 inline h-4 w-4 align-[-3px] text-oro" />}
            {t.texto}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Aviso importante que requiere confirmación (sesión expirada, reserva vencida, cuenta dada de baja). */
export function VentanaAviso({ aviso, onCerrar }: { aviso: Aviso | null; onCerrar: () => void }) {
  return (
    <Modal abierto={!!aviso} onCerrar={onCerrar} z="z-[60]" etiqueta={aviso?.titulo}>
      {aviso && (
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-rojo/50 bg-vino text-salmon">
            <aviso.icono aria-hidden className="h-6 w-6" />
          </div>
          <h2 className="titulo mt-3 text-2xl">{aviso.titulo}</h2>
          <p className="mt-2 text-sm text-tenue">{aviso.texto}</p>
          <Boton onClick={onCerrar} className="mt-5 w-full">
            Entendido
          </Boton>
        </div>
      )}
    </Modal>
  );
}
