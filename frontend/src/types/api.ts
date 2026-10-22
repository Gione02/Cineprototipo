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
/** Boleto con los datos de su función (sirven para mostrarlo aunque la función ya haya terminado). */
export type BoletoApi = {
  token: string;
  funcion: string;
  asiento: string;
  precio: number;
  estado: "valido" | "utilizado" | "anulado" | "reembolsado";
  fecha: string;
  pelicula: string;
  sala: string;
  inicio: string;
  formato: string;
  idioma: string;
};
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

/**
 * Resultado de POST /api/captcha/verificar. `activo` = false cuando el servidor no tiene clave secreta configurada.
 * `pase`: comprobante de un solo uso para crear la cuenta en POST /api/sesion.
 */
export type CaptchaApi = { valido: boolean; puntaje: number; accion?: string; motivo?: string; activo: boolean; pase?: string };

/** Compras de un cliente agrupadas por película (GET /api/clientes/historial). */
export type ConsumoPeliculaApi = {
  pelicula: string;
  titulo: string;
  genero: string;
  director: string;
  reparto: string[];
  boletos: number;
  funciones: number;
  gastado: number;
  ultima: string;
};
export type HistorialClienteApi = { id: number; nombre: string; correo: string; activo: boolean; creado: string; saldo: number; peliculas: ConsumoPeliculaApi[] };

/** Lugar en la cola virtual de un preestreno: posición en la fila o turno vigente (con su vencimiento). */
export type PosicionColaApi = { posicion: number; en_cola: number; turno_habilitado: boolean; espera_min: number; expira?: string; capacidad: number };

/** Mensaje del stream SSE de una función (evento "asientos"). */
export type EventoAsientosApi = { tipo: "bloqueado" | "liberado" | "vendido"; funcion: string; asientos: string[] };
