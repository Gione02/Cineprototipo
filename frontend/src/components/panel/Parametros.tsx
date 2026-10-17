"use client";

import { Save } from "lucide-react";
import { PARAMETROS } from "@/data/parametros";
import { useState } from "react";
import { useApp } from "@/store/AppProvider";
import { card } from "@/components/panel/Elementos";

/* ─────────── Parámetros (RF-57) ─────────── */
export function Parametros() {
  const { registrar, toast } = useApp();
  const [vals, setVals] = useState<Record<string, number>>({ ...PARAMETROS });
  const NOMBRES: Record<string, string> = {
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
  return (
    <div className={`${card} max-w-3xl space-y-3`}>
      {Object.entries(vals).map(([k, v]) => (
        <label key={k} className="flex items-center justify-between gap-4 border-b border-borde pb-3 text-sm">
          <span>{NOMBRES[k] ?? k}</span>
          <input
            type="number"
            step={k === "iva" ? 0.01 : 1}
            value={v}
            onChange={(e) => setVals({ ...vals, [k]: +e.target.value })}
            className="w-24 rounded-md border border-borde bg-fondo px-2 py-1.5 text-right font-bold text-oro outline-none focus:border-arena"
          />
        </label>
      ))}
      <button onClick={() => { registrar("PARAMETROS_ACTUALIZADOS", JSON.stringify(vals)); toast("Parámetros guardados (registrado en bitácora).", "ok"); }} className="btn-vino">
        <Save aria-hidden className="h-4 w-4" />
        Guardar cambios
      </button>
      <p className="text-xs text-apagado">En el prototipo solo se registra el cambio en la bitácora; el backend los guardaría en la tabla parametros_globales.</p>
    </div>
  );
}
