"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { useApp } from "@/store/AppProvider";
import type { AsientosApi, EventoAsientosApi } from "@/types/api";

export type EstadoConexion = "demo" | "conectando" | "en-vivo" | "reconectando";

/**
 * Mantiene sincronizado el mapa de butacas de una función.
 *
 * Con la API conectada abre un EventSource a GET /api/funciones/{id}/stream:
 *   - "estado": foto completa (vendidas + retenidas) al conectar o reconectar.
 *   - "asientos": cada cambio (bloqueado / liberado / vendido) de cualquier cliente, en cuanto ocurre.
 * El navegador reintenta solo si se corta; mientras tanto se consulta la ocupación cada 5 s como respaldo.
 *
 * `onEvento` recibe cada cambio para que la página reaccione (p. ej. quitar de la selección una butaca que expiró).
 */
export function useAsientosEnVivo(funcionId: string | undefined, onEvento?: (ev: EventoAsientosApi) => void): EstadoConexion {
  const { modoApi, cargarOcupacion, fijarOcupacion, aplicarEventoAsientos } = useApp();
  const [estado, setEstado] = useState<EstadoConexion>("conectando");
  const callback = useRef(onEvento);
  useEffect(() => {
    callback.current = onEvento;
  }, [onEvento]);

  useEffect(() => {
    if (!funcionId || modoApi !== "conectado" || typeof EventSource === "undefined") return;
    const fuente = new EventSource(api.urlStream(funcionId));
    let respaldo: ReturnType<typeof setInterval> | null = null;
    const iniciarRespaldo = () => {
      respaldo ??= setInterval(() => cargarOcupacion([funcionId]), 5000);
    };
    const detenerRespaldo = () => {
      if (respaldo) clearInterval(respaldo);
      respaldo = null;
    };

    fuente.addEventListener("estado", (e) => {
      fijarOcupacion(funcionId, JSON.parse((e as MessageEvent<string>).data) as AsientosApi);
      setEstado("en-vivo");
      detenerRespaldo();
    });
    fuente.addEventListener("asientos", (e) => {
      const ev = JSON.parse((e as MessageEvent<string>).data) as EventoAsientosApi;
      aplicarEventoAsientos({ ...ev, funcion: funcionId });
      callback.current?.({ ...ev, funcion: funcionId });
    });
    fuente.onerror = () => {
      setEstado("reconectando");
      iniciarRespaldo();
    };

    return () => {
      fuente.close();
      detenerRespaldo();
    };
  }, [funcionId, modoApi, cargarOcupacion, fijarOcupacion, aplicarEventoAsientos]);

  return modoApi === "conectado" ? estado : modoApi === "local" ? "demo" : "conectando";
}
