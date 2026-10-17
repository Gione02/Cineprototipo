"use client";

import { useEffect, useState } from "react";

/** Milisegundos que faltan para `expira`; se actualiza cada segundo sólo en el componente que lo usa. */
export function useRestante(expira: number) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, expira - ahora);
}

/** 125000 → "02:05" */
export const mmss = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
