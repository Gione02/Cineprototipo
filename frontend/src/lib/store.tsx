"use client";

// Estado del prototipo. Simula en el navegador lo que en producción hacen
// el servicio de reservas (Redis, TTL de 5 min) y el módulo de créditos (PostgreSQL, SELECT ... FOR UPDATE).
// Cada usuario tiene su propia cuenta de créditos, movimientos y boletos (tabla cuentas_credito por usuario_id).

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Modal } from "@/components/Modal";
import { codigoDinamico, ventanaActual } from "./seguridad";
import { CLAVE_DEMO, USUARIOS_DEMO, funcionesBase, PARAMETROS, type Funcion, type Rol, ocupacionSimulada } from "./data";

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

type Estado = {
  usuario: Usuario | null;
  cuentas: Record<string, Cuenta>; // clave: correo del usuario
  reserva: Reserva | null;
  funcionesExtra: Funcion[];
  bitacora: Log[];
};

const INICIAL: Estado = { usuario: null, cuentas: {}, reserva: null, funcionesExtra: [], bitacora: [] };

type Toast = { id: number; texto: string; tipo: "ok" | "error" | "info" };
type Aviso = { titulo: string; texto: string; icono: string };

type Ctx = {
  listo: boolean;
  usuario: Usuario | null;
  saldo: number;
  movimientos: Movimiento[];
  boletos: Boleto[];
  cuentas: Record<string, Cuenta>;
  reserva: Reserva | null;
  bitacora: Log[];
  funciones: Funcion[];
  ocupacion: (funcionId: string) => { vendidos: Set<string>; retenidos: Set<string> };
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
  reservar: (funcionId: string, asientos: string[]) => { ok: boolean; error?: string };
  cancelarReserva: (motivo?: "cancelada" | "expirada") => void;
  retenerCreditos: () => { ok: boolean; error?: string };
  pagar: () => { ok: boolean; error?: string; boletos?: Boleto[] };
  acreditarTrivia: (partidaId: string, monto: number) => boolean;
  validarBoleto: (token: string) => { ok: boolean; motivo: string; boleto?: Boleto };
  programarFuncion: (f: Funcion) => void;
  registrar: (accion: string, detalle: string) => void;
  toast: (texto: string, tipo?: Toast["tipo"]) => void;
  // Inicio de sesión en ventana emergente: el usuario no sale de la página en la que está.
  loginAbierto: boolean;
  abrirLogin: (modo?: "login" | "registro") => void;
  cerrarLogin: () => void;
  modoLogin: "login" | "registro";
};

