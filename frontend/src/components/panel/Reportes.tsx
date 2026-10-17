"use client";

import { Download } from "lucide-react";
import { Boton } from "@/components/ui/Boton";
import { pelicula, sala } from "@/data/catalogo";
import { fmtFecha, fmtHora } from "@/utils/formato";
import { useMetricas, useOcupacionVigente, useFilasVentas } from "@/hooks/usePanelDatos";
import { csvVentas } from "@/utils/csv";
import { card, thCls, Kpi } from "@/components/panel/Elementos";

/* ─────────── Reportes (RF-13, RF-47, RF-48) ─────────── */
export function Reportes() {
  const met = useMetricas();
  useOcupacionVigente();
  const filas = useFilasVentas(met);
  const total = filas.reduce((a, r) => a + r.ingresos, 0);
  const boletos = filas.reduce((a, r) => a + r.vendidos, 0);
  const ocupacionProm = Math.round((boletos / Math.max(filas.reduce((a, r) => a + r.cap, 0), 1)) * 100);
  const exportar = () => csvVentas(filas);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi titulo="Boletos vendidos" valor={boletos.toLocaleString("es-GT")} detalle={`${filas.length} funciones`} />
        <Kpi titulo="Ocupación promedio" valor={`${ocupacionProm}%`} detalle="sobre el aforo total" />
        <Kpi titulo="Ingresos" valor={total.toLocaleString("es-GT")} sufijo="créditos" detalle="boletos" />
      </div>
      <div className={`${card} overflow-x-auto`}>
        <div className="mb-4 flex items-center justify-between">
          <p className="etiqueta">Detalle por función</p>
          <Boton variante="borde" tamano="sm" icono={Download} onClick={exportar}>
            Exportar CSV
          </Boton>
        </div>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-borde">
            <tr>
              <th className={thCls}>Película</th>
              <th className={thCls}>Función</th>
              <th className={`${thCls} text-right`}>Vendidos</th>
              <th className={`${thCls} w-44`}>Ocupación</th>
              <th className={`${thCls} text-right`}>Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => {
              const pct = Math.round((r.vendidos / r.cap) * 100);
              return (
                <tr key={r.f.id} className="border-b border-borde/60 last:border-0">
                  <td className="py-2.5 pr-3 font-bold">{pelicula(r.f.peliculaId).titulo}</td>
                  <td className="pr-3 text-xs text-tenue">
                    {sala(r.f.salaId).nombre} · {fmtFecha(r.f.inicio)} {fmtHora(r.f.inicio)}
                  </td>
                  <td className="pr-3 text-right">
                    {r.vendidos}/{r.cap}
                  </td>
                  <td className="pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-fondo">
                        <div className="h-full origin-left rounded-full bg-rojo" style={{ transform: `scaleX(${pct / 100})` }} />
                      </div>
                      <span className="w-9 text-right text-xs font-bold">{pct}%</span>
                    </div>
                  </td>
                  <td className="text-right font-bold text-oro">{r.ingresos}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
