"use client";

import { CircleCheck, CircleX, ScanLine } from "lucide-react";
import { useState } from "react";
import { m } from "framer-motion";
import { pelicula, sala } from "@/data/catalogo";
import { fmtHora } from "@/utils/formato";
import { useApp } from "@/store/AppProvider";
import type { Validacion } from "@/types/cuenta";
import { card } from "@/components/panel/Elementos";

/* ─────────── Validar acceso (RF-09, RF-27, RF-28) ─────────── */
export function Validar() {
  const { validarBoleto, cuentas, funciones, modoApi } = useApp();
  const [codigo, setCodigo] = useState("");
  const [res, setRes] = useState<Validacion | null>(null);
  const [validando, setValidando] = useState(false);
  // Con la API, la validación es atómica en PostgreSQL (POST /api/boletos/{token}/validar).
  const validar = async (c = codigo) => {
    if (!c.trim() || validando) return;
    setValidando(true);
    try {
      setRes(await validarBoleto(c.trim()));
    } finally {
      setValidando(false);
    }
  };
  const f = res?.boleto && funciones.find((x) => x.id === res.boleto!.funcionId);
  const recientes =
    modoApi === "conectado"
      ? []
      : Object.values(cuentas)
          .flatMap((c) => c.boletos)
          .sort((a, b) => b.emitido.localeCompare(a.emitido))
          .slice(0, 5);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className={`${card} space-y-4`}>
        <label className="etiqueta block">
          Código del boleto (lector QR en modo teclado)
          <input autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && validar()} placeholder="CE-…" className="campo normal-case tracking-normal" />
        </label>
        <button onClick={() => validar()} disabled={validando} className="btn-vino w-full py-3.5 disabled:opacity-60">
          <ScanLine aria-hidden className="h-4 w-4" />
          {validando ? "Validando…" : "Validar"}
        </button>
        {modoApi === "conectado" && (
          <p className="text-xs text-apagado">Conectado a la API: pega el token de un boleto comprado (Mis Entradas → abrir QR). Cada boleto sólo puede validarse una vez.</p>
        )}
        {recientes.length > 0 && (
          <div>
            <p className="etiqueta mb-1.5">Boletos emitidos recientemente (para probar)</p>
            {recientes.map((b) => (
              <button key={b.token} onClick={() => { setCodigo(b.token); validar(b.token); }} className="block truncate py-0.5 text-xs text-salmon hover:text-white">
                {b.token} · {b.asiento} · {b.titular}
              </button>
            ))}
          </div>
        )}
      </div>
      {res && (
        <m.div
          key={JSON.stringify(res)}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`grid place-items-center rounded-xl border p-8 text-center ${res.ok ? "border-oro/50 bg-oro/10" : "border-rojo/60 bg-vino/50"}`}
        >
          <div>
            <div className={`mx-auto w-fit ${res.ok ? "text-oro" : "text-salmon"}`}>{res.ok ? <CircleCheck aria-hidden className="h-16 w-16" /> : <CircleX aria-hidden className="h-16 w-16" />}</div>
            <p className="titulo mt-2 text-xl">{res.motivo}</p>
            {f && (
              <p className="mt-1 text-sm text-tenue">
                {pelicula(f.peliculaId).titulo} · {sala(f.salaId).nombre} · {fmtHora(f.inicio)} · Butaca {res.boleto!.asiento}
              </p>
            )}
            {res.boleto?.titular && <p className="mt-1 text-xs text-apagado">Titular: {res.boleto.titular}</p>}
          </div>
        </m.div>
      )}
    </div>
  );
}