const AppCtx = createContext<Ctx | null>(null);
const CLAVE = "cineight-prototipo-v3";
const VERIFICACION_ADMIN_MS = 5 * 60000;
const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();
const ahoraISO = () => new Date().toISOString();

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [e, setE] = useState<Estado>(INICIAL);
  const [listo, setListo] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [adminHasta, setAdminHasta] = useState(0);
  const [loginAbierto, setLoginAbierto] = useState(false);
  const [modoLogin, setModoLogin] = useState<"login" | "registro">("login");
  const [reloj, setReloj] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setReloj(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const ref = useRef(e);
  useLayoutEffect(() => {
    ref.current = e;
  }, [e]);

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

  const registrar = useCallback((accion: string, detalle: string) => setE((s) => ({ ...s, bitacora: log(s, accion, detalle) })), []);

  const funciones = useMemo(() => [...funcionesBase(), ...e.funcionesExtra], [e.funcionesExtra]);
  const vendidosGlobales = useMemo(() => todosLosBoletos(e), [e]);

  const ocupacion = useCallback(
    (funcionId: string) => {
      const sim = ocupacionSimulada(funcionId);
      for (const b of vendidosGlobales)
        if (b.funcionId === funcionId && (b.estado === "VÁLIDO" || b.estado === "UTILIZADO")) sim.vendidos.add(b.asiento);
      const r = e.reserva;
      if (r && r.funcionId === funcionId && r.titular !== e.usuario?.correo) r.asientos.forEach((a) => sim.retenidos.add(a));
      return sim;
    },
    [vendidosGlobales, e.reserva, e.usuario],
  );

  const cancelarReserva = useCallback((motivo: "cancelada" | "expirada" = "cancelada") => {
    const r = ref.current.reserva;
    if (!r) return;
    setE((s) => ({
      ...s,
      reserva: null,
      cuentas: r.creditosRetenidos
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
        icono: "⏱",
        titulo: "Tiempo agotado",
        texto: `Tu reserva de ${r.asientos.join(", ")} venció a los ${PARAMETROS.retencionMinutos} minutos. Los asientos fueron liberados${
          r.creditosRetenidos ? ` y se devolvieron ${r.creditosRetenidos} créditos a tu saldo` : ""
        }.`,
      });
  }, []);

  // Temporizador de expiración (en producción: TTL de la clave en Redis + aviso por WebSocket/SSE)
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
        setAviso({
          icono: "🔒",
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

  const valor: Ctx = {
    listo,
    usuario: e.usuario,
    saldo: cuenta?.saldo ?? 0,
    movimientos: cuenta?.movimientos ?? [],
    boletos: cuenta?.boletos ?? [],
    cuentas: e.cuentas,
    reserva: e.reserva && e.reserva.titular === e.usuario?.correo ? e.reserva : null,
    bitacora: e.bitacora,
    funciones,
    ocupacion,
    toast,
    registrar,
    loginAbierto,
    modoLogin,
    abrirLogin: (modo = "login") => {
      setModoLogin(modo);
      setLoginAbierto(true);
    },
    cerrarLogin: () => setLoginAbierto(false),
    login: (u) => {
      // Acceso rápido de demostración: usa el rol y nombre vigentes de la cuenta (pueden haber sido editados por el admin).
      const c = ref.current.cuentas[u.correo];
      if (c && !c.activo) {
        setAviso({ icono: "⛔", titulo: "Cuenta dada de baja", texto: "Esta cuenta fue desactivada por un administrador y no puede iniciar sesión." });
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
      setE((s) => ({ ...s, usuario: null, bitacora: log(s, "CIERRE_SESION", "") }));
    },
    reservar: (funcionId, asientos) => {
      const s = ref.current;
      if (!s.usuario) return { ok: false, error: "Debes iniciar sesión para reservar asientos." };
      if (s.reserva && s.reserva.titular === s.usuario.correo) return { ok: false, error: "Ya tienes una reserva activa." };
      if (asientos.length === 0) return { ok: false, error: "Selecciona al menos una butaca." };
      if (asientos.length > PARAMETROS.maxButacasPorTransaccion) return { ok: false, error: `Máximo ${PARAMETROS.maxButacasPorTransaccion} butacas por transacción.` };
      const f = funciones.find((x) => x.id === funcionId);
      if (f?.eventoId) {
        const yaTiene = (s.cuentas[s.usuario.correo]?.boletos ?? []).filter(
          (b) => b.funcionId === funcionId && b.estado !== "ANULADO" && b.estado !== "REEMBOLSADO",
        ).length;
        if (yaTiene + asientos.length > PARAMETROS.maxBoletosPorEvento)
          return { ok: false, error: `El preestreno permite ${PARAMETROS.maxBoletosPorEvento} boletos por cliente${yaTiene ? ` (ya tienes ${yaTiene})` : ""}.` };
      }
      const occ = ocupacion(funcionId);
      const tomados = asientos.filter((a) => occ.vendidos.has(a) || occ.retenidos.has(a));
      if (tomados.length) return { ok: false, error: `La butaca ${tomados.join(", ")} ya no está disponible.` };
      // Simula concurrencia: ~10% de probabilidad de que otro comprador gane la carrera (SET NX en Redis)
      if (Math.random() < 0.1) return { ok: false, error: `Otro cliente reservó ${asientos[0]} un instante antes. Elige otra butaca.` };
      const r: Reserva = { id: "R-" + uid(), titular: s.usuario.correo, funcionId, asientos, expira: Date.now() + PARAMETROS.retencionMinutos * 60000, creditosRetenidos: 0 };
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
      const saldo = s.cuentas[r.titular]?.saldo ?? 0;
      if (saldo < total) return { ok: false, error: `Saldo insuficiente: necesitas ${total} créditos y tienes ${saldo}.` };
      setE((st) => ({
        ...st,
        reserva: st.reserva && { ...st.reserva, creditosRetenidos: total },
        cuentas: conCuenta(st, r.titular, (c) => ({
          ...c,
          saldo: c.saldo - total,
          movimientos: [{ id: uid(), tipo: "retención", monto: -total, ref: r.id, fecha: ahoraISO() }, ...c.movimientos],
        })),
      }));
      return { ok: true };
    },
    pagar: () => {
      const s = ref.current;
      const r = s.reserva;
      if (!r || !s.usuario || r.titular !== s.usuario.correo) return { ok: false, error: "La reserva expiró." };
      if (!r.creditosRetenidos) return { ok: false, error: "Primero confirma la compra para retener los créditos." };
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
    acreditarTrivia: (partidaId, monto) => {
      const s = ref.current;
      if (!s.usuario) return false;
      const correo = s.usuario.correo;
      if (s.cuentas[correo]?.partidasCobradas.includes(partidaId)) return false; // idempotente (RF-64)
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
      return true;
    },
    validarBoleto: (token) => {
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
      const b = todosLosBoletos(s).find((x) => x.token === tok);
      let res: { ok: boolean; motivo: string; boleto?: Boleto };
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
    programarFuncion: (f) =>
      setE((st) => ({ ...st, funcionesExtra: [...st.funcionesExtra, f], bitacora: log(st, "FUNCION_PROGRAMADA", `${f.id} · ${f.inicio}`) })),
  };

  return (
    <AppCtx.Provider value={valor}>
      {listo ? children : <div className="py-24 text-center text-sm text-tenue">Cargando…</div>}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
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
              {t.tipo === "ok" && <span className="mr-2 text-oro">●</span>}
              {t.texto}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Modal abierto={!!aviso} onCerrar={() => setAviso(null)} z="z-[60]">
        {aviso && (
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-rojo/50 bg-vino text-2xl">{aviso.icono}</div>
            <h2 className="titulo mt-3 text-xl">{aviso.titulo}</h2>
            <p className="mt-2 text-sm text-tenue">{aviso.texto}</p>
            <button onClick={() => setAviso(null)} className="btn-vino mt-5 w-full">
              Entendido
            </button>
          </div>
        )}
      </Modal>
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fuera de AppProvider");
  return c;
}
