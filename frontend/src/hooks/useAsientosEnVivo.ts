"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { useApp } from "@/store/AppProvider";
import type { AsientosApi, EventoAsientosApi } from "@/types/api";

export type EstadoConexion = "conectando" | "en-vivo" | "reconectando";

/** Esperas de reconexión: 1 s, 2 s, 4 s… hasta 30 s, con ±30 % de variación para que los clientes no reconecten a la vez. */
const ESPERA_INICIAL_MS = 1000;
const ESPERA_MAXIMA_MS = 30000;
export const esperaReconexion = (intento: number, azar = Math.random()) =>
  Math.round(Math.min(ESPERA_MAXIMA_MS, ESPERA_INICIAL_MS * 2 ** intento) * (0.7 + azar * 0.6));

/**
 * Mantiene sincronizado el mapa de butacas de una función.
 *
 * Con la API conectada abre un EventSource a GET /api/funciones/{id}/stream:
 *   - "estado": foto completa (vendidas + retenidas) al conectar o reconectar.
 *   - "asientos": cada cambio (bloqueado / liberado / vendido) de cualquier cliente, en cuanto ocurre.
 *
 * Si el canal falla se cierra y se reintenta con espera exponencial (no con la reconexión inmediata del navegador),
 * consultando la ocupación una vez por intento para que el mapa no quede congelado. Sin conexión a internet no se
 * intenta nada; al volver la conexión se reconecta de inmediato.
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
    let fuente: EventSource | null = null;
    let reintento: ReturnType<typeof setTimeout> | null = null;
    let intentos = 0;
    let activo = true;

    const cancelarReintento = () => {
      if (reintento) clearTimeout(reintento);
      reintento = null;
    };

    const programarReintento = () => {
      cancelarReintento();
      if (!activo || !navigator.onLine) return; // sin red se espera al evento "online"
      reintento = setTimeout(conectar, esperaReconexion(intentos));
      intentos += 1;
    };

    function conectar() {
      reintento = null;
      if (!activo) return;
      fuente?.close();
      cargarOcupacion([funcionId!]);
      const es = new EventSource(api.urlStream(funcionId!));
      fuente = es;
      es.addEventListener("estado", (e) => {
        fijarOcupacion(funcionId!, JSON.parse((e as MessageEvent<string>).data) as AsientosApi);
        intentos = 0;
        setEstado("en-vivo");
      });
      es.addEventListener("asientos", (e) => {
        const ev = JSON.parse((e as MessageEvent<string>).data) as EventoAsientosApi;
        aplicarEventoAsientos({ ...ev, funcion: funcionId! });
        callback.current?.({ ...ev, funcion: funcionId! });
      });
      es.onerror = () => {
        es.close();
        if (fuente !== es) return;
        fuente = null;
        setEstado("reconectando");
        programarReintento();
      };
    }

    const enLinea = () => {
      intentos = 0;
      cancelarReintento();
      conectar();
    };
    const sinRed = () => {
      cancelarReintento();
      fuente?.close();
      fuente = null;
      setEstado("reconectando");
    };
    // Al salir de la página el navegador puede congelarla en la caché de ida y vuelta (bfcache) sin desmontar React:
    // si el canal quedara abierto, cada recarga o "atrás" dejaría una conexión viva y, al llegar al límite de 6
    // conexiones por servidor de HTTP/1.1, todas las demás solicitudes a la API quedarían esperando.
    const alOcultar = () => {
      cancelarReintento();
      fuente?.close();
      fuente = null;
    };
    const alMostrar = (e: PageTransitionEvent) => {
      if (e.persisted) enLinea();
    };

    window.addEventListener("online", enLinea);
    window.addEventListener("offline", sinRed);
    window.addEventListener("pagehide", alOcultar);
    window.addEventListener("pageshow", alMostrar);
    conectar();

    return () => {
      activo = false;
      cancelarReintento();
      fuente?.close();
      window.removeEventListener("online", enLinea);
      window.removeEventListener("offline", sinRed);
      window.removeEventListener("pagehide", alOcultar);
      window.removeEventListener("pageshow", alMostrar);
    };
  }, [funcionId, modoApi, cargarOcupacion, fijarOcupacion, aplicarEventoAsientos]);

  return modoApi === "conectado" ? estado : "conectando";
}
