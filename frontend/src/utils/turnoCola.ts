// Turno de acceso otorgado por la cola virtual (RF-51). Con la API, el turno real vive en Redis y el servidor lo
// exige al bloquear o reservar; aquí sólo se recuerda su vencimiento para mostrar la cuenta regresiva y el acceso.
import { PARAMETROS } from "@/data/parametros";

const clave = (eventoId: string) => `cineight-turno-${eventoId}`;

/** Guarda el turno; `expira` (ms) es el vencimiento que dio el servidor. Sin él, se usa la duración por defecto. */
export function otorgarTurno(eventoId: string, expira = Date.now() + PARAMETROS.turnoColaMinutos * 60000) {
  try {
    localStorage.setItem(clave(eventoId), String(expira));
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

export function quitarTurno(eventoId: string) {
  try {
    localStorage.removeItem(clave(eventoId));
  } catch {}
}

// Al cerrar sesión, los turnos obtenidos dejan de valer: pertenecían a ese usuario.
export function limpiarTurnos() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("cineight-turno-")) localStorage.removeItem(k);
  } catch {}
}
