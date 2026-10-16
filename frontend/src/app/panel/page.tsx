"use client";

import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { CLAVE_DEMO, FILAS, PARAMETROS, etiqueta, PELICULAS, ROL_TXT, SALAS, finFuncion, fmtFecha, fmtHora, pelicula, sala, type Funcion, type Rol } from "@/lib/data";
import { useApp, type Validacion } from "@/lib/store";
import { api, type MetricasApi } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { Poster } from "@/components/Poster";

// ───────── Datos del panel ─────────

// GET /api/metricas cada 5 s cuando la API está conectada (null en modo demostración).
function useMetricas() {
  const { modoApi } = useApp();
  const [met, setMet] = useState<MetricasApi | null>(null);
  useEffect(() => {
    if (modoApi !== "conectado") return;
    let vivo = true;
    const traer = () =>
      api
        .metricas()
        .then((r) => vivo && setMet(r))
        .catch(() => {});
    traer();
    const t = setInterval(traer, 5000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [modoApi]);
  return modoApi === "conectado" ? met : null;
}

// Con la API: carga la ocupación real (vendidas + retenidas) de todas las funciones vigentes cada 10 s.
function useOcupacionVigente() {
  const { funciones, cargarOcupacion } = useApp();
  const codigos = funciones
    .filter((f) => finFuncion(f) > new Date())
    .map((f) => f.id)
    .join(",");
  useEffect(() => {
    if (!codigos) return;
    const ids = codigos.split(",");
    cargarOcupacion(ids);
    const t = setInterval(() => cargarOcupacion(ids), 10000);
    return () => clearInterval(t);
  }, [codigos, cargarOcupacion]);
}

type FilaVenta = { f: Funcion; vendidos: number; cap: number; ingresos: number };

// Ventas por función: de /api/metricas si hay conexión; si no, de la ocupación simulada.
function useFilasVentas(met: MetricasApi | null): FilaVenta[] {
  const { funciones, ocupacion } = useApp();
  if (met) {
    const porCodigo = new Map(met.funciones.map((x) => [x.codigo, x]));
    return funciones.flatMap((f) => {
      const x = porCodigo.get(f.id);
      return x ? [{ f, vendidos: x.vendidos, cap: x.aforo, ingresos: x.ingresos }] : [];
    });
  }
  return funciones.map((f) => {
    const vendidos = ocupacion(f.id).vendidos.size;
    return { f, vendidos, cap: sala(f.salaId).aforo, ingresos: vendidos * f.precio };
  });
}

// CSV con comillas y BOM para que Excel respete los acentos.
function descargarCsv(nombre: string, filas: (string | number)[][]) {
  const celda = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${nombre}_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const csvVentas = (filas: FilaVenta[]) =>
  descargarCsv("reporte_ventas", [
    ["fecha", "pelicula", "sala", "funcion", "vendidos", "aforo", "ocupacion", "ingresos_creditos"],
    ...filas.map((r) => [fmtFecha(r.f.inicio), pelicula(r.f.peliculaId).titulo, sala(r.f.salaId).nombre, fmtHora(r.f.inicio), r.vendidos, r.cap, `${Math.round((r.vendidos / r.cap) * 100)}%`, r.ingresos]),
  ]);

type Seccion = { id: string; txt: string; icono: string };

const SECCIONES: Record<"agente" | "admin" | "auditor", Seccion[]> = {
  agente: [
    { id: "programar", txt: "Programación", icono: "▦" },
    { id: "inventario", txt: "Aforos & Salas", icono: "▤" },
    { id: "validar", txt: "Validar acceso", icono: "⌁" },
  ],
  admin: [
    { id: "general", txt: "Panel general", icono: "◩" },
    { id: "usuarios", txt: "Usuarios & roles", icono: "◎" },
    { id: "parametros", txt: "Parámetros", icono: "⚙" },
    { id: "reportes", txt: "Reportes", icono: "▥" },
    { id: "bitacora", txt: "Bitácora", icono: "☰" },
  ],
  auditor: [
    { id: "reportes", txt: "Reportes", icono: "▥" },
    { id: "bitacora", txt: "Bitácora", icono: "☰" },
  ],
};

const TITULOS: Record<string, [string, string]> = {
  general: ["Dashboard de operaciones y taquilla en tiempo real", "Telemetría del clúster · Go + Redis + PostgreSQL"],
  usuarios: ["Gestión de usuarios y roles", "Crear, editar y dar de baja cuentas · requiere reconfirmar identidad"],
  parametros: ["Parámetros globales", "Configurables sin modificar el código fuente (RF-57)"],
  reportes: ["Reportes de ventas y ocupación", "RF-13 · RF-47 · RF-48"],
  bitacora: ["Bitácora de auditoría", "Registro cronológico de operaciones críticas (RNF-22)"],
  programar: ["Programación de funciones", "Sin traslapes: inicio + duración + 20 min de limpieza (RF-31)"],
  inventario: ["Aforos & salas", "Inventario por función (RF-66)"],
  validar: ["Validación de acceso a sala", "Lector QR en modo teclado (RF-09, RF-27)"],
};

export default function Panel() {
  const { usuario, listo, abrirLogin, modoApi } = useApp();
  const [sec, setSec] = useState("");

  if (!listo) return null;
  if (!usuario || usuario.rol === "cliente")
    return (
      <div className="tarjeta mx-auto max-w-md p-8 text-center">
        <p className="titulo text-lg">Acceso restringido</p>
        <p className="mt-2 text-sm text-tenue">El panel de operaciones es exclusivo para el personal (RNF-23).</p>
        <button onClick={() => abrirLogin()} className="btn-vino mt-5">
          Iniciar sesión con un rol interno
        </button>
      </div>
    );

  const secciones = SECCIONES[usuario.rol];
  const activa = secciones.some((s) => s.id === sec) ? sec : secciones[0].id;
  const [titulo, sub] = TITULOS[activa];

  return (
    <div className="-mx-4 -my-6 grid min-h-[calc(100vh-140px)] sm:-mx-6 sm:-my-8 lg:grid-cols-[250px_1fr]">
      {/* Barra lateral */}
      <aside className="border-b border-borde bg-panel/60 p-4 lg:border-b-0 lg:border-r lg:p-5">
        <p className="titulo text-base">Cineight</p>
        <p className="etiqueta text-oro">Operaciones</p>
        <p className="etiqueta mt-6 hidden lg:block">Gestión & auditoría</p>
        <nav className="mt-3 flex gap-1 overflow-x-auto lg:flex-col">
          {secciones.map((s) => (
            <button
              key={s.id}
              onClick={() => setSec(s.id)}
              className={`flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2.5 text-left text-sm font-semibold transition ${
                activa === s.id ? "border-l-2 border-oro bg-panel-2 text-tinta" : "text-tenue hover:text-tinta"
              }`}
            >
              <span className="w-4 text-center text-arena">{s.icono}</span>
              {s.txt}
            </button>
          ))}
        </nav>
        <div className="mt-8 hidden rounded-md border border-borde bg-panel-2 p-3 lg:block">
          <p className="etiqueta">Sesión</p>
          <p className="mt-1 text-sm font-bold">{usuario.nombre}</p>
          <p className="text-[11px] text-tenue">{usuario.correo}</p>
          {usuario.rol === "auditor" && <span className="badge-borde mt-2 inline-block">Solo lectura</span>}
        </div>
      </aside>

      {/* Contenido */}
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-borde pb-5">
          <div>
            <p className="etiqueta flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-oro" /> {sub}
            </p>
            <h1 className="titulo mt-2 text-2xl leading-tight sm:text-3xl">{titulo}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["Go API", modoApi === "conectado" ? "conectada" : modoApi === "verificando" ? "verificando…" : "sin conexión · demo", modoApi === "conectado"],
                ["Redis seat lock TTL", "5 min", modoApi === "conectado"],
                ["Anti-bots", "5 solicitudes/min por IP", modoApi === "conectado"],
              ] as const
            ).map(([a, b, ok]) => (
              <span key={a} className="rounded-md border border-borde bg-panel px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em]">
                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${ok ? "bg-oro" : "bg-rojo"}`} />
                {a} <span className="font-semibold normal-case tracking-normal text-tenue">{b}</span>
              </span>
            ))}
          </div>
        </div>
        {activa === "general" && <General ir={setSec} />}
        {activa === "usuarios" && <Usuarios />}
        {activa === "parametros" && <Parametros />}
        {activa === "reportes" && <Reportes />}
        {activa === "bitacora" && <Bitacora />}
        {activa === "programar" && <Programar />}
        {activa === "inventario" && <Inventario />}
        {activa === "validar" && <Validar />}
      </section>
    </div>
  );
}

const card = "tarjeta p-5";
const thCls = "etiqueta pb-3 pr-3 text-left font-bold";

/* ─────────── Panel general (RF-56): dashboard en paneles ─────────── */

// Panel delimitado del dashboard: borde y fondo propios, encabezado con título, subtítulo y acción.
function Caja({ icono, titulo, sub, accion, children, className = "" }: { icono: string; titulo: string; sub?: string; accion?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-borde bg-panel/50 p-5 sm:p-6 ${className}`}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-borde/70 pb-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-borde bg-panel-2 text-arena">{icono}</span>
          <div>
            <h2 className="titulo text-base sm:text-lg">{titulo}</h2>
            {sub && <p className="text-xs text-tenue">{sub}</p>}
          </div>
        </div>
        {accion}
      </header>
      {children}
    </section>
  );
}

function General({ ir }: { ir: (seccion: string) => void }) {
  const { funciones, ocupacion, cuentas, bitacora, modoApi } = useApp();
  const met = useMetricas();
  useOcupacionVigente();
  const filas = useFilasVentas(met);
  const [serie, setSerie] = useState<number[]>(() => [12, 15, 14, 18, 22, 31, 38, 42, 36, 28, 24, 26]);
  const [log, setLog] = useState<string[]>([]);
  const [pausado, setPausado] = useState(false);
  const [sobre, setSobre] = useState<number | null>(null);
  const [mapa, setMapa] = useState<Funcion | null>(null);

  useEffect(() => {
    if (pausado) return;
    const plantillas = [
      () => `[Checkout OK] ${1 + Math.floor(Math.random() * 3)} boletos confirmados`,
      () => `[Redis TTL] Asiento ${"ABCDEFGH"[Math.floor(Math.random() * 8)]}-${String(1 + Math.floor(Math.random() * 10)).padStart(2, "0")} liberado`,
      () => `[Anti-bot] IP 190.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.12 bloqueada (429)`,
      () => `[Trivia] +${[10, 20, 50][Math.floor(Math.random() * 3)]} créditos acreditados`,
      () => `[Lock] Sala ${1 + Math.floor(Math.random() * 3)} · SET NX adquirido`,
    ];
    const t = setInterval(() => {
      const h = new Date().toLocaleTimeString("es-GT", { hour12: false });
      setLog((l) => [`[${h}] ${plantillas[Math.floor(Math.random() * plantillas.length)]()}`, ...l].slice(0, 8));
      setSerie((s) => [...s.slice(1), Math.max(5, Math.round(s[s.length - 1] + Math.random() * 14 - 7))]);
    }, 2000);
    return () => clearInterval(t);
  }, [pausado]);

  // ── Métricas clave: de /api/metricas con la API; si no, calculadas sobre los datos del prototipo.
  const movs = Object.values(cuentas).flatMap((c) => c.movimientos);
  const k = met
    ? { vendidos: met.vendidos_hoy, ingresos: met.ingresos_hoy, retenidos: met.asientos_retenidos, trivia: met.creditos_trivia, canje: met.creditos_canjeados, cuentas: met.cuentas }
    : {
        vendidos: filas.reduce((a, r) => a + r.vendidos, 0),
        ingresos: filas.reduce((a, r) => a + r.ingresos, 0),
        retenidos: funciones.reduce((a, f) => a + ocupacion(f.id).retenidos.size, 0),
        trivia: movs.filter((x) => x.tipo === "recarga" && x.ref.startsWith("Trivia")).reduce((a, x) => a + x.monto, 0),
        canje: -movs.filter((x) => x.tipo === "retención").reduce((a, x) => a + x.monto, 0),
        cuentas: Object.keys(cuentas).length,
      };
  const enCola = met ? Object.values(met.colas).reduce((a, n) => a + n, 0) : 0;
  const aforoTotal = SALAS.reduce((a, s) => a + s.aforo, 0);
  const fuente = met ? "API en vivo · se actualiza cada 5 s" : modoApi === "verificando" ? "Conectando con la API…" : "Datos del prototipo (sin API)";

  // ── Usuarios & roles
  const lista = Object.entries(cuentas);
  const porRol = (["cliente", "agente", "admin", "auditor"] as Rol[]).map((r) => ({
    rol: r,
    activos: lista.filter(([, c]) => c.rol === r && c.activo).length,
    baja: lista.filter(([, c]) => c.rol === r && !c.activo).length,
  }));
  const maxRol = Math.max(...porRol.map((r) => r.activos + r.baja), 1);
  const recientes = [...lista].sort((a, b) => b[1].creado.localeCompare(a[1].creado)).slice(0, 4);

  const proximas = filas.filter((r) => new Date(r.f.inicio) > new Date()).sort((a, b) => a.f.inicio.localeCompare(b.f.inicio)).slice(0, 6);
  const max = Math.max(...serie, 1);

  return (
    <div className="space-y-6">
      {/* 1 · Métricas clave */}
      <Caja icono="◩" titulo="Métricas clave" sub={fuente}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi titulo={met ? "Boletos vendidos hoy (en línea)" : "Boletos vendidos"} valor={k.vendidos.toLocaleString("es-GT")} detalle={met ? `${enCola} clientes en cola virtual` : `Ritmo simulado: ${serie[serie.length - 1]}/min`}>
            <Sparkline datos={serie} />
          </Kpi>
          <Kpi titulo={met ? "Ingresos de hoy" : "Ingresos"} valor={k.ingresos.toLocaleString("es-GT")} sufijo="créditos" detalle={met ? "Débitos confirmados en PostgreSQL" : "Boletos vendidos × precio"}>
            <Barra pct={(k.vendidos / Math.max(aforoTotal, 1)) * 100} />
          </Kpi>
          <Kpi titulo="Asientos retenidos (Redis TTL)" valor={String(k.retenidos)} detalle="Se liberan solos a los 5 min">
            <Barra pct={(k.retenidos / aforoTotal) * 100} />
          </Kpi>
          <Kpi titulo="Créditos trivia vs. canje" valor={k.trivia.toLocaleString("es-GT")} sufijo={`/ ${k.canje.toLocaleString("es-GT")} canjeados`} detalle={`${k.cuentas} cuentas registradas`}>
            <Barra pct={k.canje ? Math.min(100, (k.trivia / Math.max(k.canje, 1)) * 100) : 0} />
          </Kpi>
        </div>
      </Caja>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 2 · Gestión de usuarios & roles */}
        <Caja
          icono="◎"
          titulo="Gestión de usuarios & roles"
          sub={`${lista.filter(([, c]) => c.activo).length} cuentas activas · ${lista.filter(([, c]) => !c.activo).length} dadas de baja`}
          accion={
            <button onClick={() => ir("usuarios")} className="btn-borde px-3 py-2 text-[10px]">
              Administrar →
            </button>
          }
        >
          <ul className="space-y-2.5">
            {porRol.map((r) => (
              <li key={r.rol} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-xs">
                <span className="font-semibold">{ROL_TXT[r.rol].replace(" del Sistema", "")}</span>
                <span className="flex h-2 overflow-hidden rounded-full bg-fondo">
                  <span className="bg-arena" style={{ width: `${(r.activos / maxRol) * 100}%` }} />
                  <span className="bg-rojo/60" style={{ width: `${(r.baja / maxRol) * 100}%` }} />
                </span>
                <span className="w-20 text-right tabular-nums text-tenue">
                  <b className="text-tinta">{r.activos}</b>
                  {r.baja > 0 && <span className="text-salmon"> +{r.baja} baja</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="etiqueta mb-2 mt-5">Altas recientes</p>
          <ul className="divide-y divide-borde/60 text-sm">
            {recientes.map(([correo, c]) => (
              <li key={correo} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.nombre}</span>
                  <span className="block truncate text-[11px] text-tenue">{correo}</span>
                </span>
                <span className={c.activo ? "badge-borde" : "badge-vino"}>{c.activo ? ROL_TXT[c.rol].replace(" del Sistema", "") : "Baja"}</span>
              </li>
            ))}
          </ul>
        </Caja>

        {/* 3 · Bitácora de eventos */}
        <Caja
          icono="☰"
          titulo="Bitácora de eventos"
          sub={`${bitacora.length} registros · operaciones críticas (RNF-22)`}
          accion={
            <button onClick={() => ir("bitacora")} className="btn-borde px-3 py-2 text-[10px]">
              Ver completa →
            </button>
          }
        >
          {bitacora.length === 0 ? (
            <p className="text-sm text-tenue">Sin registros todavía.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-borde pl-4">
              {bitacora.slice(0, 7).map((l, i) => (
                <li key={i} className="relative text-xs">
                  <span
                    className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-panel ${
                      l.accion.includes("FALL") || l.accion.includes("EXPIR") || l.accion.includes("BAJA") ? "bg-rojo" : "bg-arena"
                    }`}
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-bold tracking-wide">{l.accion}</span>
                    <span className="text-apagado">{new Date(l.fecha).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <p className="truncate text-tenue" title={l.detalle}>
                    {l.usuario}
                    {l.detalle && ` · ${l.detalle}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Caja>
      </div>

      {/* 4 · Exportación de reportes */}
      <Caja icono="⤓" titulo="Exportación de reportes" sub="Archivos CSV (UTF-8) listos para Excel u hojas de cálculo · RF-13 · RF-47 · RF-48">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { t: "Ventas por función", d: `${filas.length} funciones · ${filas.reduce((a, r) => a + r.vendidos, 0).toLocaleString("es-GT")} boletos`, f: () => csvVentas(filas) },
            {
              t: "Bitácora de auditoría",
              d: `${bitacora.length} registros`,
              f: () => descargarCsv("bitacora", [["fecha", "usuario", "accion", "detalle"], ...bitacora.map((l) => [l.fecha, l.usuario, l.accion, l.detalle])]),
            },
            {
              t: "Usuarios y roles",
              d: `${lista.length} cuentas`,
              f: () =>
                descargarCsv("usuarios", [
                  ["nombre", "correo", "rol", "estado", "alta"],
                  ...lista.map(([correo, c]) => [c.nombre, correo, ROL_TXT[c.rol], c.activo ? "activo" : "baja", c.creado.slice(0, 10)]),
                ]),
            },
          ].map((x) => (
            <button key={x.t} onClick={x.f} className="group flex items-center justify-between gap-3 rounded-lg border border-borde bg-fondo/60 p-4 text-left transition-colors hover:border-arena">
              <span>
                <span className="block text-sm font-bold">{x.t}</span>
                <span className="block text-[11px] text-tenue">{x.d}</span>
              </span>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-borde text-arena group-hover:border-arena group-hover:text-tinta">⤓</span>
            </button>
          ))}
        </div>
      </Caja>

      {/* Operación en vivo */}
      <Caja icono="▦" titulo="Control de apertura y venta de taquilla" sub="Disponibilidad por sala y preventa">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-borde">
              <tr>
                <th className={thCls}>Película</th>
                <th className={thCls}>Formato</th>
                <th className={thCls}>Fecha / inicio</th>
                <th className={thCls}>Estado venta</th>
                <th className={thCls}>Ocupación</th>
                <th className={`${thCls} text-right`}>Rendimiento</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {proximas.map(({ f, vendidos, cap, ingresos }) => {
                const p = pelicula(f.peliculaId);
                const pct = Math.round((vendidos / cap) * 100);
                const estado = f.eventoId ? ["Preventa · cola virtual", "badge-vino"] : pct >= 100 ? ["Sold out", "badge-vino"] : ["En venta activa", "badge-borde"];
                return (
                  <tr key={f.id} className="border-b border-borde/60 last:border-0">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <Poster p={p} className="aspect-[2/3] w-9 shrink-0" rounded="rounded" sizes="36px" />
                        <div>
                          <p className="font-bold">{p.titulo}</p>
                          <p className="text-[11px] text-tenue">
                            {sala(f.salaId).nombre} · {sala(f.salaId).tipo}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="pr-3">
                      <span className="badge-borde">{f.formato}</span>
                    </td>
                    <td className="pr-3 text-xs">
                      <p className="font-semibold">{fmtFecha(f.inicio)}</p>
                      <p className="text-tenue">{fmtHora(f.inicio)} hrs</p>
                    </td>
                    <td className="pr-3">
                      <span className={estado[1]}>{estado[0]}</span>
                    </td>
                    <td className="w-44 pr-3">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span>{pct}%</span>
                        <span className="text-tenue">
                          {vendidos}/{cap}
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-fondo">
                        <div className="h-full origin-left rounded-full bg-rojo" style={{ transform: `scaleX(${pct / 100})` }} />
                      </div>
                    </td>
                    <td className="pr-3 text-right text-xs">
                      <p className="font-bold text-oro">◆ {ingresos.toLocaleString("es-GT")}</p>
                      <p className="text-tenue">créditos</p>
                    </td>
                    <td className="text-right">
                      <button onClick={() => setMapa(f)} className="btn-borde px-3 py-2 text-[10px]">
                        ▦ Ver mapa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Caja>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        {/* Gráfica de una sola serie: reservas confirmadas por minuto */}
        <Caja icono="▥" titulo="Reservas confirmadas por minuto" sub="Simulación · últimos 12 minutos, cada 2 s" accion={<span className="badge-borde">En vivo: {serie[serie.length - 1]}/min</span>}>
          <div className="relative h-56" onMouseLeave={() => setSobre(null)}>
            {[0.25, 0.5, 0.75, 1].map((g) => (
              <div key={g} className="absolute inset-x-0 border-t border-borde/50" style={{ bottom: `${g * 100}%` }}>
                <span className="absolute -top-2 right-0 bg-panel pl-1 text-[9px] text-apagado">{Math.round(max * g)}</span>
              </div>
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px] pr-6">
              {serie.map((v, i) => (
                <div key={i} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setSobre(i)}>
                  {/* scaleY en vez de height: la barra crece en el compositor sin recalcular el layout */}
                  <div
                    className={`h-full w-full origin-bottom rounded-t-[4px] bg-[#c8372d] transition-[transform,opacity] duration-500 ${sobre !== null && sobre !== i ? "opacity-50" : ""}`}
                    style={{ transform: `scaleY(${v / max})` }}
                  />
                  {sobre === i && (
                    <div
                      className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded border border-borde bg-fondo px-2 py-1 text-[11px] shadow-lg"
                      style={{ bottom: `calc(${(v / max) * 100}% + 8px)` }}
                    >
                      <b>{v}</b> <span className="text-tenue">reservas · hace {serie.length - 1 - i} min</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex justify-between pr-6 text-[9px] text-apagado">
            <span>−11 min</span>
            <span>ahora</span>
          </div>
        </Caja>

        {/* Eventos en vivo */}
        <Caja icono="⌁" titulo="Eventos en vivo" sub="Simulación de locks, tokens y pagos">
          <div className="h-56 space-y-1.5 overflow-hidden rounded-md border border-borde bg-fondo p-3 text-[11px] leading-relaxed">
            {log.length === 0 && <p className="text-apagado">Esperando eventos…</p>}
            {log.map((l, i) => (
              <m.p key={l + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={`truncate ${l.includes("Anti-bot") ? "text-salmon" : "text-tinta/85"}`}>
                {l}
              </m.p>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-tenue">
            <span>Buffer: {log.length} líneas</span>
            <button onClick={() => setPausado(!pausado)} className="text-salmon hover:text-white">
              {pausado ? "▶ Reanudar stream" : "❚❚ Pausar stream"}
            </button>
          </div>
        </Caja>
      </div>
      <Modal abierto={!!mapa} onCerrar={() => setMapa(null)} titulo="Mapa de la sala · solo lectura" ancho="max-w-3xl">
        {mapa && <MapaSoloLectura f={mapa} />}
      </Modal>
      <p className="text-[11px] text-apagado">
        {met
          ? "Métricas clave, ocupación y ventas vienen de /api/metricas. El ritmo por minuto y el flujo de eventos son una simulación visual."
          : "Sin API: ocupación, ventas y créditos se calculan con los datos del prototipo; ritmo y eventos en vivo son simulados."}
      </p>
    </div>
  );
}

/* Vista de ocupación para el personal: no permite seleccionar ni comprar */
function MapaSoloLectura({ f }: { f: Funcion }) {
  const { ocupacion, cargarOcupacion } = useApp();
  useEffect(() => {
    cargarOcupacion([f.id]);
  }, [f.id, cargarOcupacion]);
  const s = sala(f.salaId);
  const o = ocupacion(f.id);
  const pas = new Set(s.pasillos);
  const libres = s.aforo - o.vendidos.size - o.retenidos.size;
  return (
    <div>
      <p className="text-sm text-tenue">
        {pelicula(f.peliculaId).titulo} · {s.nombre} {s.tipo} · {fmtFecha(f.inicio)} {fmtHora(f.inicio)}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Vendidas", o.vendidos.size, "text-tinta"],
          ["Retenidas", o.retenidos.size, "text-arena"],
          ["Disponibles", libres, "text-oro"],
        ].map(([t, v, c]) => (
          <div key={t as string} className="rounded-md border border-borde bg-fondo py-2">
            <p className="etiqueta">{t}</p>
            <p className={`text-xl font-black ${c}`}>{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-md border border-borde bg-fondo p-3">
        <div className="mx-auto w-max">
          <div className="pantalla mx-auto mb-3 w-[90%]" />
          {Array.from({ length: s.filas }).map((_, fi) => (
            <div key={fi} className="mb-[3px] flex items-center gap-[3px]">
              <span className="w-4 text-center text-[9px] font-bold text-tenue">{FILAS[fi]}</span>
              {Array.from({ length: s.columnas }).map((_, c) => {
                const a = etiqueta(fi, c);
                const cls = o.vendidos.has(a) ? "bg-rojo/80" : o.retenidos.has(a) ? "bg-arena/60" : "bg-butaca";
                return (
                  <span key={a} className="flex">
                    <span title={a} className={`h-4 w-4 rounded-[3px] ${cls}`} />
                    {pas.has(c + 1) && <span className="w-2.5" />}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-[0.12em] text-tenue">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-butaca" /> Disponible</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-arena/60" /> Retenida (TTL)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-rojo/80" /> Vendida</span>
      </div>
      <p className="mt-2 text-[11px] text-apagado">El personal consulta la ocupación; la compra en línea es exclusiva de los clientes.</p>
    </div>
  );
}

function Kpi({ titulo, valor, sufijo, detalle, alerta, children }: { titulo: string; valor: string; sufijo?: string; detalle: string; alerta?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`tarjeta flex flex-col p-5 ${alerta ? "border-rojo/40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="etiqueta">{titulo}</p>
        {alerta && <span className="grid h-7 w-7 place-items-center rounded border border-rojo/60 bg-vino text-xs text-salmon">⛨</span>}
      </div>
      <p className="mt-2 text-4xl font-black tabular-nums">
        {valor}
        {sufijo && <span className="ml-1.5 text-xs font-semibold text-tenue">{sufijo}</span>}
      </p>
      <div className="mt-auto pt-4">
        {children}
        <p className="mt-2 text-[11px] text-tenue">{detalle}</p>
      </div>
    </div>
  );
}

function Sparkline({ datos }: { datos: number[] }) {
  const max = Math.max(...datos);
  const min = Math.min(...datos);
  const pts = datos.map((v, i) => `${(i / (datos.length - 1)) * 100},${30 - ((v - min) / Math.max(max - min, 1)) * 26 - 2}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none" aria-label="Tendencia de reservas por minuto">
      <polyline points={pts} fill="none" stroke="#c8372d" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Barra({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-fondo">
      <div className="h-full origin-left rounded-full bg-arena" style={{ transform: `scaleX(${Math.max(2, Math.min(100, pct)) / 100})` }} />
    </div>
  );
}

/* ─────────── Usuarios: crear, editar y dar de baja (RF-15, RF-44) ─────────── */
type AccionUsuario = { tipo: "crear" } | { tipo: "editar"; correo: string } | { tipo: "estado"; correo: string; activo: boolean };

const PERMISOS: [Rol, string][] = [
  ["cliente", "Cartelera, compra con créditos, Mis Entradas y trivia."],
  ["agente", "Programación de funciones, inventario de salas y validación de accesos."],
  ["admin", "Control total: métricas, gestión de usuarios y roles, parámetros, reportes y bitácora."],
  ["auditor", "Sólo lectura de reportes y bitácora; no puede modificar información."],
];

function Usuarios() {
  const { cuentas, usuario, adminVerificado, verificarAdmin, crearUsuario, editarUsuario, cambiarEstadoUsuario, toast } = useApp();
  const [filtro, setFiltro] = useState<Rol | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [pendiente, setPendiente] = useState<AccionUsuario | null>(null); // acción que espera la reautenticación
  const [accion, setAccion] = useState<AccionUsuario | null>(null);
  const [clave, setClave] = useState("");
  const [errorClave, setErrorClave] = useState("");
  const [intentos, setIntentos] = useState(0);
  const [form, setForm] = useState({ nombre: "", correo: "", rol: "agente" as Rol, clave: "" });
  const [errorForm, setErrorForm] = useState("");

  const abrir = (a: AccionUsuario) => {
    setErrorForm("");
    if (a.tipo === "crear") setForm({ nombre: "", correo: "", rol: "agente", clave: "" });
    if (a.tipo === "editar") setForm({ nombre: cuentas[a.correo].nombre, correo: a.correo, rol: cuentas[a.correo].rol, clave: "" });
    if (adminVerificado) setAccion(a);
    else {
      setClave("");
      setErrorClave("");
      setPendiente(a);
    }
  };

  const confirmarIdentidad = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificarAdmin(clave)) {
      setAccion(pendiente);
      setPendiente(null);
      setIntentos(0);
      return;
    }
    const n = intentos + 1;
    setIntentos(n);
    setClave("");
    if (n >= 3) {
      setPendiente(null);
      setIntentos(0);
      toast("Demasiados intentos fallidos. La acción fue cancelada y quedó registrada en la bitácora.", "error");
    } else setErrorClave(`Contraseña incorrecta. Te quedan ${3 - n} intento(s).`);
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accion) return;
    const r =
      accion.tipo === "crear"
        ? crearUsuario(form)
        : accion.tipo === "editar"
          ? editarUsuario(accion.correo, { nombre: form.nombre, rol: form.rol })
          : cambiarEstadoUsuario(accion.correo, accion.activo);
    if (!r.ok) return setErrorForm(r.error!);
    toast(
      accion.tipo === "crear"
        ? `Cuenta creada para ${form.correo} (${ROL_TXT[form.rol]}).`
        : accion.tipo === "editar"
          ? "Cambios guardados."
          : accion.activo
            ? "Cuenta reactivada."
            : "Cuenta dada de baja. Su historial se conserva.",
      "ok",
    );
    setAccion(null);
  };

  const filas = Object.entries(cuentas)
    .filter(([c, x]) => (filtro === "todos" || x.rol === filtro) && (c + x.nombre).toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => Number(b[1].activo) - Number(a[1].activo) || a[1].rol.localeCompare(b[1].rol));
  const objetivo = accion && accion.tipo !== "crear" ? cuentas[accion.correo] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["todos", "cliente", "agente", "admin", "auditor"] as const).map((r) => (
          <button key={r} onClick={() => setFiltro(r)} className={`chip ${filtro === r ? "!border-oro text-oro" : ""}`}>
            {r === "todos" ? "Todos" : ROL_TXT[r]} <span className="text-tenue">{r === "todos" ? Object.keys(cuentas).length : Object.values(cuentas).filter((x) => x.rol === r).length}</span>
          </button>
        ))}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre o correo…" className="campo !mt-0 w-full sm:ml-auto sm:w-64" />
        <button onClick={() => abrir({ tipo: "crear" })} className="btn-vino w-full sm:w-auto">
          ⊕ Nuevo usuario
        </button>
      </div>

      <p className={`flex items-center gap-2 text-xs ${adminVerificado ? "text-oro" : "text-tenue"}`}>
        <span>{adminVerificado ? "🔓" : "🔒"}</span>
        {adminVerificado
          ? "Identidad de administrador verificada: puedes gestionar usuarios durante 5 minutos."
          : "Por seguridad, crear, editar o dar de baja usuarios exige reconfirmar tu contraseña de administrador."}
      </p>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-borde">
            <tr>
              <th className={thCls}>Usuario</th>
              <th className={thCls}>Rol</th>
              <th className={thCls}>Estado</th>
              <th className={`${thCls} text-right`}>Saldo</th>
              <th className={`${thCls} text-right`}>Boletos</th>
              <th className={thCls}>Alta</th>
              <th className={`${thCls} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(([correo, c]) => {
              const yo = correo === usuario?.correo;
              return (
                <tr key={correo} className={`border-b border-borde/60 last:border-0 ${c.activo ? "" : "opacity-55"}`}>
                  <td className="py-3 pr-3">
                    <p className="font-bold">
                      {c.nombre} {yo && <span className="badge-borde ml-1">Tú</span>}
                    </p>
                    <p className="text-[11px] text-tenue">{correo}</p>
                  </td>
                  <td className="pr-3">
                    <span className={c.rol === "cliente" ? "badge-borde" : "badge-vino"}>{ROL_TXT[c.rol]}</span>
                  </td>
                  <td className="pr-3 text-xs font-bold">{c.activo ? <span className="text-oro">● Activo</span> : <span className="text-salmon">● Dado de baja</span>}</td>
                  <td className="pr-3 text-right font-bold text-oro">{c.rol === "cliente" ? `◆ ${c.saldo}` : "—"}</td>
                  <td className="pr-3 text-right">{c.boletos.length}</td>
                  <td className="pr-3 text-xs text-tenue">{new Date(c.creado).toLocaleDateString("es-GT")}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => abrir({ tipo: "editar", correo })} disabled={!c.activo} className="btn-borde px-3 py-2 text-[10px]">
                        ✎ Editar
                      </button>
                      {c.activo ? (
                        <button onClick={() => abrir({ tipo: "estado", correo, activo: false })} disabled={yo} title={yo ? "No puedes darte de baja a ti mismo" : ""} className="btn-borde px-3 py-2 text-[10px] hover:!border-rojo hover:!text-salmon">
                          🗑 Eliminar
                        </button>
                      ) : (
                        <button onClick={() => abrir({ tipo: "estado", correo, activo: true })} className="btn-borde px-3 py-2 text-[10px]">
                          ↺ Reactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filas.length === 0 && <p className="py-6 text-center text-sm text-tenue">No hay usuarios con ese filtro.</p>}
      </div>

      <div className={card}>
        <p className="etiqueta text-oro">Permisos por rol (control de acceso basado en roles, RF-44)</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PERMISOS.map(([r, t]) => (
            <div key={r} className="rounded-md border border-borde bg-fondo p-3">
              <span className={r === "cliente" ? "badge-borde" : "badge-vino"}>{ROL_TXT[r]}</span>
              <p className="mt-2 text-xs text-tenue">{t}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-apagado">
          Reglas: sólo el Administrador del Sistema gestiona usuarios; no puede cambiar su propio rol ni darse de baja; siempre debe quedar al menos un administrador activo. Las
          cuentas eliminadas se dan de baja (no pueden iniciar sesión) y su historial se conserva para auditoría.
        </p>
      </div>

      {/* Reautenticación del administrador */}
      <Modal abierto={!!pendiente} onCerrar={() => setPendiente(null)} titulo="Confirma tu identidad" z="z-[55]">
        <form onSubmit={confirmarIdentidad} className="space-y-3">
          <p className="text-sm text-tenue">
            Para gestionar usuarios y roles vuelve a ingresar la contraseña de <b className="text-tinta">{usuario?.correo}</b>. La verificación dura 5 minutos.
          </p>
          <input type="password" autoFocus value={clave} onChange={(e) => { setClave(e.target.value); setErrorClave(""); }} placeholder="Contraseña de administrador" autoComplete="current-password" className="campo" />
          {errorClave && <p className="text-sm text-salmon">{errorClave}</p>}
          <button className="btn-vino w-full py-3.5">Verificar y continuar</button>
          <p className="text-center text-[11px] text-apagado">
            Prototipo: la contraseña del administrador de demostración es <code className="text-tinta">{CLAVE_DEMO}</code>
          </p>
        </form>
      </Modal>

      {/* Crear / editar */}
      <Modal abierto={accion?.tipo === "crear" || accion?.tipo === "editar"} onCerrar={() => setAccion(null)} titulo={accion?.tipo === "crear" ? "Nuevo usuario" : "Editar usuario"}>
        <form onSubmit={guardar} className="space-y-4">
          <label className="etiqueta block">
            Nombre completo
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="campo normal-case tracking-normal" />
          </label>
          <label className="etiqueta block">
            Correo electrónico
            <input
              type="email"
              value={form.correo}
              disabled={accion?.tipo === "editar"}
              onChange={(e) => setForm({ ...form, correo: e.target.value })}
              className="campo normal-case tracking-normal disabled:opacity-60"
            />
          </label>
          <label className="etiqueta block">
            Rol
            <select
              value={form.rol}
              disabled={accion?.tipo === "editar" && accion.correo === usuario?.correo}
              onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
              className="campo normal-case tracking-normal disabled:opacity-60"
            >
              {(["agente", "auditor", "admin", "cliente"] as Rol[]).map((r) => (
                <option key={r} value={r}>
                  {ROL_TXT[r]}
                </option>
              ))}
            </select>
          </label>
          <p className="-mt-2 text-[11px] text-tenue">{PERMISOS.find(([r]) => r === form.rol)?.[1]}</p>
          {accion?.tipo === "crear" && (
            <label className="etiqueta block">
              Contraseña temporal (mín. 8 caracteres)
              <input type="password" value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} autoComplete="new-password" className="campo" />
            </label>
          )}
          {errorForm && <p className="rounded-md border border-rojo/60 bg-vino/50 p-2.5 text-sm text-salmon">{errorForm}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAccion(null)} className="btn-borde flex-1">
              Cancelar
            </button>
            <button className="btn-vino flex-1">{accion?.tipo === "crear" ? "Crear cuenta" : "Guardar cambios"}</button>
          </div>
        </form>
      </Modal>

      {/* Dar de baja / reactivar */}
      <Modal abierto={accion?.tipo === "estado"} onCerrar={() => setAccion(null)} titulo={accion?.tipo === "estado" && accion.activo ? "¿Reactivar la cuenta?" : "¿Eliminar la cuenta?"}>
        {objetivo && accion?.tipo === "estado" && (
          <form onSubmit={guardar}>
            <p className="text-sm text-tenue">
              {accion.activo ? (
                <>
                  <b className="text-tinta">{objetivo.nombre}</b> podrá volver a iniciar sesión con su rol de {ROL_TXT[objetivo.rol]}.
                </>
              ) : (
                <>
                  <b className="text-tinta">{objetivo.nombre}</b> ({accion.correo}) ya no podrá iniciar sesión. Su historial de compras y operaciones se conserva para
                  auditoría.
                </>
              )}
            </p>
            {errorForm && <p className="mt-3 rounded-md border border-rojo/60 bg-vino/50 p-2.5 text-sm text-salmon">{errorForm}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setAccion(null)} className="btn-borde flex-1">
                Cancelar
              </button>
              <button className="btn-vino flex-1">{accion.activo ? "Reactivar" : "Sí, eliminar"}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/* ─────────── Programación (RF-05, RF-31, RF-67) ─────────── */
function Programar() {
  const { funciones, programarFuncion } = useApp();
  const [exito, setExito] = useState<Funcion | null>(null);
  const [manana] = useState(() => new Date(Date.now() + 86400000).toLocaleDateString("en-CA"));
  const [peli, setPeli] = useState(PELICULAS[0].id);
  const [salaId, setSalaId] = useState("s1");
  const [fecha, setFecha] = useState(manana);
  const [hora, setHora] = useState("15:00");
  const [precio, setPrecio] = useState(50);
  const [conflicto, setConflicto] = useState<{ con: Funcion; libres: string[] } | null>(null);

  const crearF = (h: string, id = "nueva"): Funcion => ({
    id,
    peliculaId: peli,
    salaId,
    inicio: new Date(`${fecha}T${h}:00`).toISOString(),
    formato: sala(salaId).tipo === "Tradicional" ? "2D" : sala(salaId).tipo,
    idioma: pelicula(peli).idioma,
    precio,
  });
  const choca = (f: Funcion) => funciones.find((o) => o.salaId === f.salaId && new Date(f.inicio) < finFuncion(o) && new Date(o.inicio) < finFuncion(f));

  const guardar = () => {
    const f = crearF(hora, "f" + Date.now().toString(36));
    const c = choca(f);
    if (c) {
      const libres: string[] = [];
      for (let m = 10 * 60; m <= 22 * 60 && libres.length < 6; m += 30) {
        const h = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        if (!choca(crearF(h))) libres.push(h);
      }
      setConflicto({ con: c, libres });
      return;
    }
    setConflicto(null);
    programarFuncion(f);
    setExito(f);
  };

  const ocupadas = funciones.filter((o) => o.salaId === salaId && new Date(o.inicio).toLocaleDateString("en-CA") === fecha).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const fin = finFuncion(crearF(hora));
  const enCartelera = PELICULAS.filter((p) => p.categoria !== "proximamente");

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className={`${card} space-y-4`}>
        <label className="etiqueta block">
          Película
          <select value={peli} onChange={(e) => setPeli(e.target.value)} className="campo normal-case tracking-normal">
            {enCartelera.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo} ({p.duracion} min)
              </option>
            ))}
          </select>
        </label>
        <label className="etiqueta block">
          Sala
          <select value={salaId} onChange={(e) => setSalaId(e.target.value)} className="campo normal-case tracking-normal">
            {SALAS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} · {s.tipo}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="etiqueta">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="campo" />
          </label>
          <label className="etiqueta">
            Hora inicio
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="campo" />
          </label>
          <label className="etiqueta">
            Precio (cr.)
            <input type="number" min={0} value={precio} onChange={(e) => setPrecio(+e.target.value)} className="campo" />
          </label>
        </div>
        <p className="text-xs text-tenue">
          Hora final calculada: <b className="text-oro">{fmtHora(fin)}</b> (duración {pelicula(peli).duracion} min + {PARAMETROS.limpiezaMinutos} min de limpieza)
        </p>
        <button onClick={guardar} className="btn-vino w-full py-3.5">
          ⊕ Programar y publicar
        </button>
        {conflicto && (
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-md border border-rojo/60 bg-vino/40 p-3 text-sm">
            <p className="font-bold text-salmon">Conflicto de horario</p>
            <p className="text-salmon/80">
              Se traslapa con «{pelicula(conflicto.con.peliculaId).titulo}» ({fmtHora(conflicto.con.inicio)}–{fmtHora(finFuncion(conflicto.con))}).
            </p>
            <p className="etiqueta mt-2">Horarios libres sugeridos</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {conflicto.libres.map((h) => (
                <button key={h} onClick={() => { setHora(h); setConflicto(null); }} className="chip">
                  {h}
                </button>
              ))}
            </div>
          </m.div>
        )}
      </div>
      <div className={card}>
        <h3 className="titulo mb-4 text-sm">
          {sala(salaId).nombre} · {sala(salaId).tipo} · {fmtFecha(fecha + "T12:00:00")}
        </h3>
        {ocupadas.length === 0 ? (
          <p className="text-sm text-tenue">Sin funciones este día.</p>
        ) : (
          <ul className="space-y-2">
            {ocupadas.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 rounded-md border border-borde bg-fondo px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Poster p={pelicula(o.peliculaId)} className="aspect-[2/3] w-7" rounded="rounded-sm" sizes="28px" />
                  {pelicula(o.peliculaId).titulo}
                </span>
                <span className="text-xs font-bold text-tenue">
                  {fmtHora(o.inicio)}–{fmtHora(finFuncion(o))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal abierto={!!exito} onCerrar={() => setExito(null)}>
        {exito && (
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-oro/60 bg-oro/15 text-xl text-oro">✓</div>
            <h2 className="titulo mt-3 text-xl">Función programada con éxito</h2>
            <p className="mt-2 text-sm text-tenue">
              {pelicula(exito.peliculaId).titulo} · {sala(exito.salaId).nombre} · {fmtFecha(exito.inicio)} {fmtHora(exito.inicio)}–{fmtHora(finFuncion(exito))}
            </p>
            <p className="mt-1 text-xs text-apagado">Se generó la matriz de {sala(exito.salaId).aforo} asientos y la función ya aparece en la cartelera.</p>
            <button onClick={() => setExito(null)} className="btn-vino mt-5 w-full">
              Aceptar
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ─────────── Inventario (RF-66) ─────────── */
function Inventario() {
  const { funciones, ocupacion } = useApp();
  useOcupacionVigente();
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-borde">
          <tr>
            <th className={thCls}>Función</th>
            <th className={thCls}>Sala</th>
            <th className={`${thCls} text-right`}>Capacidad</th>
            <th className={`${thCls} text-right`}>Vendidos</th>
            <th className={`${thCls} text-right`}>Retenidos</th>
            <th className={`${thCls} text-right`}>Disponibles</th>
          </tr>
        </thead>
        <tbody>
          {funciones.map((f) => {
            const o = ocupacion(f.id);
            const cap = sala(f.salaId).aforo;
            return (
              <tr key={f.id} className="border-b border-borde/60 last:border-0">
                <td className="py-2.5 pr-3">
                  <p className="font-bold">{pelicula(f.peliculaId).titulo}</p>
                  <p className="text-[11px] text-tenue">
                    {fmtFecha(f.inicio)} {fmtHora(f.inicio)}
                  </p>
                </td>
                <td className="pr-3 text-xs">
                  {sala(f.salaId).nombre} · {sala(f.salaId).tipo}
                </td>
                <td className="pr-3 text-right">{cap}</td>
                <td className="pr-3 text-right">{o.vendidos.size}</td>
                <td className="pr-3 text-right text-arena">{o.retenidos.size}</td>
                <td className="text-right font-bold text-oro">{cap - o.vendidos.size - o.retenidos.size}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────── Validar acceso (RF-09, RF-27, RF-28) ─────────── */
function Validar() {
  const { validarBoleto, cuentas, funciones, modoApi } = useApp();
  const [codigo, setCodigo] = useState("");
  const [res, setRes] = useState<Validacion | null>(null);
  const [validando, setValidando] = useState(false);
  // Con la API, la validación es atómica en PostgreSQL (POST /api/boletos/{token}/validar).
  const validar = async (c = codigo) => {
    if (!c.trim() || validando) return;
    setValidando(true);
    try {
      setRes(await validarBoleto(c.trim()));
    } finally {
      setValidando(false);
    }
  };
  const f = res?.boleto && funciones.find((x) => x.id === res.boleto!.funcionId);
  const recientes =
    modoApi === "conectado"
      ? []
      : Object.values(cuentas)
          .flatMap((c) => c.boletos)
          .sort((a, b) => b.emitido.localeCompare(a.emitido))
          .slice(0, 5);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className={`${card} space-y-4`}>
        <label className="etiqueta block">
          Código del boleto (lector QR en modo teclado)
          <input autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && validar()} placeholder="CE-…" className="campo normal-case tracking-normal" />
        </label>
        <button onClick={() => validar()} disabled={validando} className="btn-vino w-full py-3.5 disabled:opacity-60">
          {validando ? "Validando…" : "Validar"}
        </button>
        {modoApi === "conectado" && (
          <p className="text-xs text-apagado">Conectado a la API: pega el token de un boleto comprado (Mis Entradas → abrir QR). Cada boleto sólo puede validarse una vez.</p>
        )}
        {recientes.length > 0 && (
          <div>
            <p className="etiqueta mb-1.5">Boletos emitidos recientemente (para probar)</p>
            {recientes.map((b) => (
              <button key={b.token} onClick={() => { setCodigo(b.token); validar(b.token); }} className="block truncate py-0.5 text-xs text-salmon hover:text-white">
                {b.token} · {b.asiento} · {b.titular}
              </button>
            ))}
          </div>
        )}
      </div>
      {res && (
        <m.div
          key={JSON.stringify(res)}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`grid place-items-center rounded-xl border p-8 text-center ${res.ok ? "border-oro/50 bg-oro/10" : "border-rojo/60 bg-vino/50"}`}
        >
          <div>
            <div className={`text-6xl font-black ${res.ok ? "text-oro" : "text-salmon"}`}>{res.ok ? "✓" : "✕"}</div>
            <p className="titulo mt-2 text-xl">{res.motivo}</p>
            {f && (
              <p className="mt-1 text-sm text-tenue">
                {pelicula(f.peliculaId).titulo} · {sala(f.salaId).nombre} · {fmtHora(f.inicio)} · Butaca {res.boleto!.asiento}
              </p>
            )}
            {res.boleto?.titular && <p className="mt-1 text-xs text-apagado">Titular: {res.boleto.titular}</p>}
          </div>
        </m.div>
      )}
    </div>
  );
}

/* ─────────── Parámetros (RF-57) ─────────── */
function Parametros() {
  const { registrar, toast } = useApp();
  const [vals, setVals] = useState<Record<string, number>>({ ...PARAMETROS });
  const NOMBRES: Record<string, string> = {
    retencionMinutos: "Tiempo de retención de asientos (min)",
    turnoColaMinutos: "Vigencia del turno de la cola (min)",
    maxButacasPorTransaccion: "Máximo de butacas por transacción",
    maxBoletosPorEvento: "Máximo de boletos por cliente (preestreno)",
    limpiezaMinutos: "Tiempo de limpieza entre funciones (min)",
    costoBoleto: "Costo base por boleto (créditos)",
    bonoBienvenida: "Bono de bienvenida por cuenta nueva",
    preguntasTrivia: "Preguntas por partida de trivia",
    creditosPorRespuesta: "Créditos por respuesta correcta (trivia)",
    bonoTriviaPerfecta: "Premio por acertar todas (trivia)",
    inactividadMinutos: "Cierre de sesión por inactividad (min)",
    intentosFallidos: "Intentos fallidos antes de bloquear",
    limiteSolicitudesMin: "Límite de solicitudes por minuto",
    iva: "IVA",
  };
  return (
    <div className={`${card} max-w-3xl space-y-3`}>
      {Object.entries(vals).map(([k, v]) => (
        <label key={k} className="flex items-center justify-between gap-4 border-b border-borde pb-3 text-sm">
          <span>{NOMBRES[k] ?? k}</span>
          <input
            type="number"
            step={k === "iva" ? 0.01 : 1}
            value={v}
            onChange={(e) => setVals({ ...vals, [k]: +e.target.value })}
            className="w-24 rounded-md border border-borde bg-fondo px-2 py-1.5 text-right font-bold text-oro outline-none focus:border-arena"
          />
        </label>
      ))}
      <button onClick={() => { registrar("PARAMETROS_ACTUALIZADOS", JSON.stringify(vals)); toast("Parámetros guardados (registrado en bitácora).", "ok"); }} className="btn-vino">
        Guardar cambios
      </button>
      <p className="text-xs text-apagado">En el prototipo solo se registra el cambio en la bitácora; el backend los guardaría en la tabla parametros_globales.</p>
    </div>
  );
}

/* ─────────── Reportes (RF-13, RF-47, RF-48) ─────────── */
function Reportes() {
  const met = useMetricas();
  useOcupacionVigente();
  const filas = useFilasVentas(met);
  const total = filas.reduce((a, r) => a + r.ingresos, 0);
  const boletos = filas.reduce((a, r) => a + r.vendidos, 0);
  const ocupacionProm = Math.round((boletos / Math.max(filas.reduce((a, r) => a + r.cap, 0), 1)) * 100);
  const exportar = () => csvVentas(filas);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi titulo="Boletos vendidos" valor={boletos.toLocaleString("es-GT")} detalle={`${filas.length} funciones`} />
        <Kpi titulo="Ocupación promedio" valor={`${ocupacionProm}%`} detalle="sobre el aforo total" />
        <Kpi titulo="Ingresos" valor={total.toLocaleString("es-GT")} sufijo="créditos" detalle="boletos" />
      </div>
      <div className={`${card} overflow-x-auto`}>
        <div className="mb-4 flex items-center justify-between">
          <p className="etiqueta">Detalle por función</p>
          <button onClick={exportar} className="btn-borde px-3 py-2 text-[10px]">
            ⤓ Exportar CSV
          </button>
        </div>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-borde">
            <tr>
              <th className={thCls}>Película</th>
              <th className={thCls}>Función</th>
              <th className={`${thCls} text-right`}>Vendidos</th>
              <th className={`${thCls} w-44`}>Ocupación</th>
              <th className={`${thCls} text-right`}>Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => {
              const pct = Math.round((r.vendidos / r.cap) * 100);
              return (
                <tr key={r.f.id} className="border-b border-borde/60 last:border-0">
                  <td className="py-2.5 pr-3 font-bold">{pelicula(r.f.peliculaId).titulo}</td>
                  <td className="pr-3 text-xs text-tenue">
                    {sala(r.f.salaId).nombre} · {fmtFecha(r.f.inicio)} {fmtHora(r.f.inicio)}
                  </td>
                  <td className="pr-3 text-right">
                    {r.vendidos}/{r.cap}
                  </td>
                  <td className="pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-fondo">
                        <div className="h-full origin-left rounded-full bg-rojo" style={{ transform: `scaleX(${pct / 100})` }} />
                      </div>
                      <span className="w-9 text-right text-xs font-bold">{pct}%</span>
                    </div>
                  </td>
                  <td className="text-right font-bold text-oro">{r.ingresos}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────── Bitácora (RF-55, RNF-22) ─────────── */
function Bitacora() {
  const { bitacora } = useApp();
  return (
    <div className={`${card} overflow-x-auto`}>
      {bitacora.length === 0 ? (
        <p className="text-sm text-tenue">Sin registros todavía. Las operaciones (ventas, reservas, validaciones, cambios) aparecen aquí.</p>
      ) : (
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-borde">
            <tr>
              <th className={thCls}>Fecha y hora</th>
              <th className={thCls}>Usuario</th>
              <th className={thCls}>Acción</th>
              <th className={thCls}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {bitacora.map((l, i) => (
              <tr key={i} className="border-b border-borde/60 align-top last:border-0">
                <td className="whitespace-nowrap py-2 pr-3 text-xs text-tenue">{new Date(l.fecha).toLocaleString("es-GT")}</td>
                <td className="pr-3 text-xs">{l.usuario}</td>
                <td className="pr-3">
                  <span className={l.accion.includes("FALL") || l.accion.includes("EXPIR") ? "badge-vino" : "badge-borde"}>{l.accion}</span>
                </td>
                <td className="max-w-xs truncate py-2 text-xs text-tenue" title={l.detalle}>
                  {l.detalle}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
