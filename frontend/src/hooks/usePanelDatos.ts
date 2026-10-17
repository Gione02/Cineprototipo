"use client";

import { useEffect, useState } from "react";
import { finFuncion, sala } from "@/data/catalogo";
import type { Funcion } from "@/types/catalogo";
import { useApp } from "@/store/AppProvider";
import { api } from "@/services/api";
import type { MetricasApi } from "@/types/api";

// Datos compartidos por las secciones del panel de operaciones.

// GET /api/metricas cada 5 s cuando la API está conectada (null en modo demostración).
export function useMetricas() {
  const { modoApi } = useApp();
  const [met, setMet] = useState<MetricasApi | null>(null);
  useEffect(() => {
    if (modoApi !== "conectado") return;
    let vivo = true;
    const traer = () =>
      api
        .metricas()
        .then((r) => vivo && setMet(r))
        .catch(() => {});
    traer();
    const t = setInterval(traer, 5000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [modoApi]);
  return modoApi === "conectado" ? met : null;
}

// Con la API: carga la ocupación real (vendidas + retenidas) de todas las funciones vigentes cada 10 s.
export function useOcupacionVigente() {
  const { funciones, cargarOcupacion } = useApp();
  const codigos = funciones
    .filter((f) => finFuncion(f) > new Date())
    .map((f) => f.id)
    .join(",");
  useEffect(() => {
    if (!codigos) return;
    const ids = codigos.split(",");
    cargarOcupacion(ids);
    const t = setInterval(() => cargarOcupacion(ids), 10000);
    return () => clearInterval(t);
  }, [codigos, cargarOcupacion]);
}

export type FilaVenta = { f: Funcion; vendidos: number; cap: number; ingresos: number };

// Ventas por función: de /api/metricas si hay conexión; si no, de la ocupación simulada.
export function useFilasVentas(met: MetricasApi | null): FilaVenta[] {
  const { funciones, ocupacion } = useApp();
  if (met) {
    const porCodigo = new Map(met.funciones.map((x) => [x.codigo, x]));
    return funciones.flatMap((f) => {
      const x = porCodigo.get(f.id);
      return x ? [{ f, vendidos: x.vendidos, cap: x.aforo, ingresos: x.ingresos }] : [];
    });
  }
  return funciones.map((f) => {
    const vendidos = ocupacion(f.id).vendidos.size;
    return { f, vendidos, cap: sala(f.salaId).aforo, ingresos: vendidos * f.precio };
  });
}
