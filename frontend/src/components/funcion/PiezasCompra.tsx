"use client";

import { Check, Timer } from "lucide-react";
import { PARAMETROS } from "@/data/parametros";
import { mmss, useRestante } from "@/hooks/useRestante";

// Piezas del flujo de compra: temporizadores de la retención, indicador de pasos y desglose del total.

/** Reloj compacto mm:ss (barra inferior en móvil). */
export function Reloj({ expira }: { expira: number }) {
  return <>{mmss(useRestante(expira))}</>;
}

/** Cuenta regresiva de la reserva con barra de progreso. */
export function CuentaReserva({ expira }: { expira: number }) {
  const restante = useRestante(expira);
  const pct = restante / (PARAMETROS.retencionMinutos * 60000);
  return (
    <div className="rounded-md border border-rojo/50 bg-vino/40 p-3">
      <div className="flex items-baseline justify-between">
        <span className="etiqueta flex items-center gap-1.5 text-salmon">
          <Timer aria-hidden className="h-3.5 w-3.5" /> Reserva expira en
        </span>
        <span className={`text-2xl font-black tabular-nums ${pct < 0.2 ? "text-salmon" : "text-tinta"}`}>{mmss(restante)}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-fondo">
        <div className="h-full origin-left bg-rojo transition-transform duration-1000 ease-linear" style={{ transform: `scaleX(${pct})` }} />
      </div>
    </div>
  );
}

const PASOS = ["Película", "Horario", "Butacas", "Pago"] as const;

/** Indicador del recorrido de compra. `actual` es el índice del paso en curso (0 = Película). */
export function PasosCompra({ actual }: { actual: number }) {
  return (
    <ol aria-label="Pasos de la compra" className="flex items-center gap-1.5 text-xs font-semibold sm:gap-2">
      {PASOS.map((p, i) => {
        const hecho = i < actual;
        const enCurso = i === actual;
        return (
          <li key={p} aria-current={enCurso ? "step" : undefined} className="flex items-center gap-1.5 sm:gap-2">
            {i > 0 && <span aria-hidden className={`h-px w-4 sm:w-8 ${hecho || enCurso ? "bg-rojo/70" : "bg-borde"}`} />}
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] ${
                hecho ? "border-oro/50 bg-oro/10 text-oro" : enCurso ? "border-rojo bg-vino text-salmon" : "border-borde text-apagado"
              }`}
            >
              {hecho ? <Check aria-hidden className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`hidden sm:inline ${enCurso ? "text-tinta" : hecho ? "text-tenue" : "text-apagado"}`}>{p}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function DesgloseTotal({ asientos, precio, total }: { asientos: string[]; precio: number; total: number }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-1">
        {asientos.map((a) => (
          <span key={a} className="rounded border border-borde bg-panel-2 px-2 py-0.5 text-xs font-bold">
            {a}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-tenue">
        <span>
          {asientos.length} × {precio} créditos
        </span>
        <span>{total}</span>
      </div>
      <div className="flex justify-between border-t border-borde pt-2 font-bold">
        <span className="uppercase tracking-wide">Total</span>
        <span className="text-oro">{total} créditos</span>
      </div>
    </div>
  );
}
