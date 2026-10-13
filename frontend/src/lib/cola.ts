// Turno de acceso otorgado por la cola virtual (RF-51). En producción vive en Redis (ZSET + clave con TTL).
import { PARAMETROS } from "./data";

const clave = (eventoId: string) => `cineight-turno-${eventoId}`;

export function otorgarTurno(eventoId: string) {
  try {
    localStorage.setItem(clave(eventoId), String(Date.now() + PARAMETROS.turnoColaMinutos * 60000));
  } catch {}
}

export function turnoVigente(eventoId: string): number {
  try {
    const exp = Number(localStorage.getItem(clave(eventoId)));
    return exp > Date.now() ? exp : 0;
  } catch {
    return 0;
  }
}
