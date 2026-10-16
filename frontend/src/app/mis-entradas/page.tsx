"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { GrupoBoletos, agruparBoletos } from "@/components/Boleto";
import { BotonVolver } from "@/components/BotonVolver";

export default function MisEntradas() {
  const { usuario, boletos, saldo, movimientos, listo, abrirLogin, abrirTrivia, refrescarCuenta } = useApp();
  // Con la API: boletos, saldo y movimientos actualizados desde PostgreSQL (p. ej. un boleto ya validado en sala).
  useEffect(() => {
    refrescarCuenta();
  }, [refrescarCuenta]);

  if (listo && !usuario)
    return (
      <div className="tarjeta mx-auto max-w-md p-8 text-center">
        <p className="titulo text-lg">Mis Entradas</p>
        <p className="mt-2 text-sm text-tenue">Inicia sesión para ver tus boletos y tus créditos.</p>
        <button onClick={() => abrirLogin()} className="btn-vino mt-5">
          Iniciar sesión
        </button>
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-4">
        <div>
          <p className="etiqueta text-oro">Cuenta de {usuario?.nombre}</p>
          <h1 className="titulo mt-1 text-3xl">Mis Entradas</h1>
        </div>
        <div className="flex gap-3 rounded-lg border border-oro/25 bg-oro/5 p-3 text-xs leading-relaxed text-tinta/80">
          <span className="text-lg">🛡️</span>
          <p>
            Tus códigos QR están protegidos: se muestran borrosos hasta que los abres, <b className="text-oro">cambian cada minuto</b>, llevan tu correo
            como marca de agua y el visor se cierra solo o al cambiar de pestaña. Tu sesión se cierra tras 15 minutos sin actividad.
          </p>
        </div>
        {boletos.length === 0 ? (
          <div className="tarjeta border-dashed p-10 text-center text-tenue">
            Aún no tienes boletos.
            <div className="mt-4">
              <BotonVolver texto="Ver cartelera" />
            </div>
          </div>
        ) : (
          agruparBoletos(boletos).map((g) => <GrupoBoletos key={g[0].funcionId + g[0].token} boletos={g} />)
        )}
      </section>

      <aside className="tarjeta h-fit space-y-4 p-5">
        <button onClick={abrirTrivia} className="group block w-full rounded-lg border border-rojo/50 bg-gradient-to-br from-vino/70 to-panel p-4 text-left transition-colors hover:border-salmon">
          <p className="etiqueta text-salmon">Mis créditos</p>
          <p className="mt-1 text-4xl font-black text-oro">◆ {saldo}</p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-salmon/80 group-hover:text-white">Toca para ganar más con la trivia →</p>
        </button>
        <div>
          <p className="etiqueta mb-2">Movimientos</p>
          <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
            {movimientos.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 border-b border-borde pb-2">
                <span className="min-w-0">
                  <span className="font-semibold capitalize">{m.tipo}</span>
                  <span className="block truncate text-xs text-apagado">{m.ref}</span>
                </span>
                <span className={`font-bold tabular-nums ${m.monto > 0 ? "text-oro" : m.monto < 0 ? "text-salmon" : "text-apagado"}`}>
                  {m.monto > 0 ? "+" : ""}
                  {m.monto || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
