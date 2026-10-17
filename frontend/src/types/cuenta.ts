// Tipos de la sesión, la cuenta de créditos y la compra.

import type { Rol } from "./catalogo";

export type Usuario = { nombre: string; correo: string; rol: Rol };
export type Movimiento = { id: string; tipo: "recarga" | "retención" | "débito" | "liberación" | "reembolso"; monto: number; ref: string; fecha: string };
export type Boleto = { token: string; funcionId: string; asiento: string; precio: number; estado: "VÁLIDO" | "UTILIZADO" | "ANULADO" | "REEMBOLSADO"; emitido: string; titular: string };
export type Reserva = { id: string; titular: string; funcionId: string; asientos: string[]; expira: number; creditosRetenidos: number };
export type Log = { fecha: string; usuario: string; accion: string; detalle: string };
export type Cuenta = {
  nombre: string;
  rol: Rol;
  activo: boolean; // dado de baja: no puede iniciar sesión, pero su historial se conserva (ERS 3.1.11.4)
  claveHash: string;
  creado: string;
  saldo: number;
  movimientos: Movimiento[];
  boletos: Boleto[];
  partidasCobradas: string[];
};
export type Resultado = { ok: boolean; error?: string };
export type Validacion = { ok: boolean; motivo: string; boleto?: Boleto };
// verificando: esperando /api/salud · conectado: datos reales de Go · local: simulación en el navegador
export type ModoApi = "verificando" | "conectado" | "local";
