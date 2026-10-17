"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/store/AppProvider";
import { Modal } from "@/components/ui/Modal";
import { TriviaJuego } from "@/components/trivia/TriviaJuego";

/**
 * Trivia en ventana emergente. Se abre encima de la compra (z-[57] > z-50 de "Finalizar compra")
 * sin desmontar la página: la reserva, las butacas y el temporizador siguen intactos y, al cerrar,
 * el usuario vuelve exactamente a la pantalla de pago con el saldo ya actualizado.
 */
export default function TriviaModal() {
  const { triviaAbierta, cerrarTrivia, reserva, usuario } = useApp();
  return (
    <Modal abierto={triviaAbierta && !!usuario} onCerrar={cerrarTrivia} titulo="Trivia de cine · gana créditos" ancho="max-w-xl" z="z-[57]">
      {reserva && <AvisoReserva expira={reserva.expira} butacas={reserva.asientos.length} />}
      <TriviaJuego onTerminar={cerrarTrivia} textoTerminar={reserva ? "Volver a mi compra" : "Listo"} />
    </Modal>
  );
}

// El reloj vive en su propio componente: sólo él se vuelve a pintar cada segundo.
function AvisoReserva({ expira, butacas }: { expira: number; butacas: number }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, expira - ahora);
  return (
    <p className="mb-4 rounded-md border border-rojo/50 bg-vino/40 px-3 py-2 text-xs text-salmon">
      <Timer aria-hidden className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
      Tu reserva de {butacas} butaca{butacas === 1 ? "" : "s"} sigue activa:{" "}
      <b className="tabular-nums">
        {Math.floor(ms / 60000)}:{String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}
      </b>
      . Al terminar vuelves a tu compra.
    </p>
  );
}
