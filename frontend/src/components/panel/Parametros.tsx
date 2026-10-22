"use client";

import { PARAMETROS } from "@/data/parametros";
import { card } from "@/components/panel/Elementos";

const NOMBRES: Record<keyof typeof PARAMETROS, string> = {
  retencionMinutos: "Tiempo de retención de asientos (min)",
  turnoColaMinutos: "Vigencia del turno de la cola (min)",
  maxButacasPorTransaccion: "Máximo de butacas por transacción",
  maxBoletosPorEvento: "Máximo de boletos por cliente (preestreno)",
  limpiezaMinutos: "Tiempo de limpieza entre funciones (min)",
  costoBoleto: "Costo base por boleto (créditos)",
  bonoBienvenida: "Bono de bienvenida por cuenta nueva",
  preguntasTrivia: "Preguntas por partida de trivia",
  creditosPorRespuesta: "Créditos por respuesta correcta (trivia)",
  bonoTriviaPerfecta: "Premio por acertar todas (trivia)",
  inactividadMinutos: "Cierre de sesión por inactividad (min)",
  intentosFallidos: "Intentos fallidos antes de bloquear",
  limiteSolicitudesMin: "Límite de solicitudes por minuto",
  iva: "IVA",
};

/* ─────────── Parámetros vigentes (RF-57) ─────────── */
export function Parametros() {
  return (
    <div className={`${card} max-w-3xl`}>
      <dl className="divide-y divide-borde">
        {(Object.keys(NOMBRES) as (keyof typeof PARAMETROS)[]).map((k) => (
          <div key={k} className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt>{NOMBRES[k]}</dt>
            <dd className="font-bold tabular-nums text-oro">{k === "iva" ? `${Math.round(PARAMETROS.iva * 100)} %` : PARAMETROS[k]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-apagado">
        Valores en vigor. La retención de asientos, la cola virtual y los límites anti-bots se configuran en el servidor
        (variables RETENCION_SEGUNDOS, COLA_TURNO_MINUTOS, COLA_CAPACIDAD y RATE_LIMIT).
      </p>
    </div>
  );
}
