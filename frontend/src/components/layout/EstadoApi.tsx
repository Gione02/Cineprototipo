"use client";

import { useApp } from "@/store/AppProvider";

// Indica de dónde salen los datos: de la API en Go o de la simulación en el navegador.
export function EstadoApi() {
  const { modoApi } = useApp();
  const [punto, txt] =
    modoApi === "conectado"
      ? ["bg-oro", "Datos en vivo · API Go + PostgreSQL + Redis"]
      : modoApi === "verificando"
        ? ["bg-tenue animate-pulse", "Conectando con la API…"]
        : ["bg-rojo", "Modo demostración · datos simulados"];
  return (
    <span className="flex items-center gap-2" title={modoApi === "local" ? "Define NEXT_PUBLIC_API_URL y levanta docker compose para usar la API real" : undefined}>
      <span className={`h-1.5 w-1.5 rounded-full ${punto}`} />
      {txt}
    </span>
  );
}
