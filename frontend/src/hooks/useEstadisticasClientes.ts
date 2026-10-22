"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/AppProvider";
import { api } from "@/services/api";
import type { HistorialClienteApi } from "@/types/api";
import { completarFicha, perfilCliente, resumenClientes, type ClienteHistorial } from "@/utils/estadisticas";

const REFRESCO_MS = 30000;

/**
 * Historial de compras de los clientes con sus preferencias calculadas.
 * GET /api/clientes/historial (PostgreSQL) cada 30 s; la ficha (género, director, reparto) se completa con el catálogo.
 */
export function useEstadisticasClientes() {
  const { peliculas } = useApp();
  const [remoto, setRemoto] = useState<HistorialClienteApi[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    const traer = () =>
      api
        .historialClientes()
        .then((r) => {
          if (!vivo) return;
          setRemoto(r);
          setError("");
        })
        .catch((e: Error) => vivo && setError(e.message));
    traer();
    const t = setInterval(traer, REFRESCO_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const perfiles = useMemo(() => {
    const ficha = new Map(peliculas.map((p) => [p.id, p]));
    return (remoto ?? []).map(deApi).map((h) => perfilCliente({ ...h, compras: h.compras.map((c) => completarFicha(c, ficha.get(c.peliculaId))) }));
  }, [remoto, peliculas]);

  const resumen = useMemo(() => resumenClientes(perfiles), [perfiles]);

  return { perfiles, resumen, cargando: remoto === null && !error, error };
}

const deApi = (h: HistorialClienteApi): ClienteHistorial => ({
  correo: h.correo,
  nombre: h.nombre,
  activo: h.activo,
  creado: h.creado,
  saldo: h.saldo,
  compras: h.peliculas.map((p) => ({
    peliculaId: p.pelicula,
    titulo: p.titulo,
    genero: p.genero,
    director: p.director,
    reparto: p.reparto,
    boletos: p.boletos,
    visitas: p.funciones,
    gastado: p.gastado,
    ultima: p.ultima,
  })),
});
