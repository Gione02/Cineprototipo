"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { CLAVE_DEMO, PARAMETROS, ROL_TXT, USUARIOS_DEMO, type Rol } from "@/lib/data";
import { useApp } from "@/lib/store";
import { Modal } from "./Modal";

const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);
const TIEMPO_MINIMO_MS = 1500; // un humano no completa el formulario en menos de 1.5 s
const msDesde = (t: number) => Date.now() - t;
const ahoraMs = () => Date.now();

/** Inicio de sesión / registro en ventana emergente: al terminar, el usuario sigue en la misma página. */
export function LoginModal() {
  const { loginAbierto, cerrarLogin, modoLogin } = useApp();
  return (
    <Modal abierto={loginAbierto} onCerrar={cerrarLogin} ancho="max-w-md" z="z-[58]">
      {loginAbierto && <Contenido key={modoLogin} modoInicial={modoLogin} />}
    </Modal>
  );
}

function Contenido({ modoInicial }: { modoInicial: "login" | "registro" }) {
  const router = useRouter();
  const { login, toast, cuentas, iniciarSesion, registrarCliente, cerrarLogin, registrar } = useApp();
  const [modo, setModo] = useState(modoInicial);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [trampa, setTrampa] = useState(""); // honeypot: invisible para personas
  const [error, setError] = useState("");
  const [fallos, setFallos] = useState(0);
  const [humano, setHumano] = useState(false);
  const [verDemos, setVerDemos] = useState(false);
  const abierto = useRef(0);
  useEffect(() => {
    abierto.current = ahoraMs();
  }, []);

  const terminar = (rol: Rol, nombreUsuario: string) => {
    cerrarLogin();
    // El personal no compra: su espacio de trabajo es el panel. El cliente se queda donde estaba.
    if (rol !== "cliente") router.push("/panel");
    else toast(`Sesión iniciada. Sigues donde estabas, ${nombreUsuario.split(" ")[0]}.`, "ok");
  };

  const antiBot = (): string | null => {
    if (trampa) {
      registrar("BOT_BLOQUEADO", "Campo trampa completado");
      return "Detectamos actividad automatizada. Intenta de nuevo más tarde.";
    }
    if (msDesde(abierto.current) < TIEMPO_MINIMO_MS) {
      registrar("BOT_BLOQUEADO", "Envío demasiado rápido");
      return "Detectamos actividad automatizada (envío demasiado rápido).";
    }
    if (!humano) return "Completa la verificación «No soy un robot».";
    return null;
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const c = correo.trim().toLowerCase();
    if (fallos >= PARAMETROS.intentosFallidos) return setError("Acceso bloqueado temporalmente por intentos fallidos (RF-43).");
    const bot = antiBot();
    if (bot) return setError(bot);
    if (!correoValido(c)) return setError("Ingresa un correo electrónico válido.");
    if (clave.length < 8) {
      setFallos((f) => f + 1);
      return setError(modo === "login" ? "Datos incorrectos." : "La contraseña debe tener al menos 8 caracteres.");
    }
    if (modo === "registro") {
      if (nombre.trim().length < 2) return setError("Ingresa tu nombre.");
      const r = registrarCliente(nombre, c, clave);
      if (!r.ok) return setError(r.error!);
      toast(`Cuenta creada con ${PARAMETROS.bonoBienvenida} créditos de bienvenida. Enviamos un correo de confirmación a ${c}.`, "ok");
      return terminar("cliente", nombre);
    }
    const r = iniciarSesion(c, clave);
    if (!r.ok) {
      setFallos((f) => f + 1);
      return setError(`${r.error} Intentos restantes: ${Math.max(0, PARAMETROS.intentosFallidos - fallos - 1)}.`);
    }
    terminar(cuentas[c].rol, cuentas[c].nombre);
  };

  const entrarDemo = (d: (typeof USUARIOS_DEMO)[number]) => {
    const bot = antiBot();
    if (bot) return setError(bot);
    if (cuentas[d.correo]?.activo === false) return setError("Esa cuenta fue dada de baja por un administrador.");
    login({ nombre: d.nombre, correo: d.correo, rol: d.rol });
    terminar(cuentas[d.correo]?.rol ?? d.rol, d.nombre);
  };

  return (
    <form onSubmit={enviar} className="space-y-4" autoComplete="on">
      <div>
        <p className="etiqueta text-oro">Bienvenido a Cineight</p>
        <h2 className="titulo mt-1 text-2xl">{modo === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
        <p className="mt-1 text-xs text-tenue">Al terminar seguirás en esta misma página.</p>
      </div>
      <div className="flex rounded-md border border-borde bg-fondo p-1">
        {(["login", "registro"] as const).map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => { setModo(m); setError(""); }}
            className={`flex-1 rounded py-2 text-[11px] font-bold uppercase tracking-[0.14em] ${modo === m ? "border border-rojo/60 bg-vino text-salmon" : "text-tenue"}`}
          >
            {m === "login" ? "Iniciar sesión" : "Registrarse"}
          </button>
        ))}
      </div>
      {modo === "registro" && <Campo label="Nombre" value={nombre} onChange={setNombre} autoComplete="name" />}
      <Campo label="Correo electrónico" value={correo} onChange={setCorreo} type="email" autoComplete="email" />
      <Campo label="Contraseña" value={clave} onChange={setClave} type="password" autoComplete={modo === "login" ? "current-password" : "new-password"} />
      {/* Campo trampa: oculto para personas y lectores de pantalla; los bots suelen rellenarlo */}
      <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" aria-hidden value={trampa} onChange={(e) => setTrampa(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      <VerificacionHumana verificado={humano} onVerificado={() => setHumano(true)} />

      {error && <p className="rounded-md border border-rojo/60 bg-vino/50 p-2.5 text-sm text-salmon">{error}</p>}
      <button disabled={!humano} className="btn-vino w-full py-3.5">
        {modo === "login" ? "Entrar" : "Crear cuenta"}
      </button>
      <p className="text-[11px] text-apagado">
        {modo === "registro" ? `Cada cuenta nueva recibe ${PARAMETROS.bonoBienvenida} créditos propios de bienvenida. ` : ""}
        La contraseña se guarda con hash (bcrypt) en el backend. Demo: las cuentas de prueba usan <code className="text-tinta">{CLAVE_DEMO}</code>.
      </p>

      <div className="border-t border-borde pt-3">
        <button type="button" onClick={() => setVerDemos(!verDemos)} className="etiqueta flex w-full items-center justify-between text-oro">
          Accesos de demostración <span>{verDemos ? "▴" : "▾"}</span>
        </button>
        {verDemos && (
          <div className="mt-2 space-y-1.5">
            {!humano && <p className="text-[11px] text-tenue">Primero completa la verificación.</p>}
            {USUARIOS_DEMO.map((d) => {
              const rol = cuentas[d.correo]?.rol ?? d.rol;
              return (
                <button
                  type="button"
                  key={d.correo}
                  disabled={!humano}
                  onClick={() => entrarDemo(d)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-borde bg-fondo px-3 py-2 text-left text-xs transition hover:border-arena disabled:opacity-40"
                >
                  <span>
                    <b>{d.nombre}</b> <span className="text-tenue">· {d.desc}</span>
                  </span>
                  <span className={rol === "cliente" ? "badge-borde" : "badge-vino"}>{ROL_TXT[rol].split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </form>
  );
}

/** Verificación de persona en dos pasos: casilla + reto de arrastre (RF-53). */
function VerificacionHumana({ verificado, onVerificado }: { verificado: boolean; onVerificado: () => void }) {
  const [paso, setPaso] = useState<"casilla" | "reto" | "listo">(verificado ? "listo" : "casilla");
  const [objetivo, setObjetivo] = useState(() => 30 + Math.round(Math.random() * 50));
  const [valor, setValor] = useState(0);
  const [mensaje, setMensaje] = useState("");

  const comprobar = () => {
    if (Math.abs(valor - objetivo) <= 4) {
      setPaso("listo");
      setMensaje("");
      onVerificado();
    } else {
      setMensaje("No encajó. Intenta de nuevo.");
      setObjetivo(30 + Math.round(Math.random() * 50));
      setValor(0);
    }
  };

  return (
    <div className={`rounded-md border p-3 ${paso === "listo" ? "border-oro/50 bg-oro/5" : "border-borde bg-fondo"}`}>
      {paso === "casilla" && (
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={false} onChange={() => setPaso("reto")} className="h-5 w-5 accent-[#c8372d]" />
          <span className="text-sm font-semibold">No soy un robot</span>
          <span className="etiqueta ml-auto">Anti-bots</span>
        </label>
      )}
      {paso === "reto" && (
        <m.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
          <p className="etiqueta mb-2 text-tinta">Desliza el boleto hasta encajarlo en el hueco</p>
          <div className="relative h-11 overflow-hidden rounded-md border border-borde bg-panel-2">
            {/* Hueco objetivo */}
            <div className="absolute top-1.5 h-8 w-10 -translate-x-1/2 rounded border-2 border-dashed border-oro/70 bg-oro/10" style={{ left: `${objetivo}%` }} aria-hidden />
            {/* Pieza que arrastra el usuario */}
            <div className="pointer-events-none absolute top-1.5 grid h-8 w-10 -translate-x-1/2 place-items-center rounded border border-rojo/70 bg-vino text-sm text-salmon shadow-lg" style={{ left: `${Math.max(6, valor)}%` }} aria-hidden>
              🎟
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={valor}
              onChange={(e) => setValor(+e.target.value)}
              onPointerUp={comprobar}
              onKeyUp={(e) => (e.key === "Enter" || e.key === " ") && comprobar()}
              aria-label="Desliza el boleto hasta el hueco y suelta"
              className="absolute inset-0 h-full w-full cursor-grab opacity-0 active:cursor-grabbing"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-tenue">{mensaje || "Arrastra y suelta. Con teclado: flechas y Enter."}</p>
        </m.div>
      )}
      {paso === "listo" && (
        <p className="flex items-center gap-2 text-sm font-semibold text-oro">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-oro text-[11px] text-fondo">✓</span> Verificado: eres una persona
        </p>
      )}
    </div>
  );
}

function Campo({ label, value, onChange, type = "text", autoComplete }: { label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string }) {
  return (
    <label className="etiqueta block">
      {label}
      <input type={type} value={value} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} className="campo normal-case tracking-normal" />
    </label>
  );
}
