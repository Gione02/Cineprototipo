// Cliente de la API en Go (backend/main.go). La URL base sale de NEXT_PUBLIC_API_URL.
// Si la variable no está definida, o la API no responde al arrancar, el prototipo sigue
// funcionando con los datos simulados del navegador (ver `modoApi` en el store).

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export const apiConfigurada = BASE !== "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function pedir<T>(ruta: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + ruta, {
      ...init,
      signal: ctrl.signal,
      cache: "no-store",
      headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (datos as { error?: string }).error ?? `Error ${res.status}`);
    return datos as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, ctrl.signal.aborted ? "La API no respondió a tiempo." : "No se pudo conectar con la API.");
  } finally {
    clearTimeout(t);
  }
}

const post = <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, { method: "POST", body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });

// ───────── Tipos de respuesta (snake_case, tal como los devuelve Go) ─────────

export type FuncionApi = {
  id: number;
  codigo: string;
  pelicula: string;
  titulo: string;
  sala: string;
  sala_nombre: string;
  inicio: string;
  fin: string;
  formato: string;
  idioma: string;
  precio: number;
  evento: string | null;
  disponibles: number;
};
export type AsientosApi = { vendidos: string[]; retenidos: string[] };
export type ReservaApi = { reserva_id: string; expira: string };
export type BoletoApi = { token: string; funcion: string; asiento: string; precio: number; estado: "valido" | "utilizado" | "anulado" | "reembolsado"; fecha: string };
export type PagoApi = { reserva_id: string; boletos: BoletoApi[]; saldo?: number; repetido?: boolean };
export type MovimientoApi = { id: number; tipo: "recarga" | "retencion" | "debito" | "liberacion" | "reembolso"; monto: number; referencia: string; fecha: string };
export type CuentaApi = { saldo: number; movimientos: MovimientoApi[]; boletos: BoletoApi[] };
export type SesionApi = { usuario_id: number; saldo: number };
export type TriviaApi = { acreditado: boolean; monto: number; saldo: number };
export type ValidacionApi = { ok: boolean; motivo: string; boleto?: BoletoApi; titular?: string };
export type MetricasApi = {
  vendidos_hoy: number;
  ingresos_hoy: number;
  asientos_retenidos: number;
  colas: Record<string, number>;
  creditos_trivia: number;
  creditos_canjeados: number;
  cuentas: number;
  funciones: { codigo: string; vendidos: number; aforo: number; ingresos: number }[];
};

export const api = {
  salud: () => pedir<{ estado: string }>("/api/salud", {}, 2500),
  funciones: () => pedir<FuncionApi[]>("/api/funciones"),
  asientos: (funcion: string) => pedir<AsientosApi>(`/api/funciones/${encodeURIComponent(funcion)}/asientos`),
  crearReserva: (funcion: string, usuarioId: number, asientos: string[]) => post<ReservaApi>("/api/reservas", { funcion, usuario_id: usuarioId, asientos }),
  pagar: (reservaId: string) => post<PagoApi>(`/api/reservas/${encodeURIComponent(reservaId)}/pagar`),
  cancelarReserva: (reservaId: string) => pedir<{ estado: string }>(`/api/reservas/${encodeURIComponent(reservaId)}`, { method: "DELETE" }),
  sesion: (correo: string, nombre: string) => post<SesionApi>("/api/sesion", { correo, nombre }),
  cuenta: (usuarioId: number) => pedir<CuentaApi>(`/api/usuarios/${usuarioId}/cuenta`),
  acreditarTrivia: (usuarioId: number, partida: string, aciertos: number) => post<TriviaApi>("/api/creditos/trivia", { usuario_id: usuarioId, partida, aciertos }),
  validarBoleto: (token: string) => post<ValidacionApi>(`/api/boletos/${encodeURIComponent(token)}/validar`),
  metricas: () => pedir<MetricasApi>("/api/metricas"),
};
