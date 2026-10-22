// Estado de la sesión guardado en el navegador (localStorage) y funciones puras que lo transforman.
// Sólo contiene lo que todavía no vive en el servidor: las cuentas para iniciar sesión, la reserva en curso y la
// bitácora local (pendiente: JWT + bcrypt). Saldo, boletos y movimientos de los clientes vienen de PostgreSQL.

import { CLAVE_INICIAL, PERSONAL_INICIAL } from "@/data/catalogo";
import { PARAMETROS } from "@/data/parametros";
import type { Rol } from "@/types/catalogo";
import type { Cuenta, Log, Reserva, Usuario } from "@/types/cuenta";

export type Estado = {
  usuario: Usuario | null;
  cuentas: Record<string, Cuenta>; // clave: correo del usuario
  reserva: Reserva | null;
  bitacora: Log[];
};

export const INICIAL: Estado = { usuario: null, cuentas: {}, reserva: null, bitacora: [] };

export const ahoraISO = () => new Date().toISOString();

// Premio de una partida: 10 créditos por acierto; si acierta todas, 50. (Lo calcula y acredita el servidor;
// aquí sólo se usa para mostrar el resultado.)
export const premioTrivia = (aciertos: number) =>
  aciertos === PARAMETROS.preguntasTrivia ? PARAMETROS.bonoTriviaPerfecta : aciertos * PARAMETROS.creditosPorRespuesta;

// Hash FNV-1a con sal = correo. En producción: bcrypt en el backend (RNF-09).
export function hashClave(correo: string, clave: string) {
  let h = 2166136261;
  for (const ch of `${correo.toLowerCase()}::${clave}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return "h1$" + (h >>> 0).toString(36);
}

export const cuentaNueva = (nombre: string, correo: string, rol: Rol, clave: string): Cuenta => ({
  nombre,
  rol,
  activo: true,
  claveHash: hashClave(correo, clave),
  creado: ahoraISO(),
});

// Garantiza que existan las cuentas iniciales del personal y conserva sólo los datos de inicio de sesión
// (las versiones anteriores guardaban también saldo y boletos en el navegador).
export function conPersonal(cuentas: Record<string, Partial<Cuenta> & Cuenta>): Record<string, Cuenta> {
  const out: Record<string, Cuenta> = {};
  for (const [correo, { nombre, rol, activo, claveHash, creado }] of Object.entries(cuentas)) out[correo] = { nombre, rol, activo, claveHash, creado };
  for (const p of PERSONAL_INICIAL) out[p.correo] ??= cuentaNueva(p.nombre, p.correo, p.rol, CLAVE_INICIAL);
  return out;
}

export const adminsActivos = (c: Record<string, Cuenta>) => Object.values(c).filter((x) => x.rol === "admin" && x.activo).length;

// Agrega una entrada a la bitácora (máximo 300, la más reciente primero).
export function log(s: Estado, accion: string, detalle: string): Log[] {
  return [{ fecha: ahoraISO(), usuario: s.usuario?.correo ?? "sistema", accion, detalle }, ...s.bitacora].slice(0, 300);
}

// Actualiza la cuenta de un usuario concreto sin tocar las demás.
export function conCuenta(s: Estado, correo: string, f: (c: Cuenta) => Cuenta): Record<string, Cuenta> {
  const c = s.cuentas[correo];
  return c ? { ...s.cuentas, [correo]: f(c) } : s.cuentas;
}

export const mensaje = (e: unknown) => (e instanceof Error ? e.message : "Error inesperado.");
