"use client";

import { useMemo, useState } from "react";
import { Clapperboard, Download, Eye, Heart, Search, Ticket, UserRound, Users, Video, type LucideIcon } from "lucide-react";
import { useApp } from "@/store/AppProvider";
import { useEstadisticasClientes } from "@/hooks/useEstadisticasClientes";
import type { Conteo, PerfilCliente } from "@/utils/estadisticas";
import { descargarCsv } from "@/utils/csv";
import { Boton, BotonIcono } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { Poster } from "@/components/ui/Poster";
import { Caja, Kpi, thCls } from "@/components/panel/Elementos";

/* ─────────── Estadísticas y preferencias de clientes ─────────── */

type Orden = "gastado" | "visitas" | "reciente";
const ORDENES: [Orden, string][] = [
  ["gastado", "Mayor gasto"],
  ["visitas", "Más visitas"],
  ["reciente", "Compra reciente"],
];

const fmtDia = (iso: string) => new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
const num = (n: number) => n.toLocaleString("es-GT");

export function Clientes() {
  const { perfiles, resumen, cargando, error } = useEstadisticasClientes();
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("gastado");
  const [elegido, setElegido] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = q ? perfiles.filter((p) => p.nombre.toLowerCase().includes(q) || p.correo.includes(q)) : perfiles;
    const clave: Record<Orden, (p: PerfilCliente) => number | string> = {
      gastado: (p) => p.gastado,
      visitas: (p) => p.visitas,
      reciente: (p) => p.ultima ?? "",
    };
    return [...filtrados].sort((a, b) => {
      const x = clave[orden](a);
      const y = clave[orden](b);
      return x < y ? 1 : x > y ? -1 : a.nombre.localeCompare(b.nombre, "es");
    });
  }, [perfiles, busqueda, orden]);

  const perfil = perfiles.find((p) => p.correo === elegido) ?? null;
  const fuente = "Se actualiza cada 30 s";
  const promedio = resumen.conCompras ? Math.round(resumen.gastado / resumen.conCompras) : 0;

  const exportar = () =>
    descargarCsv("estadisticas_clientes", [
      ["nombre", "correo", "estado", "visitas", "boletos", "creditos_gastados", "genero_favorito", "director_favorito", "actor_favorito", "peliculas_vistas", "ultima_compra"],
      ...lista.map((p) => [
        p.nombre,
        p.correo,
        p.activo ? "activo" : "baja",
        p.visitas,
        p.boletos,
        p.gastado,
        p.generos[0]?.nombre ?? "",
        p.directores[0]?.nombre ?? "",
        p.actores[0]?.nombre ?? "",
        p.compras.map((c) => c.titulo).join(" | "),
        p.ultima?.slice(0, 10) ?? "",
      ]),
    ]);

  if (cargando) return <p className="text-sm text-tenue">Cargando el historial de clientes…</p>;

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md border border-rojo/60 bg-vino/40 p-3 text-sm text-salmon">No se pudo actualizar el historial: {error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Clientes con compras" valor={num(resumen.conCompras)} sufijo={`de ${num(resumen.clientes)}`} detalle="Cuentas de cliente registradas" />
        <Kpi titulo="Visitas" valor={num(resumen.visitas)} detalle={`${num(resumen.boletos)} boletos · una visita = una función`} />
        <Kpi titulo="Créditos gastados" valor={num(resumen.gastado)} sufijo="créditos" detalle="Boletos vigentes o utilizados" />
        <Kpi titulo="Gasto promedio" valor={num(promedio)} sufijo="créditos" detalle="Por cliente con compras" />
      </div>

      <Caja icono={Heart} titulo="Preferencias de la clientela" sub={`Ponderadas por visitas · ${fuente}`}>
        {resumen.visitas === 0 ? (
          <SinCompras />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-4">
            <Ranking icono={Clapperboard} titulo="Películas más vistas" datos={resumen.peliculas} />
            <Ranking icono={Video} titulo="Géneros" datos={resumen.generos} />
            <Ranking icono={UserRound} titulo="Directores" datos={resumen.directores} />
            <Ranking icono={Users} titulo="Actores" datos={resumen.actores} />
          </div>
        )}
      </Caja>

      <Caja
        icono={Ticket}
        titulo="Historial por cliente"
        sub={`${lista.length} de ${perfiles.length} clientes`}
        accion={
          <Boton variante="borde" tamano="sm" icono={Download} onClick={exportar} disabled={!lista.length}>
            Exportar CSV
          </Boton>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Buscar cliente</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-apagado" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o correo" className="campo !mt-0 pl-9" />
          </label>
          <div className="flex gap-1 rounded-md border border-borde bg-fondo p-1" role="group" aria-label="Ordenar clientes">
            {ORDENES.map(([id, txt]) => (
              <button
                key={id}
                type="button"
                aria-pressed={orden === id}
                onClick={() => setOrden(id)}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${orden === id ? "bg-panel-2 text-tinta" : "text-tenue hover:text-tinta"}`}
              >
                {txt}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-borde">
              <tr>
                <th className={thCls}>Cliente</th>
                <th className={`${thCls} text-right`}>Visitas</th>
                <th className={`${thCls} text-right`}>Boletos</th>
                <th className={`${thCls} text-right`}>Gastado</th>
                <th className={thCls}>Género favorito</th>
                <th className={thCls}>Director favorito</th>
                <th className={thCls}>Última compra</th>
                <th className={thCls} aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.correo} onClick={() => setElegido(p.correo)} className="cursor-pointer border-b border-borde/60 transition-colors last:border-0 hover:bg-panel-2/40">
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="block min-w-0">
                        <span className="block truncate font-bold">{p.nombre}</span>
                        <span className="block truncate text-[11px] text-tenue">{p.correo}</span>
                      </span>
                      {!p.activo && <span className="badge-vino">Baja</span>}
                    </span>
                  </td>
                  <td className="pr-3 text-right tabular-nums">{p.visitas}</td>
                  <td className="pr-3 text-right tabular-nums">{p.boletos}</td>
                  <td className="pr-3 text-right font-bold tabular-nums text-oro">{num(p.gastado)}</td>
                  <td className="pr-3">{p.generos[0]?.nombre ?? <span className="text-apagado">—</span>}</td>
                  <td className="pr-3">{p.directores[0]?.nombre ?? <span className="text-apagado">—</span>}</td>
                  <td className="pr-3 text-xs text-tenue">{p.ultima ? fmtDia(p.ultima) : "Sin compras"}</td>
                  <td className="text-right">
                    <BotonIcono
                      icono={Eye}
                      etiqueta={`Ver perfil de ${p.nombre}`}
                      tamano="sm"
                      variante="borde"
                      onClick={(e) => {
                        e.stopPropagation();
                        setElegido(p.correo);
                      }}
                    />
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-tenue">
                    {perfiles.length ? "Ningún cliente coincide con la búsqueda." : "Todavía no hay clientes registrados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Caja>

      <Modal abierto={!!perfil} onCerrar={() => setElegido(null)} titulo="Perfil del cliente" ancho="max-w-4xl">
        {perfil && <DetalleCliente p={perfil} />}
      </Modal>
    </div>
  );
}

function SinCompras() {
  return (
    <p className="rounded-lg border border-dashed border-borde p-6 text-center text-sm text-tenue">
      Aún no hay compras de clientes.{" "}
      Las estadísticas aparecen cuando un cliente paga sus boletos.
    </p>
  );
}

/** Lista con barra proporcional al primer lugar. Se resaltan todos los que empatan en el máximo. */
function Ranking({ icono: Icono, titulo, datos }: { icono: LucideIcon; titulo: string; datos: Conteo[] }) {
  const max = Math.max(...datos.map((d) => d.visitas), 1);
  return (
    <div>
      <p className="etiqueta mb-3 flex items-center gap-2">
        <Icono aria-hidden className="h-3.5 w-3.5 text-arena" /> {titulo}
      </p>
      {datos.length === 0 ? (
        <p className="text-xs text-apagado">Sin datos.</p>
      ) : (
        <ol className="space-y-2.5">
          {datos.map((d) => {
            const lider = d.visitas === max;
            return (
              <li key={d.nombre} className="text-xs">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`truncate ${lider ? "font-bold text-tinta" : "text-tinta/85"}`} title={d.nombre}>
                    {d.nombre}
                  </span>
                  <span className="shrink-0 tabular-nums text-tenue">
                    {d.visitas} <span className="text-apagado">· {d.pct}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fondo">
                  <div className={`h-full origin-left rounded-full ${lider ? "bg-rojo" : "bg-arena/70"}`} style={{ transform: `scaleX(${d.visitas / max})` }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function DetalleCliente({ p }: { p: PerfilCliente }) {
  const { peliculas } = useApp();
  const ficha = new Map(peliculas.map((x) => [x.id, x]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-arena/60 bg-panel-2 text-sm font-black text-arena">
            {p.nombre
              .split(" ")
              .map((x) => x[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-lg font-bold">
              {p.nombre} {!p.activo && <span className="badge-vino">Baja</span>}
            </p>
            <p className="truncate text-sm text-tenue">{p.correo}</p>
            <p className="text-xs text-apagado">Cliente desde {fmtDia(p.creado)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-2 text-center">
          {(
            [
              ["Visitas", num(p.visitas)],
              ["Boletos", num(p.boletos)],
              ["Gastado", num(p.gastado)],
              ["Saldo", num(p.saldo)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-md border border-borde bg-fondo px-3 py-2">
              <dt className="etiqueta !text-[9px]">{k}</dt>
              <dd className="text-lg font-black tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {p.visitas === 0 ? (
        <p className="rounded-lg border border-dashed border-borde p-6 text-center text-sm text-tenue">Este cliente todavía no ha comprado boletos.</p>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <Ranking icono={Video} titulo="Géneros" datos={p.generos} />
            <Ranking icono={UserRound} titulo="Directores" datos={p.directores} />
            <Ranking icono={Users} titulo="Actores" datos={p.actores} />
          </div>

          <div>
            <p className="etiqueta mb-3 flex items-center gap-2">
              <Clapperboard aria-hidden className="h-3.5 w-3.5 text-arena" /> Películas vistas ({p.compras.length})
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {p.compras.map((c) => {
                const f = ficha.get(c.peliculaId);
                return (
                  <li key={c.peliculaId} className="flex items-center gap-3 rounded-lg border border-borde bg-fondo/60 p-2.5">
                    {f ? (
                      <Poster p={f} className="aspect-[2/3] w-10 shrink-0" rounded="rounded" sizes="40px" />
                    ) : (
                      <span className="grid aspect-[2/3] w-10 shrink-0 place-items-center rounded border border-borde bg-panel-2 text-apagado">
                        <Clapperboard aria-hidden className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{c.titulo}</p>
                      <p className="truncate text-[11px] text-tenue">{c.genero || "Género sin registrar"}</p>
                      <p className="text-[11px] text-tenue">
                        {c.visitas} {c.visitas === 1 ? "visita" : "visitas"} · {c.boletos} {c.boletos === 1 ? "boleto" : "boletos"} · {fmtDia(c.ultima)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-oro">{num(c.gastado)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
