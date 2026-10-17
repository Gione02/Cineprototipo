import { pelicula, sala } from "@/data/catalogo";
import { fmtFecha, fmtHora } from "@/utils/formato";
import type { FilaVenta } from "@/hooks/usePanelDatos";

// CSV con comillas y BOM para que Excel respete los acentos.
export function descargarCsv(nombre: string, filas: (string | number)[][]) {
  const celda = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${nombre}_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const csvVentas = (filas: FilaVenta[]) =>
  descargarCsv("reporte_ventas", [
    ["fecha", "pelicula", "sala", "funcion", "vendidos", "aforo", "ocupacion", "ingresos_creditos"],
    ...filas.map((r) => [fmtFecha(r.f.inicio), pelicula(r.f.peliculaId).titulo, sala(r.f.salaId).nombre, fmtHora(r.f.inicio), r.vendidos, r.cap, `${Math.round((r.vendidos / r.cap) * 100)}%`, r.ingresos]),
  ]);
