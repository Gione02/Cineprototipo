// Estadísticas de preferencias de clientes a partir de su historial de compras.
//
// La unidad de preferencia es la "visita" (una función a la que asistió), no el boleto: quien compra 4 butacas
// para su familia vio la película una vez. Los boletos y el gasto se informan aparte.

import type { Pelicula } from "@/types/catalogo";

/** Compras de un cliente para una película. */
export type CompraPelicula = {
  peliculaId: string;
  titulo: string;
  genero: string;
  director: string;
  reparto: string[];
  boletos: number;
  visitas: number;
  gastado: number;
  ultima: string; // ISO
};

/** Cliente con su historial agrupado por película. */
export type ClienteHistorial = {
  correo: string;
  nombre: string;
  activo: boolean;
  creado: string;
  saldo: number;
  compras: CompraPelicula[];
};

/** Elemento de un ranking (género, director, actor o película). */
export type Conteo = { nombre: string; visitas: number; pct: number };

export type PerfilCliente = ClienteHistorial & {
  boletos: number;
  visitas: number;
  gastado: number;
  ultima: string | null;
  generos: Conteo[];
  directores: Conteo[];
  actores: Conteo[];
};

export type ResumenClientes = {
  clientes: number;
  conCompras: number;
  boletos: number;
  visitas: number;
  gastado: number;
  generos: Conteo[];
  directores: Conteo[];
  actores: Conteo[];
  peliculas: Conteo[];
};

/** "Acción / Crimen / Drama" → ["Acción", "Crimen", "Drama"]. */
export const dividirGeneros = (genero: string) => genero.split("/").map((g) => g.trim()).filter(Boolean);
/** "Daniel Kwan, Daniel Scheinert" → ["Daniel Kwan", "Daniel Scheinert"]. */
export const dividirDirectores = (director: string) => director.split(",").map((d) => d.trim()).filter(Boolean);

/** Completa género, director y reparto vacíos con la ficha del catálogo (las películas del catálogo base sólo la tienen en el frontend). */
export function completarFicha(c: CompraPelicula, ficha: Pelicula | undefined): CompraPelicula {
  if (!ficha) return c;
  return {
    ...c,
    titulo: c.titulo || ficha.titulo,
    genero: c.genero || ficha.genero,
    director: c.director || ficha.director,
    reparto: c.reparto.length ? c.reparto : ficha.reparto,
  };
}

function ranking(cuenta: Map<string, number>, limite: number): Conteo[] {
  const total = [...cuenta.values()].reduce((a, n) => a + n, 0) || 1;
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, limite)
    .map(([nombre, visitas]) => ({ nombre, visitas, pct: Math.round((visitas / total) * 100) }));
}

const sumar = (m: Map<string, number>, clave: string, n: number) => m.set(clave, (m.get(clave) ?? 0) + n);

type Acumuladores = { generos: Map<string, number>; directores: Map<string, number>; actores: Map<string, number> };

function acumular(a: Acumuladores, c: CompraPelicula) {
  for (const g of dividirGeneros(c.genero)) sumar(a.generos, g, c.visitas);
  for (const d of dividirDirectores(c.director)) sumar(a.directores, d, c.visitas);
  for (const r of c.reparto) sumar(a.actores, r, c.visitas);
}

const nuevosAcumuladores = (): Acumuladores => ({ generos: new Map(), directores: new Map(), actores: new Map() });

/** Perfil de preferencias de un cliente. */
export function perfilCliente(h: ClienteHistorial, limite = 5): PerfilCliente {
  const acc = nuevosAcumuladores();
  for (const c of h.compras) acumular(acc, c);
  const ultima = h.compras.reduce<string | null>((max, c) => (max === null || c.ultima > max ? c.ultima : max), null);
  return {
    ...h,
    compras: [...h.compras].sort((a, b) => b.visitas - a.visitas || b.ultima.localeCompare(a.ultima)),
    boletos: h.compras.reduce((a, c) => a + c.boletos, 0),
    visitas: h.compras.reduce((a, c) => a + c.visitas, 0),
    gastado: h.compras.reduce((a, c) => a + c.gastado, 0),
    ultima,
    generos: ranking(acc.generos, limite),
    directores: ranking(acc.directores, limite),
    actores: ranking(acc.actores, limite),
  };
}

/** Totales y rankings de toda la clientela. */
export function resumenClientes(perfiles: PerfilCliente[], limite = 6): ResumenClientes {
  const acc = nuevosAcumuladores();
  const peliculas = new Map<string, number>();
  for (const p of perfiles)
    for (const c of p.compras) {
      acumular(acc, c);
      sumar(peliculas, c.titulo, c.visitas);
    }
  return {
    clientes: perfiles.length,
    conCompras: perfiles.filter((p) => p.visitas > 0).length,
    boletos: perfiles.reduce((a, p) => a + p.boletos, 0),
    visitas: perfiles.reduce((a, p) => a + p.visitas, 0),
    gastado: perfiles.reduce((a, p) => a + p.gastado, 0),
    generos: ranking(acc.generos, limite),
    directores: ranking(acc.directores, limite),
    actores: ranking(acc.actores, limite),
    peliculas: ranking(peliculas, limite),
  };
}
