// Formato de fechas, horas y duraciones en español de Guatemala.

export const fmtDuracion = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
export const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString("es-GT", { weekday: "short", day: "2-digit", month: "short" });
export const fmtFechaLarga = (iso: string) => new Date(iso).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });
export const fmtHora = (iso: string | Date) => new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", hour12: false });

// "Hoy", "Mañana" o el día de la semana abreviado ("sáb"), para pestañas de días.
export function fmtDiaRelativo(iso: string, ahora = new Date()) {
  const d = new Date(iso);
  const dias = Math.round((new Date(d.toDateString()).getTime() - new Date(ahora.toDateString()).getTime()) / 86400000);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return d.toLocaleDateString("es-GT", { weekday: "short" }).replace(".", "");
}

// Clave de día local (AAAA-MM-DD) para agrupar funciones.
export const claveDia = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
