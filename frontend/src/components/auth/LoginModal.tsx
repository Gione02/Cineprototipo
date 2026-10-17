"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { ChevronDown, LogIn, UserPlus } from "lucide-react";
import { CLAVE_DEMO, ROL_TXT, USUARIOS_DEMO } from "@/data/catalogo";
import { PARAMETROS } from "@/data/parametros";
import type { Rol } from "@/types/catalogo";
import { useApp } from "@/store/AppProvider";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { Modal } from "@/components/ui/Modal";
import { Boton } from "@/components/ui/Boton";
import { AvisoRecaptcha } from "./AvisoRecaptcha";

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

/**
 * Anti-bots en tres capas, ninguna visible para la persona (RF-53):
 *   1. Campo trampa oculto que sólo rellenan los bots.
 *   2. Tiempo mínimo entre abrir el formulario y enviarlo.
 *   3. reCAPTCHA v3: puntaje calculado en segundo plano y verificado por el backend en Go
 *      ANTES de procesar las credenciales.
 */
function Contenido({ modoInicial }: { modoInicial: "login" | "registro" }) {
  const router = useRouter();
  const { login, toast, cuentas, iniciarSesion, registrarCliente, cerrarLogin, registrar } = useApp();
  const { verificar } = useRecaptcha();
  const [modo, setModo] = useState(modoInicial);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [trampa, setTrampa] = useState(""); // honeypot: invisible para personas
  const [error, setError] = useState("");
  const [fallos, setFallos] = useState(0);
  const [verificando, setVerificando] = useState(false);
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

  // Capas 1 y 2 (locales) y 3 (reCAPTCHA verificado en el servidor). Devuelve un mensaje de error o null.
  const antiBot = async (accion: "login" | "registro"): Promise<string | null> => {
    if (trampa) {
      registrar("BOT_BLOQUEADO", "Campo trampa completado");
      return "Detectamos actividad automatizada. Intenta de nuevo más tarde.";
    }
    if (msDesde(abierto.current) < TIEMPO_MINIMO_MS) {
      registrar("BOT_BLOQUEADO", "Envío demasiado rápido");
      return "Detectamos actividad automatizada (envío demasiado rápido).";
    }
    const r = await verificar(accion);
    return r.ok ? null : r.error!;
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificando) return;
    setError("");
    const c = correo.trim().toLowerCase();
    if (fallos >= PARAMETROS.intentosFallidos) return setError("Acceso bloqueado temporalmente por intentos fallidos (RF-43).");
    if (!correoValido(c)) return setError("Ingresa un correo electrónico válido.");
    if (modo === "registro" && nombre.trim().length < 2) return setError("Ingresa tu nombre.");

    setVerificando(true);
    const bot = await antiBot(modo);
    setVerificando(false);
    if (bot) return setError(bot);

    // Las credenciales se procesan sólo después de superar la verificación anti-bots.
    if (clave.length < 8) {
      setFallos((f) => f + 1);
      return setError(modo === "login" ? "Datos incorrectos." : "La contraseña debe tener al menos 8 caracteres.");
    }
    if (modo === "registro") {
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

  const entrarDemo = async (d: (typeof USUARIOS_DEMO)[number]) => {
    if (verificando) return;
    setError("");
    if (cuentas[d.correo]?.activo === false) return setError("Esa cuenta fue dada de baja por un administrador.");
    setVerificando(true);
    const bot = await antiBot("login");
    setVerificando(false);
    if (bot) return setError(bot);
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
      <div className="flex rounded-md border border-borde bg-fondo p-1" role="tablist">
        {(["login", "registro"] as const).map((x) => (
          <button
            type="button"
            role="tab"
            aria-selected={modo === x}
            key={x}
            onClick={() => {
              setModo(x);
              setError("");
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${modo === x ? "border border-rojo/60 bg-vino text-salmon" : "text-tenue hover:text-tinta"}`}
          >
            {x === "login" ? <LogIn aria-hidden className="h-3.5 w-3.5" /> : <UserPlus aria-hidden className="h-3.5 w-3.5" />}
            {x === "login" ? "Iniciar sesión" : "Registrarse"}
          </button>
        ))}
      </div>
      {modo === "registro" && <Campo label="Nombre" value={nombre} onChange={setNombre} autoComplete="name" />}
      <Campo label="Correo electrónico" value={correo} onChange={setCorreo} type="email" autoComplete="email" />
      <Campo label="Contraseña" value={clave} onChange={setClave} type="password" autoComplete={modo === "login" ? "current-password" : "new-password"} />
      {/* Campo trampa: oculto para personas y lectores de pantalla; los bots suelen rellenarlo */}
      <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" aria-hidden value={trampa} onChange={(e) => setTrampa(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      {error && <p className="rounded-md border border-rojo/60 bg-vino/50 p-2.5 text-sm text-salmon">{error}</p>}
      <Boton type="submit" tamano="lg" icono={modo === "login" ? LogIn : UserPlus} cargando={verificando} className="w-full">
        {verificando ? "Verificando…" : modo === "login" ? "Entrar" : "Crear cuenta"}
      </Boton>
      <AvisoRecaptcha />
      <p className="text-[11px] text-apagado">
        {modo === "registro" ? `Cada cuenta nueva recibe ${PARAMETROS.bonoBienvenida} créditos propios de bienvenida. ` : ""}
        Demo: las cuentas de prueba usan <code className="text-tinta">{CLAVE_DEMO}</code>.
      </p>

      <div className="border-t border-borde pt-3">
        <button type="button" onClick={() => setVerDemos(!verDemos)} aria-expanded={verDemos} className="etiqueta flex w-full items-center justify-between text-oro">
          Accesos de demostración <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${verDemos ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {verDemos && (
            <m.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-2 space-y-1.5">
              {USUARIOS_DEMO.map((d) => {
                const rol = cuentas[d.correo]?.rol ?? d.rol;
                return (
                  <button
                    type="button"
                    key={d.correo}
                    disabled={verificando}
                    onClick={() => entrarDemo(d)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-borde bg-fondo px-3 py-2 text-left text-xs transition-colors hover:border-arena disabled:opacity-40"
                  >
                    <span>
                      <b>{d.nombre}</b> <span className="text-tenue">· {d.desc}</span>
                    </span>
                    <span className={rol === "cliente" ? "badge-borde" : "badge-vino"}>{ROL_TXT[rol].split(" ")[0]}</span>
                  </button>
                );
              })}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </form>
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
