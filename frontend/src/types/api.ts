// Respuestas de la API en Go, tal como llegan (snake_case).

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
export type AsientosApi = { vendidos: string[]; retenidos: string[]; propios?: string[] };
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

/** Película creada desde el panel (GET /api/peliculas). */
export type PeliculaApi = {
  slug: string;
  titulo: string;
  titulo_original: string;
  categoria: "cartelera" | "estreno" | "proximamente";
  clasificacion: string;
  duracion: number;
  genero: string;
  idioma: string;
  formatos: string[];
  director: string;
  reparto: string[];
  anio: string;
  sinopsis: string;
  trailer: string | null;
  estreno_en_dias: number | null;
  poster_url: string;
};

/** Función a programar (POST /api/peliculas y POST /api/funciones). */
export type NuevaFuncionApi = { sala: string; inicio: string; formato: string; idioma: string; precio: number };

/** Resultado de POST /api/captcha/verificar. `activo` = false cuando el servidor no tiene clave secreta configurada. */
export type CaptchaApi = { valido: boolean; puntaje: number; accion?: string; motivo?: string; activo: boolean };

/** Mensaje del stream SSE de una función (evento "asientos"). */
export type EventoAsientosApi = { tipo: "bloqueado" | "liberado" | "vendido"; funcion: string; asientos: string[] };
