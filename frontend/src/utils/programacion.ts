// Reglas de programación de funciones compartidas por el panel (RF-31).

import { ULTIMA_FUNCION_MIN, finFuncion } from "@/data/catalogo";
import { PARAMETROS } from "@/data/parametros";
import type { Funcion } from "@/types/catalogo";

/** Fin de una función con una duración dada (incluye la limpieza). */
export const finCon = (inicio: string, duracionMin: number) => new Date(new Date(inicio).getTime() + (duracionMin + PARAMETROS.limpiezaMinutos) * 60000);

/** Función ocupando una sala; `fin` permite fijar el término cuando la película aún no está en el catálogo. */
export type Ocupada = Funcion & { fin?: Date };

/**
 * Devuelve la función existente con la que se traslaparía una nueva en la misma sala, o undefined.
 * `duracion` permite validar películas que todavía no existen en el catálogo (formulario de alta).
 */
export function funcionQueChoca(existentes: Ocupada[], salaId: string, inicio: string, duracion: number) {
  const ini = new Date(inicio);
  const fin = finCon(inicio, duracion);
  return existentes.find((o) => o.salaId === salaId && ini < (o.fin ?? finFuncion(o)) && new Date(o.inicio) < fin);
}

/** "HH:MM" de un minuto del día. */
export const horaDeMinuto = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Horarios libres (cada 30 min entre 10:00 y el último inicio permitido) para una sala y fecha. */
export function horariosLibres(existentes: Ocupada[], salaId: string, fecha: string, duracion: number, max = 6) {
  const libres: string[] = [];
  for (let m = 10 * 60; m <= ULTIMA_FUNCION_MIN && libres.length < max; m += 30) {
    const h = horaDeMinuto(m);
    const inicio = new Date(`${fecha}T${h}:00`);
    if (inicio > new Date() && !funcionQueChoca(existentes, salaId, inicio.toISOString(), duracion)) libres.push(h);
  }
  return libres;
}

/**
 * Primer hueco libre para una película de esa duración: recorre los próximos días y las salas (en orden)
 * y devuelve la primera combinación sala/fecha/hora sin traslapes. Sirve de valor inicial en los formularios.
 */
export function primerHueco(existentes: Ocupada[], salas: string[], duracion: number, desdeDia = 1) {
  for (let d = desdeDia; d <= desdeDia + 21; d++) {
    const fecha = new Date(Date.now() + d * 86400000).toLocaleDateString("en-CA");
    for (const salaId of salas) {
      const hora = horariosLibres(existentes, salaId, fecha, duracion, 1)[0];
      if (hora) return { salaId, fecha, hora };
    }
  }
  return { salaId: salas[0], fecha: new Date(Date.now() + 86400000).toLocaleDateString("en-CA"), hora: "15:00" };
}

/** "1 función" / "3 funciones" */
export const nFunciones = (n: number) => `${n} ${n === 1 ? "función" : "funciones"}`;
