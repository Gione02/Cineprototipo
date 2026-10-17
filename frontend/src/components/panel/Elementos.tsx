"use client";

import { ShieldAlert, type LucideIcon } from "lucide-react";

// Piezas visuales del panel: tarjetas, cajas con encabezado, KPI y mini-gráficas.

export const card = "tarjeta p-5";
export const thCls = "etiqueta pb-3 pr-3 text-left font-bold";

// Panel delimitado del dashboard: borde y fondo propios, encabezado con título, subtítulo y acción.
export function Caja({ icono: Icono, titulo, sub, accion, children, className = "" }: { icono: LucideIcon; titulo: string; sub?: string; accion?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-borde bg-panel/50 p-5 sm:p-6 ${className}`}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-borde/70 pb-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-borde bg-panel-2 text-arena">
            <Icono aria-hidden className="h-4 w-4" />
          </span>
          <div>
            <h2 className="titulo text-base sm:text-lg">{titulo}</h2>
            {sub && <p className="text-xs text-tenue">{sub}</p>}
          </div>
        </div>
        {accion}
      </header>
      {children}
    </section>
  );
}

export function Kpi({ titulo, valor, sufijo, detalle, alerta, children }: { titulo: string; valor: string; sufijo?: string; detalle: string; alerta?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`tarjeta flex flex-col p-5 ${alerta ? "border-rojo/40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="etiqueta">{titulo}</p>
        {alerta && <span className="grid h-7 w-7 place-items-center rounded border border-rojo/60 bg-vino text-xs text-salmon">
            <ShieldAlert aria-hidden className="h-3.5 w-3.5" />
          </span>}
      </div>
      <p className="mt-2 text-4xl font-black tabular-nums">
        {valor}
        {sufijo && <span className="ml-1.5 text-xs font-semibold text-tenue">{sufijo}</span>}
      </p>
      <div className="mt-auto pt-4">
        {children}
        <p className="mt-2 text-[11px] text-tenue">{detalle}</p>
      </div>
    </div>
  );
}

export function Sparkline({ datos }: { datos: number[] }) {
  const max = Math.max(...datos);
  const min = Math.min(...datos);
  const pts = datos.map((v, i) => `${(i / (datos.length - 1)) * 100},${30 - ((v - min) / Math.max(max - min, 1)) * 26 - 2}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none" aria-label="Tendencia de reservas por minuto">
      <polyline points={pts} fill="none" stroke="#c8372d" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function Barra({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-fondo">
      <div className="h-full origin-left rounded-full bg-arena" style={{ transform: `scaleX(${Math.max(2, Math.min(100, pct)) / 100})` }} />
    </div>
  );
}
