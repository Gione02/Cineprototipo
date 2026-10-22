"use client";

import { RotateCcw, ServerCrash } from "lucide-react";
import { Boton } from "@/components/ui/Boton";

/** Se muestra cuando la API no responde: en lugar de datos inventados, un aviso claro y la opción de reintentar. */
export function ServicioNoDisponible({ configurada, onReintentar }: { configurada: boolean; onReintentar: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="tarjeta max-w-md p-8 text-center">
        <ServerCrash aria-hidden className="mx-auto h-10 w-10 text-salmon" />
        <h1 className="titulo mt-3 text-3xl">Servicio no disponible</h1>
        <p className="mt-2 text-sm text-tenue">
          {configurada
            ? "No pudimos conectar con el servidor de Cineight. Puede estar en mantenimiento; vuelve a intentarlo en unos segundos."
            : "Falta configurar la dirección del servidor (NEXT_PUBLIC_API_URL)."}
        </p>
        {configurada && (
          <Boton icono={RotateCcw} onClick={onReintentar} className="mt-5">
            Reintentar
          </Boton>
        )}
      </div>
    </div>
  );
}
