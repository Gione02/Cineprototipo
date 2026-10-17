"use client";

// Estado de la aplicación.
//
// Con la API en Go disponible (NEXT_PUBLIC_API_URL + `docker compose up`), el catálogo, la ocupación de butacas,
// las reservas (Redis, TTL 5 min), los pagos (PostgreSQL, SELECT … FOR UPDATE), el saldo, los boletos,
// la trivia y la validación de acceso se leen y escriben en el backend.
// Sin API, el prototipo simula todo eso en el navegador (localStorage), como antes.
// El inicio de sesión, los roles, la gestión de usuarios y la bitácora siguen siendo locales (pendiente: JWT + bcrypt).

import { Suspense, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "framer-motion";
import { Ban, CircleCheck, Lock, Timer, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Boton } from "@/components/ui/Boton";
import { codigoDinamico, ventanaActual } from "@/utils/seguridad";
import { restablecerScroll } from "@/hooks/useBloqueoScroll";
import { limpiarTurnos } from "@/utils/turnoCola";
import { ApiError, api, apiConfigurada } from "@/services/api";
import { boletoDeApi, funcionDeApi, movimientoDeApi, peliculaDeApi } from "@/services/mapeadores";
import type { AsientosApi, CuentaApi, EventoAsientosApi } from "@/types/api";
import { CLAVE_DEMO, PELICULAS, USUARIOS_DEMO, funcionesBase, ocupacionSimulada, registrarPeliculas } from "@/data/catalogo";
import { funcionQueChoca } from "@/utils/programacion";
import { PARAMETROS } from "@/data/parametros";
import type { Funcion, NuevaFuncion, NuevaPelicula, Pelicula, Rol } from "@/types/catalogo";
import type { Boleto, Cuenta, Log, ModoApi, Movimiento, Reserva, Resultado, Usuario, Validacion } from "@/types/cuenta";


type Estado = {
  usuario: Usuario | null;
  cuentas: Record<string, Cuenta>; // clave: correo del usuario
  reserva: Reserva | null;
  funcionesExtra: Funcion[]; // programadas sin API (modo demostración)
  peliculasExtra: Pelicula[]; // creadas sin API (modo demostración; el póster va como data URL)
  bitacora: Log[];
};

const INICIAL: Estado = { usuario: null, cuentas: {}, reserva: null, funcionesExtra: [], peliculasExtra: [], bitacora: [] };

type Toast = { id: number; texto: string; tipo: "ok" | "error" | "info" };
type Aviso = { titulo: string; texto: string; icono: LucideIcon };
type Ocupacion = { vendidos: Set<string>; retenidos: Set<string> };

type Ctx = {
  listo: boolean;
  modoApi: ModoApi;
  usuario: Usuario | null;
  saldo: number;
  movimientos: Movimiento[];
  boletos: Boleto[];
  cuentas: Record<string, Cuenta>;
  reserva: Reserva | null;
  bitacora: Log[];
  funciones: Funcion[];
  ocupacion: (funcionId: string) => Ocupacion;
  // Con la API, trae del backend las butacas vendidas y retenidas de esas funciones (sin API no hace nada).
  cargarOcupacion: (funcionIds: string[]) => Promise<void>;
  // Tiempo real (SSE): reemplaza la foto de ocupación o aplica un cambio puntual de butacas.
  fijarOcupacion: (funcionId: string, datos: AsientosApi) => void;
  aplicarEventoAsientos: (ev: EventoAsientosApi) => void;
  // Candado individual de una butaca mientras el cliente arma su selección (SET NX EX en Redis).
  bloquearAsiento: (funcionId: string, asiento: string) => Promise<Resultado>;
  liberarAsientos: (funcionId: string, asientos: string[]) => void;
  // Butacas que el cliente ya tenía bloqueadas en esa función (p. ej. tras recargar la página).
  misBloqueos: (funcionId: string) => Promise<string[]>;
  refrescarCuenta: () => Promise<void>;
  login: (u: Usuario) => void;
  iniciarSesion: (correo: string, clave: string) => Resultado;
  registrarCliente: (nombre: string, correo: string, clave: string) => Resultado;
  // Gestión de usuarios: sólo Administrador del Sistema y tras reconfirmar su contraseña.
  adminVerificado: boolean;
  verificarAdmin: (clave: string) => boolean;
  crearUsuario: (d: { nombre: string; correo: string; rol: Rol; clave: string }) => Resultado;
  editarUsuario: (correo: string, d: { nombre: string; rol: Rol }) => Resultado;
  cambiarEstadoUsuario: (correo: string, activo: boolean) => Resultado;
  logout: () => void;
  reservar: (funcionId: string, asientos: string[]) => Promise<Resultado>;
  cancelarReserva: (motivo?: "cancelada" | "expirada") => void;
  retenerCreditos: () => Resultado;
  pagar: () => Promise<Resultado & { boletos?: Boleto[] }>;
  acreditarTrivia: (partidaId: string, aciertos: number) => Promise<{ ok: boolean; monto: number; error?: string }>;
  validarBoleto: (token: string) => Promise<Validacion>;
  // Catálogo editable (agente operativo y administrador). Con la API se guarda en PostgreSQL.
  peliculas: Pelicula[];
  crearPelicula: (p: NuevaPelicula, funciones: NuevaFuncion[]) => Promise<Resultado & { id?: string; funciones?: number }>;
  programarFuncion: (f: NuevaFuncion & { peliculaId: string }) => Promise<Resultado & { id?: string }>;
  registrar: (accion: string, detalle: string) => void;
  toast: (texto: string, tipo?: Toast["tipo"]) => void;
  // Inicio de sesión en ventana emergente: el usuario no sale de la página en la que está.
  loginAbierto: boolean;
  loginUsado: boolean;
  abrirLogin: (modo?: "login" | "registro") => void;
  cerrarLogin: () => void;
  modoLogin: "login" | "registro";
  // Trivia en ventana emergente: se abre encima de la compra sin desmontarla ni perder la selección.
  triviaAbierta: boolean;
  triviaUsada: boolean;
  abrirTrivia: () => void;
  cerrarTrivia: () => void;
};

const AppCtx = createContext<Ctx | null>(null);
const CLAVE = "cineight-prototipo-v3";
const VERIFICACION_ADMIN_MS = 5 * 60000;
const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();
const ahoraISO = () => new Date().toISOString();

// Premio de una partida: 10 créditos por acierto; si acierta todas, 50. (Con la API lo calcula el servidor.)
export const premioTrivia = (aciertos: number) =>
  aciertos === PARAMETROS.preguntasTrivia ? PARAMETROS.bonoTriviaPerfecta : aciertos * PARAMETROS.creditosPorRespuesta;

// Hash de demostración (FNV-1a con sal = correo). En producción: bcrypt en el backend (RNF-09).
export function hashClave(correo: string, clave: string) {
  let h = 2166136261;
  for (const ch of `${correo.toLowerCase()}::${clave}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return "h1$" + (h >>> 0).toString(36);
}

const cuentaNueva = (nombre: string, correo: string, rol: Rol, clave: string): Cuenta => ({
  nombre,
  rol,
  activo: true,
  claveHash: hashClave(correo, clave),
  creado: ahoraISO(),
  saldo: rol === "cliente" ? PARAMETROS.bonoBienvenida : 0,
  movimientos: rol === "cliente" ? [{ id: uid(), tipo: "recarga", monto: PARAMETROS.bonoBienvenida, ref: "Bono de bienvenida", fecha: ahoraISO() }] : [],
  boletos: [],
  partidasCobradas: [],
});

// Garantiza que existan las cuentas de demostración.
function conDemos(cuentas: Record<string, Cuenta>): Record<string, Cuenta> {
  const out = { ...cuentas };
  for (const d of USUARIOS_DEMO) if (!out[d.correo]) out[d.correo] = cuentaNueva(d.nombre, d.correo, d.rol, CLAVE_DEMO);
  return out;
}

const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);
const adminsActivos = (c: Record<string, Cuenta>) => Object.values(c).filter((x) => x.rol === "admin" && x.activo).length;

function log(s: Estado, accion: string, detalle: string): Log[] {
  return [{ fecha: ahoraISO(), usuario: s.usuario?.correo ?? "sistema", accion, detalle }, ...s.bitacora].slice(0, 300);
}

// Actualiza la cuenta de un usuario concreto sin tocar las demás.
function conCuenta(s: Estado, correo: string, f: (c: Cuenta) => Cuenta): Record<string, Cuenta> {
  const c = s.cuentas[correo];
  return c ? { ...s.cuentas, [correo]: f(c) } : s.cuentas;
}

const todosLosBoletos = (s: Estado) => Object.values(s.cuentas).flatMap((c) => c.boletos);


// Red de seguridad del bloqueo de scroll: al cambiar de página, si no hay ventanas abiertas, el body se libera.
// Va en su propio componente (dentro de <Suspense>) para que usePathname no bloquee el prerender.
function ScrollPorRuta() {
  const ruta = usePathname();
  useEffect(() => restablecerScroll(), [ruta]);
  return null;
}

// "Furiosa: De la saga Mad Max" → "furiosa-de-la-saga-mad-max" (mismo criterio que el backend).
const slugDe = (titulo: string) =>
  titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "pelicula";

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "Error inesperado.");

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [e, setE] = useState<Estado>(INICIAL);
  const [listo, setListo] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [adminHasta, setAdminHasta] = useState(0);
  const [loginAbierto, setLoginAbierto] = useState(false);
  const [loginUsado, setLoginUsado] = useState(false);
  const [modoLogin, setModoLogin] = useState<"login" | "registro">("login");
  const [triviaAbierta, setTriviaAbierta] = useState(false);
  const [triviaUsada, setTriviaUsada] = useState(false);
  const [reloj, setReloj] = useState(0);

  // Estado que viene de la API (no se guarda en localStorage).
  const [modoApi, setModoApi] = useState<ModoApi>(apiConfigurada ? "verificando" : "local");
  const [funcionesApi, setFuncionesApi] = useState<Funcion[] | null>(null);
  const [peliculasApi, setPeliculasApi] = useState<Pelicula[]>([]);
  const [asientosApi, setAsientosApi] = useState<Record<string, AsientosApi>>({});
  const [sesionApi, setSesionApi] = useState<{ correo: string; id: number } | null>(null);
  const [cuentaApi, setCuentaApi] = useState<CuentaApi | null>(null);

  useEffect(() => {
    const t = setInterval(() => setReloj(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const ref = useRef(e);
  const modoRef = useRef(modoApi);
  const sesionRef = useRef(sesionApi);
  useLayoutEffect(() => {
    ref.current = e;
    modoRef.current = modoApi;
    sesionRef.current = sesionApi;
  }, [e, modoApi, sesionApi]);


  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLAVE);
      // Hidratación desde localStorage: solo existe en el navegador, por eso se lee tras montar.
      const previo: Estado = raw ? { ...INICIAL, ...JSON.parse(raw) } : INICIAL;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setE({ ...previo, cuentas: conDemos(previo.cuentas) });
    } catch {
      setE({ ...INICIAL, cuentas: conDemos({}) });
    }
    setListo(true);
  }, []);

  useEffect(() => {
    if (!listo) return;
    try {
      localStorage.setItem(CLAVE, JSON.stringify(e));
    } catch {}
  }, [e, listo]);

  const toast = useCallback((texto: string, tipo: Toast["tipo"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, texto, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  // ¿Responde la API? Si no, el prototipo sigue con datos simulados.
  useEffect(() => {
    if (!apiConfigurada) return;
    let vivo = true;
    api
      .salud()
      // Películas y funciones juntas: una función nunca llega antes que su película.
      .then(() => Promise.all([api.funciones(), api.peliculas().catch(() => [])]))
      .then(([fs, ps]) => {
        if (!vivo) return;
        setPeliculasApi(ps.map(peliculaDeApi));
        setFuncionesApi(fs.map(funcionDeApi));
        setModoApi("conectado");
      })
      .catch(() => {
        if (!vivo) return;
        setModoApi("local");
        toast("La API no responde: se usan datos de demostración.", "info");
      });
    return () => {
      vivo = false;
    };
  }, [toast]);

  // Vincula al cliente con su cuenta de créditos en PostgreSQL.
  const correoCliente = e.usuario?.rol === "cliente" ? e.usuario.correo : null;
  const nombreCliente = e.usuario?.nombre ?? "";
  useEffect(() => {
    if (modoApi !== "conectado" || !correoCliente || sesionApi?.correo === correoCliente) return;
    let vivo = true;
    api
      .sesion(correoCliente, nombreCliente)
      .then(async (s) => {
        const c = await api.cuenta(s.usuario_id);
        if (!vivo) return;
        setSesionApi({ correo: correoCliente, id: s.usuario_id });
        setCuentaApi(c);
      })
      .catch((err) => vivo && toast(`No se pudo cargar tu cuenta: ${mensaje(err)}`, "error"));
    return () => {
      vivo = false;
    };
  }, [modoApi, correoCliente, nombreCliente, sesionApi, toast]);

  const asegurarSesion = useCallback(async () => {
    const u = ref.current.usuario;
    if (!u) throw new ApiError(401, "Debes iniciar sesión.");
    const s = sesionRef.current;
    if (s?.correo === u.correo) return s.id;
    const r = await api.sesion(u.correo, u.nombre);
    setSesionApi({ correo: u.correo, id: r.usuario_id });
    return r.usuario_id;
  }, []);

  const refrescarCuenta = useCallback(async () => {
    const s = sesionRef.current;
    if (modoRef.current !== "conectado" || !s) return;
    try {
      setCuentaApi(await api.cuenta(s.id));
    } catch {}
  }, []);

  // Depende de modoApi (no de la ref): al conectarse cambia su identidad y las páginas que la usan vuelven a pedir los datos.
  const cargarOcupacion = useCallback(async (ids: string[]) => {
    if (modoApi !== "conectado" || ids.length === 0) return;
    let nuevos: Record<string, AsientosApi> = {};
    if (ids.length > 8) {
      // Muchas funciones (panel): una sola solicitud en vez de una por función.
      const todas = await api.ocupacion().catch(() => ({}) as Record<string, AsientosApi>);
      nuevos = Object.fromEntries(ids.filter((id) => todas[id]).map((id) => [id, todas[id]]));
    } else {
      const pares = await Promise.all(ids.map((id) => api.asientos(id).then((r) => [id, r] as const).catch(() => null)));
      nuevos = Object.fromEntries(pares.filter((p) => p !== null));
    }
    if (Object.keys(nuevos).length) setAsientosApi((a) => ({ ...a, ...nuevos }));
  }, [modoApi]);

  const fijarOcupacion = useCallback((funcionId: string, datos: AsientosApi) => setAsientosApi((a) => ({ ...a, [funcionId]: datos })), []);

  // Aplica un cambio recibido por SSE sin volver a pedir toda la ocupación.
  const aplicarEventoAsientos = useCallback((ev: EventoAsientosApi) => {
    setAsientosApi((a) => {
      const previo = a[ev.funcion] ?? { vendidos: [], retenidos: [] };
      const retenidos = new Set(previo.retenidos);
      const vendidos = new Set(previo.vendidos);
      for (const as of ev.asientos) {
        if (ev.tipo === "bloqueado") retenidos.add(as);
        else retenidos.delete(as);
        if (ev.tipo === "vendido") vendidos.add(as);
      }
      return { ...a, [ev.funcion]: { vendidos: [...vendidos], retenidos: [...retenidos] } };
    });
  }, []);

  const bloquearAsiento = useCallback(
    async (funcionId: string, asiento: string): Promise<Resultado> => {
      if (!ref.current.usuario) return { ok: false, error: "Debes iniciar sesión para elegir butacas." };
      if (modoRef.current === "conectado") {
        try {
          const id = await asegurarSesion();
          await api.bloquearAsiento(funcionId, asiento, id);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: mensaje(err) };
        }
      }
      // Sin API: ~5 % de probabilidad de que "otro cliente" gane la butaca, como haría SET NX en Redis.
      if (Math.random() < 0.05) return { ok: false, error: `Otro cliente tomó la butaca ${asiento} un instante antes. Elige otra.` };
      return { ok: true };
    },
    [asegurarSesion],
  );

  const liberarAsientos = useCallback((funcionId: string, asientos: string[]) => {
    const s = sesionRef.current;
    if (modoRef.current !== "conectado" || !s || asientos.length === 0) return;
    api.desbloquearAsientos(funcionId, asientos, s.id).catch(() => {});
  }, []);

  const misBloqueos = useCallback(
    async (funcionId: string) => {
      if (modoRef.current !== "conectado" || ref.current.usuario?.rol !== "cliente") return [];
      try {
        const id = await asegurarSesion();
        return (await api.asientos(funcionId, id)).propios ?? [];
      } catch {
        return [];
      }
    },
    [asegurarSesion],
  );

  const registrar = useCallback((accion: string, detalle: string) => setE((s) => ({ ...s, bitacora: log(s, accion, detalle) })), []);

  // Con la API se usan sus funciones; las de la tabla local quedan como respaldo para boletos de funciones ya terminadas.
  // Películas creadas desde el panel: las de la API si está conectada; si no, las guardadas en el navegador.
  // Se registran en el catálogo (pelicula(id)) durante el render, antes de que los hijos las consulten.
  const peliculasCreadas = modoApi === "conectado" ? peliculasApi : e.peliculasExtra;
  const peliculas = useMemo(() => {
    registrarPeliculas(peliculasCreadas);
    return [...PELICULAS, ...peliculasCreadas];
  }, [peliculasCreadas]);

  const recargarCatalogo = useCallback(async () => {
    const [fs, ps] = await Promise.all([api.funciones(), api.peliculas()]);
    setPeliculasApi(ps.map(peliculaDeApi));
    setFuncionesApi(fs.map(funcionDeApi));
  }, []);

  const funciones = useMemo(() => {
    const porCodigo = new Map(funcionesBase().map((f) => [f.id, f]));
    if (modoApi === "conectado" && funcionesApi) for (const f of funcionesApi) porCodigo.set(f.id, f);
    // Las funciones programadas sin API sólo existen en el modo demostración.
    return modoApi === "conectado" ? [...porCodigo.values()] : [...porCodigo.values(), ...e.funcionesExtra];
  }, [modoApi, funcionesApi, e.funcionesExtra]);
  const vendidosGlobales = useMemo(() => todosLosBoletos(e), [e]);

  const ocupacion = useCallback(
    (funcionId: string): Ocupacion => {
      if (modoApi === "conectado") {
        const d = asientosApi[funcionId];
        return { vendidos: new Set(d?.vendidos ?? []), retenidos: new Set(d?.retenidos ?? []) };
      }
      const sim = ocupacionSimulada(funcionId);
      for (const b of vendidosGlobales)
        if (b.funcionId === funcionId && (b.estado === "VÁLIDO" || b.estado === "UTILIZADO")) sim.vendidos.add(b.asiento);
      const r = e.reserva;
      if (r && r.funcionId === funcionId && r.titular !== e.usuario?.correo) r.asientos.forEach((a) => sim.retenidos.add(a));
      return sim;
    },
    [modoApi, asientosApi, vendidosGlobales, e.reserva, e.usuario],
  );

  const cancelarReserva = useCallback((motivo: "cancelada" | "expirada" = "cancelada") => {
    const r = ref.current.reserva;
    if (!r) return;
    const conApi = modoRef.current === "conectado";
    // Con la API, las butacas se liberan en Redis; al expirar, el TTL ya lo hizo solo.
    if (conApi && motivo === "cancelada") api.cancelarReserva(r.id).catch(() => {});
    // Sin API, los créditos retenidos se devuelven al saldo local. Con la API nunca se descontaron (el pago es atómico).
    const devolver = !conApi && r.creditosRetenidos > 0;
    setE((s) => ({
      ...s,
      reserva: null,
      cuentas: devolver
        ? conCuenta(s, r.titular, (c) => ({
            ...c,
            saldo: c.saldo + r.creditosRetenidos,
            movimientos: [{ id: uid(), tipo: "liberación", monto: r.creditosRetenidos, ref: `Reserva ${r.id} ${motivo}`, fecha: ahoraISO() }, ...c.movimientos],
          }))
        : s.cuentas,
      bitacora: log(s, motivo === "expirada" ? "RESERVA_EXPIRADA" : "RESERVA_CANCELADA", `${r.id} · ${r.asientos.join(", ")}`),
    }));
    if (motivo === "expirada")
      setAviso({
        icono: Timer,
        titulo: "Tiempo agotado",
        texto: `Tu reserva de ${r.asientos.join(", ")} venció a los ${PARAMETROS.retencionMinutos} minutos. Los asientos fueron liberados${
          devolver ? ` y se devolvieron ${r.creditosRetenidos} créditos a tu saldo` : ""
        }.`,
      });
  }, []);

  // Temporizador de expiración (con la API, Redis libera las butacas con el TTL; aquí sólo se avisa al cliente)
  useEffect(() => {
    if (!e.reserva) return;
    const ms = e.reserva.expira - Date.now();
    const t = setTimeout(() => cancelarReserva("expirada"), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [e.reserva, cancelarReserva]);

  // Cierre de sesión automático por inactividad (RNF-24).
  const ultimaActividad = useRef(0);
  useEffect(() => {
    ultimaActividad.current = Date.now();
    const marcar = () => (ultimaActividad.current = Date.now());
    const eventos = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"];
    eventos.forEach((ev) => window.addEventListener(ev, marcar, { passive: true }));
    const t = setInterval(() => {
      if (ref.current.usuario && Date.now() - ultimaActividad.current > PARAMETROS.inactividadMinutos * 60000) {
        cancelarReserva();
        setE((s) => ({ ...s, usuario: null, bitacora: log(s, "SESION_EXPIRADA", "Inactividad") }));
        setSesionApi(null);
        setCuentaApi(null);
        setTriviaAbierta(false);
        setAviso({
          icono: Lock,
          titulo: "Sesión cerrada por seguridad",
          texto: `No detectamos actividad durante ${PARAMETROS.inactividadMinutos} minutos. Vuelve a iniciar sesión para continuar.`,
        });
      }
    }, 10000);
    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, marcar));
      clearInterval(t);
    };
  }, [cancelarReserva]);

  const cuenta = e.usuario ? e.cuentas[e.usuario.correo] : undefined;
  const reservaPropia = e.reserva && e.reserva.titular === e.usuario?.correo ? e.reserva : null;
  const cuentaRemota = modoApi === "conectado" && e.usuario?.rol === "cliente";
  const cuentaApiVigente = cuentaRemota && sesionApi?.correo === e.usuario?.correo ? cuentaApi : null;

  const valor: Ctx = {
    listo,
    modoApi,
    usuario: e.usuario,
    // Con la API, la retención de créditos es sólo visual: el débito real ocurre en una transacción al pagar.
    saldo: cuentaRemota ? Math.max(0, (cuentaApiVigente?.saldo ?? 0) - (reservaPropia?.creditosRetenidos ?? 0)) : (cuenta?.saldo ?? 0),
    movimientos: cuentaRemota ? (cuentaApiVigente?.movimientos.map(movimientoDeApi) ?? []) : (cuenta?.movimientos ?? []),
    boletos: cuentaRemota ? (cuentaApiVigente?.boletos.map((b) => boletoDeApi(b, e.usuario!.correo)) ?? []) : (cuenta?.boletos ?? []),
    cuentas: e.cuentas,
    reserva: reservaPropia,
    bitacora: e.bitacora,
    funciones,
    ocupacion,
    cargarOcupacion,
    fijarOcupacion,
    aplicarEventoAsientos,
    bloquearAsiento,
    liberarAsientos,
    misBloqueos,
    refrescarCuenta,
    toast,
    registrar,
    loginAbierto,
    loginUsado,
    modoLogin,
    abrirLogin: (modo = "login") => {
      setModoLogin(modo);
      setLoginUsado(true);
      setLoginAbierto(true);
    },
    cerrarLogin: () => setLoginAbierto(false),
    triviaAbierta,
    triviaUsada,
    abrirTrivia: () => {
      setTriviaUsada(true);
      setTriviaAbierta(true);
    },
    cerrarTrivia: () => setTriviaAbierta(false),
    login: (u) => {
      // Acceso rápido de demostración: usa el rol y nombre vigentes de la cuenta (pueden haber sido editados por el admin).
      const c = ref.current.cuentas[u.correo];
      if (c && !c.activo) {
        setAviso({ icono: Ban, titulo: "Cuenta dada de baja", texto: "Esta cuenta fue desactivada por un administrador y no puede iniciar sesión." });
        return;
      }
      const real = c ? { nombre: c.nombre, correo: u.correo, rol: c.rol } : u;
      setE((s) => ({
        ...s,
        usuario: real,
        cuentas: s.cuentas[u.correo] ? s.cuentas : { ...s.cuentas, [u.correo]: cuentaNueva(u.nombre, u.correo, u.rol, CLAVE_DEMO) },
        bitacora: log({ ...s, usuario: real }, "INICIO_SESION", `Rol: ${real.rol}`),
      }));
      setAdminHasta(0);
      toast(`Bienvenido, ${real.nombre}`, "ok");
    },
    iniciarSesion: (correo, clave) => {
      const c = correo.trim().toLowerCase();
      const cta = ref.current.cuentas[c];
      if (!cta || cta.claveHash !== hashClave(c, clave)) {
        setE((s) => ({ ...s, bitacora: log(s, "INICIO_FALLIDO", c) }));
        return { ok: false, error: "Datos incorrectos." };
      }
      if (!cta.activo) return { ok: false, error: "Esta cuenta fue dada de baja. Contacta al administrador." };
      const u = { nombre: cta.nombre, correo: c, rol: cta.rol };
      setE((s) => ({ ...s, usuario: u, bitacora: log({ ...s, usuario: u }, "INICIO_SESION", `Rol: ${u.rol}`) }));
      setAdminHasta(0);
      toast(`Bienvenido, ${u.nombre}`, "ok");
      return { ok: true };
    },
    registrarCliente: (nombre, correo, clave) => {
      const c = correo.trim().toLowerCase();
      if (ref.current.cuentas[c]) return { ok: false, error: "El correo ya está registrado." };
      const u = { nombre: nombre.trim(), correo: c, rol: "cliente" as Rol };
      setE((s) => ({ ...s, usuario: u, cuentas: { ...s.cuentas, [c]: cuentaNueva(u.nombre, c, "cliente", clave) }, bitacora: log({ ...s, usuario: u }, "CUENTA_CREADA", "Registro de cliente") }));
      return { ok: true };
    },
    adminVerificado: adminHasta > reloj,
    verificarAdmin: (clave) => {
      const s = ref.current;
      const u = s.usuario;
      const ok = !!u && u.rol === "admin" && s.cuentas[u.correo]?.claveHash === hashClave(u.correo, clave);
      setE((st) => ({ ...st, bitacora: log(st, ok ? "REAUTENTICACION_ADMIN" : "REAUTENTICACION_FALLIDA", "Gestión de usuarios") }));
      if (ok) {
        const n = Date.now();
        setReloj(n);
        setAdminHasta(n + VERIFICACION_ADMIN_MS);
      }
      return ok;
    },
    crearUsuario: ({ nombre, correo, rol, clave }) => {
      const s = ref.current;
      if (s.usuario?.rol !== "admin" || adminHasta < Date.now()) return { ok: false, error: "Acción no autorizada: reconfirma tu identidad de administrador." };
      const c = correo.trim().toLowerCase();
      if (nombre.trim().length < 2) return { ok: false, error: "Ingresa el nombre completo." };
      if (!correoValido(c)) return { ok: false, error: "Correo electrónico inválido." };
      if (s.cuentas[c]) return { ok: false, error: "Ya existe una cuenta con ese correo." };
      if (clave.length < 8) return { ok: false, error: "La contraseña temporal debe tener al menos 8 caracteres." };
      setE((st) => ({ ...st, cuentas: { ...st.cuentas, [c]: cuentaNueva(nombre.trim(), c, rol, clave) }, bitacora: log(st, "USUARIO_CREADO", `${c} · rol ${rol}`) }));
      return { ok: true };
    },
    editarUsuario: (correo, { nombre, rol }) => {
      const s = ref.current;
      if (s.usuario?.rol !== "admin" || adminHasta < Date.now()) return { ok: false, error: "Acción no autorizada: reconfirma tu identidad de administrador." };
      const c = s.cuentas[correo];
      if (!c) return { ok: false, error: "La cuenta no existe." };
      if (nombre.trim().length < 2) return { ok: false, error: "Ingresa el nombre completo." };
      if (correo === s.usuario.correo && rol !== c.rol) return { ok: false, error: "No puedes cambiar tu propio rol." };
      if (c.rol === "admin" && rol !== "admin" && c.activo && adminsActivos(s.cuentas) <= 1) return { ok: false, error: "Debe existir al menos un administrador activo." };
      setE((st) => ({
        ...st,
        cuentas: conCuenta(st, correo, (x) => ({ ...x, nombre: nombre.trim(), rol })),
        bitacora: log(st, "USUARIO_EDITADO", `${correo} · ${c.rol} → ${rol}${c.nombre !== nombre.trim() ? ` · nombre: ${c.nombre} → ${nombre.trim()}` : ""}`),
      }));
      return { ok: true };
    },
    cambiarEstadoUsuario: (correo, activo) => {
      const s = ref.current;
      if (s.usuario?.rol !== "admin" || adminHasta < Date.now()) return { ok: false, error: "Acción no autorizada: reconfirma tu identidad de administrador." };
      const c = s.cuentas[correo];
      if (!c) return { ok: false, error: "La cuenta no existe." };
      if (!activo && correo === s.usuario.correo) return { ok: false, error: "No puedes dar de baja tu propia cuenta." };
      if (!activo && c.rol === "admin" && adminsActivos(s.cuentas) <= 1) return { ok: false, error: "Debe existir al menos un administrador activo." };
      setE((st) => ({ ...st, cuentas: conCuenta(st, correo, (x) => ({ ...x, activo })), bitacora: log(st, activo ? "USUARIO_REACTIVADO" : "USUARIO_DADO_DE_BAJA", correo) }));
      return { ok: true };
    },
    logout: () => {
      cancelarReserva();
      setAdminHasta(0);
      setSesionApi(null);
      setCuentaApi(null);
      setTriviaAbierta(false);
      setLoginAbierto(false);
      limpiarTurnos();
      setE((s) => ({ ...s, usuario: null, bitacora: log(s, "CIERRE_SESION", "") }));
    },
    reservar: async (funcionId, asientos) => {
      const s = ref.current;
      if (!s.usuario) return { ok: false, error: "Debes iniciar sesión para reservar asientos." };
      if (s.reserva && s.reserva.titular === s.usuario.correo) return { ok: false, error: "Ya tienes una reserva activa." };
      if (asientos.length === 0) return { ok: false, error: "Selecciona al menos una butaca." };
      if (asientos.length > PARAMETROS.maxButacasPorTransaccion) return { ok: false, error: `Máximo ${PARAMETROS.maxButacasPorTransaccion} butacas por transacción.` };
      const titular = s.usuario.correo;

      if (modoRef.current === "conectado") {
        // POST /api/reservas: SET NX + TTL en Redis. El servidor decide si las butacas siguen libres
        // y aplica el límite de boletos del preestreno.
        try {
          const id = await asegurarSesion();
          const res = await api.crearReserva(funcionId, id, asientos);
          // El vencimiento se cuenta con el reloj local para no depender del desfase entre equipos.
          const r: Reserva = { id: res.reserva_id, titular, funcionId, asientos, expira: Date.now() + PARAMETROS.retencionMinutos * 60000 - 1000, creditosRetenidos: 0 };
          setE((st) => ({ ...st, reserva: r, bitacora: log(st, "RESERVA_CREADA", `${r.id} · ${asientos.join(", ")}`) }));
          return { ok: true };
        } catch (err) {
          return { ok: false, error: mensaje(err) };
        } finally {
          cargarOcupacion([funcionId]);
        }
      }

      const f = funciones.find((x) => x.id === funcionId);
      if (f?.eventoId) {
        const yaTiene = (s.cuentas[titular]?.boletos ?? []).filter((b) => b.funcionId === funcionId && b.estado !== "ANULADO" && b.estado !== "REEMBOLSADO").length;
        if (yaTiene + asientos.length > PARAMETROS.maxBoletosPorEvento)
          return { ok: false, error: `El preestreno permite ${PARAMETROS.maxBoletosPorEvento} boletos por cliente${yaTiene ? ` (ya tienes ${yaTiene})` : ""}.` };
      }
      const occ = ocupacion(funcionId);
      const tomados = asientos.filter((a) => occ.vendidos.has(a) || occ.retenidos.has(a));
      if (tomados.length) return { ok: false, error: `La butaca ${tomados.join(", ")} ya no está disponible.` };
      const r: Reserva = { id: "R-" + uid(), titular, funcionId, asientos, expira: Date.now() + PARAMETROS.retencionMinutos * 60000, creditosRetenidos: 0 };
      setE((st) => ({ ...st, reserva: r, bitacora: log(st, "RESERVA_CREADA", `${r.id} · ${asientos.join(", ")}`) }));
      return { ok: true };
    },
    cancelarReserva,
    retenerCreditos: () => {
      const s = ref.current;
      const r = s.reserva;
      if (!r || !s.usuario || r.titular !== s.usuario.correo) return { ok: false, error: "La reserva expiró." };
      if (r.creditosRetenidos) return { ok: true };
      const f = funciones.find((x) => x.id === r.funcionId)!;
      const total = f.precio * r.asientos.length;
      const conApi = modoRef.current === "conectado";
      const saldo = conApi ? (cuentaApi?.saldo ?? 0) : (s.cuentas[r.titular]?.saldo ?? 0);
      if (saldo < total) return { ok: false, error: `Saldo insuficiente: necesitas ${total} créditos y tienes ${saldo}.` };
      setE((st) => ({
        ...st,
        reserva: st.reserva && { ...st.reserva, creditosRetenidos: total },
        cuentas: conApi
          ? st.cuentas
          : conCuenta(st, r.titular, (c) => ({
              ...c,
              saldo: c.saldo - total,
              movimientos: [{ id: uid(), tipo: "retención", monto: -total, ref: r.id, fecha: ahoraISO() }, ...c.movimientos],
            })),
      }));
      return { ok: true };
    },
    pagar: async () => {
      const s = ref.current;
      const r = s.reserva;
      if (!r || !s.usuario || r.titular !== s.usuario.correo) return { ok: false, error: "La reserva expiró." };
      if (!r.creditosRetenidos) return { ok: false, error: "Primero confirma la compra para retener los créditos." };

      if (modoRef.current === "conectado") {
        // POST /api/reservas/{id}/pagar: transacción con SELECT … FOR UPDATE; repetirla no vuelve a cobrar.
        try {
          const p = await api.pagar(r.id);
          const nuevos = p.boletos.map((b) => boletoDeApi(b, r.titular));
          setE((st) => ({ ...st, reserva: null, bitacora: log(st, "VENTA", `${r.id} · ${r.asientos.join(", ")} · ${r.creditosRetenidos} cr.`) }));
          await refrescarCuenta();
          cargarOcupacion([r.funcionId]);
          return { ok: true, boletos: nuevos };
        } catch (err) {
          const status = err instanceof ApiError ? err.status : 0;
          if (status === 410 || status === 409) setE((st) => ({ ...st, reserva: null }));
          if (status === 402) {
            setE((st) => ({ ...st, reserva: st.reserva && { ...st.reserva, creditosRetenidos: 0 } }));
            await refrescarCuenta();
            return { ok: false, error: `Saldo insuficiente: necesitas ${r.creditosRetenidos} créditos.` };
          }
          return { ok: false, error: mensaje(err) };
        }
      }

      const f = funciones.find((x) => x.id === r.funcionId)!;
      const nuevos: Boleto[] = r.asientos.map((a) => ({
        token: "CE-" + uid() + uid(),
        funcionId: r.funcionId,
        asiento: a,
        precio: f.precio,
        estado: "VÁLIDO",
        emitido: ahoraISO(),
        titular: r.titular,
      }));
      setE((st) => ({
        ...st,
        reserva: null,
        cuentas: conCuenta(st, r.titular, (c) => ({
          ...c,
          boletos: [...nuevos, ...c.boletos],
          movimientos: [{ id: uid(), tipo: "débito", monto: 0, ref: `Pago ${r.id} (${r.creditosRetenidos} cr. retenidos)`, fecha: ahoraISO() }, ...c.movimientos],
        })),
        bitacora: log(st, "VENTA", `${r.id} · ${r.asientos.join(", ")} · ${r.creditosRetenidos} cr.`),
      }));
      return { ok: true, boletos: nuevos };
    },
    acreditarTrivia: async (partidaId, aciertos) => {
      const s = ref.current;
      if (!s.usuario) return { ok: false, monto: 0, error: "Debes iniciar sesión." };
      const monto = premioTrivia(aciertos);

      if (modoRef.current === "conectado") {
        // El servidor calcula el premio a partir de los aciertos y no acredita dos veces la misma partida (RF-64).
        try {
          const id = await asegurarSesion();
          const r = await api.acreditarTrivia(id, partidaId, aciertos);
          await refrescarCuenta();
          setE((st) => ({ ...st, bitacora: log(st, "TRIVIA", `${partidaId} · +${r.acreditado ? r.monto : 0} cr.`) }));
          return { ok: r.acreditado, monto: r.monto };
        } catch (err) {
          return { ok: false, monto, error: mensaje(err) };
        }
      }

      const correo = s.usuario.correo;
      if (s.cuentas[correo]?.partidasCobradas.includes(partidaId)) return { ok: false, monto }; // idempotente (RF-64)
      setE((st) => ({
        ...st,
        cuentas: conCuenta(st, correo, (c) => ({
          ...c,
          saldo: c.saldo + monto,
          partidasCobradas: [...c.partidasCobradas, partidaId],
          movimientos: monto ? [{ id: uid(), tipo: "recarga", monto, ref: `Trivia ${partidaId}`, fecha: ahoraISO() }, ...c.movimientos] : c.movimientos,
        })),
        bitacora: log(st, "TRIVIA", `${partidaId} · +${monto} cr.`),
      }));
      return { ok: true, monto };
    },
    validarBoleto: async (token) => {
      const s = ref.current;
      // Acepta el contenido del QR (JSON con código dinámico) o el identificador escrito a mano.
      let tok = token.trim();
      let qrVencido = false;
      if (tok.startsWith("{")) {
        try {
          const q = JSON.parse(tok);
          tok = q.t;
          const w = ventanaActual();
          qrVencido = !(q.w >= w - 1 && q.w <= w && q.c === codigoDinamico(q.t, q.w));
        } catch {
          tok = "";
        }
      }
      let res: Validacion;
      if (modoRef.current === "conectado") {
        if (!tok) res = { ok: false, motivo: "Boleto inexistente" };
        // El código dinámico se comprueba antes de llamar a la API: un QR vencido no consume el boleto.
        else if (qrVencido) res = { ok: false, motivo: "Código QR vencido (posible captura de pantalla)" };
        else {
          try {
            const r = await api.validarBoleto(tok);
            res = { ok: r.ok, motivo: r.motivo, boleto: r.boleto && boletoDeApi(r.boleto, r.titular ?? "") };
          } catch (err) {
            res = { ok: false, motivo: mensaje(err) };
          }
        }
        setE((st) => ({ ...st, bitacora: log(st, "VALIDACION_ACCESO", `${tok.slice(0, 6)}… · ${res.motivo}`) }));
        return res;
      }

      const b = todosLosBoletos(s).find((x) => x.token === tok);
      if (!b) res = { ok: false, motivo: "Boleto inexistente" };
      else if (qrVencido) res = { ok: false, motivo: "Código QR vencido (posible captura de pantalla)", boleto: b };
      else if (b.estado === "UTILIZADO") res = { ok: false, motivo: "Boleto ya utilizado", boleto: b };
      else if (b.estado !== "VÁLIDO") res = { ok: false, motivo: `Boleto ${b.estado.toLowerCase()}`, boleto: b };
      else res = { ok: true, motivo: "Acceso permitido", boleto: b };
      setE((st) => ({
        ...st,
        cuentas:
          res.ok && b
            ? conCuenta(st, b.titular, (c) => ({ ...c, boletos: c.boletos.map((x) => (x.token === b.token ? { ...x, estado: "UTILIZADO" } : x)) }))
            : st.cuentas,
        bitacora: log(st, "VALIDACION_ACCESO", `${tok.slice(0, 6)}… · ${res.motivo}`),
      }));
      return res;
    },
    peliculas,
    crearPelicula: async (p, nuevas) => {
      const s = ref.current;
      if (s.usuario?.rol !== "agente" && s.usuario?.rol !== "admin") return { ok: false, error: "Sólo el agente operativo o el administrador pueden crear películas." };
      if (modoRef.current === "conectado") {
        // POST /api/peliculas: ficha + póster + funciones en una sola transacción (si una función choca, no se guarda nada).
        try {
          const r = await api.crearPelicula({
            titulo: p.titulo,
            titulo_original: p.tituloOriginal,
            categoria: p.categoria,
            clasificacion: p.clasificacion,
            duracion: p.duracion,
            genero: p.genero,
            idioma: p.idioma,
            formatos: p.formatos,
            director: p.director,
            reparto: p.reparto,
            anio: p.anio,
            sinopsis: p.sinopsis,
            trailer: p.trailer ?? null,
            estreno_en_dias: p.estrenoEnDias ?? null,
            poster: p.poster,
            funciones: nuevas.map((f) => ({ sala: f.salaId, inicio: f.inicio, formato: f.formato, idioma: f.idioma, precio: f.precio })),
            creada_por: s.usuario.correo,
          });
          await recargarCatalogo();
          setE((st) => ({ ...st, bitacora: log(st, "PELICULA_CREADA", `${r.slug} · ${r.funciones.length} funciones`) }));
          return { ok: true, id: r.slug, funciones: r.funciones.length };
        } catch (err) {
          return { ok: false, error: mensaje(err) };
        }
      }
      // Sin API: se guarda en el navegador con las mismas validaciones de traslape.
      const usados = new Set([...PELICULAS, ...s.peliculasExtra].map((x) => x.id));
      const base = slugDe(p.titulo);
      let id = base;
      for (let n = 2; usados.has(id); n++) id = `${base}-${n}`;
      const programadas: Funcion[] = [];
      for (const f of nuevas) {
        const choque = funcionQueChoca([...funciones, ...programadas], f.salaId, f.inicio, p.duracion);
        if (choque) return { ok: false, error: `Traslape en la sala ${f.salaId.slice(1)} con otra función (${new Date(choque.inicio).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}).` };
        programadas.push({ id: "f" + uid().toLowerCase(), peliculaId: id, ...f });
      }
      const nueva: Pelicula = { ...p, id, acento: "#2a0b0b", personalizada: true };
      setE((st) => ({
        ...st,
        peliculasExtra: [...st.peliculasExtra, nueva],
        funcionesExtra: [...st.funcionesExtra, ...programadas],
        bitacora: log(st, "PELICULA_CREADA", `${id} · ${programadas.length} funciones`),
      }));
      return { ok: true, id, funciones: programadas.length };
    },
    programarFuncion: async ({ peliculaId, ...f }) => {
      if (modoRef.current === "conectado") {
        try {
          const r = await api.programarFuncion(peliculaId, { sala: f.salaId, inicio: f.inicio, formato: f.formato, idioma: f.idioma, precio: f.precio });
          await recargarCatalogo();
          setE((st) => ({ ...st, bitacora: log(st, "FUNCION_PROGRAMADA", `${r.codigo} · ${f.inicio}`) }));
          return { ok: true, id: r.codigo };
        } catch (err) {
          return { ok: false, error: mensaje(err) };
        }
      }
      const nueva: Funcion = { id: "f" + uid().toLowerCase(), peliculaId, ...f };
      setE((st) => ({ ...st, funcionesExtra: [...st.funcionesExtra, nueva], bitacora: log(st, "FUNCION_PROGRAMADA", `${nueva.id} · ${nueva.inicio}`) }));
      return { ok: true, id: nueva.id };
    },
  };

  return (
    <AppCtx.Provider value={valor}>
      {/* LazyMotion carga sólo las funciones de animación que se usan (domAnimation) y `strict`
          impide volver a importar el `motion` completo por accidente. Respeta "reducir movimiento" del sistema. */}
      <LazyMotion features={domAnimation} strict>
        <Suspense fallback={null}>
          <ScrollPorRuta />
        </Suspense>
        <MotionConfig reducedMotion="user">
          {listo ? children : <div className="py-24 text-center text-sm text-tenue">Cargando…</div>}
          <div className="fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2" role="status" aria-live="polite">
            <AnimatePresence>
              {toasts.map((t) => (
                <m.div
                  key={t.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40 }}
                  className={`rounded-lg border px-4 py-3 text-sm shadow-xl backdrop-blur ${
                    t.tipo === "ok"
                      ? "border-oro/40 bg-panel/95 text-tinta"
                      : t.tipo === "error"
                        ? "border-rojo/60 bg-vino/95 text-salmon"
                        : "border-borde bg-panel/95 text-tinta"
                  }`}
                >
                  {t.tipo === "ok" && <CircleCheck aria-hidden className="mr-2 inline h-4 w-4 align-[-3px] text-oro" />}
                  {t.texto}
                </m.div>
              ))}
            </AnimatePresence>
          </div>
          <Modal abierto={!!aviso} onCerrar={() => setAviso(null)} z="z-[60]">
            {aviso && (
              <div className="text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-rojo/50 bg-vino text-salmon">
                  <aviso.icono aria-hidden className="h-6 w-6" />
                </div>
                <h2 className="titulo mt-3 text-xl">{aviso.titulo}</h2>
                <p className="mt-2 text-sm text-tenue">{aviso.texto}</p>
                <Boton onClick={() => setAviso(null)} className="mt-5 w-full">
                  Entendido
                </Boton>
              </div>
            )}
          </Modal>
        </MotionConfig>
      </LazyMotion>
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fuera de AppProvider");
  return c;
}
