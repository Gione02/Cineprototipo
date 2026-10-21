"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { Check, ChevronDown, Circle, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { CLAVE_DEMO, ROL_TXT, USUARIOS_DEMO } from "@/data/catalogo";
import { PARAMETROS } from "@/data/parametros";
import type { Rol } from "@/types/catalogo";
import { useApp } from "@/store/AppProvider";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { Modal } from "@/components/ui/Modal";
import { Boton } from "@/components/ui/Boton";
import { AvisoRecaptcha } from "./AvisoRecaptcha";
import {
  CLAVE_MAX,
  CORREO_MAX,
  NOMBRE_MAX,
  normalizarCorreo,
  normalizarNombre,
  requisitosClave,
  validarClaveLogin,
  validarClaveNueva,
  validarCorreo,
  validarNombre,
} from "@/utils/validacion";

type CampoForm = "nombre" | "correo" | "clave";

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
  const [verClave, setVerClave] = useState(false);
  // Un campo muestra su error después de salir de él (o al intentar enviar), no mientras se escribe por primera vez.
  const [tocados, setTocados] = useState<Partial<Record<CampoForm, boolean>>>({});

  // Reglas: en el registro se valida todo (nombre completo, correo real, contraseña segura);
  // al iniciar sesión sólo el formato del correo y que haya contraseña (no se revelan las reglas de las cuentas).
  const errores: Partial<Record<CampoForm, string | null>> = {
    nombre: modo === "registro" ? validarNombre(nombre) : null,
    correo: validarCorreo(correo, { estricto: modo === "registro" }),
    clave: modo === "registro" ? validarClaveNueva(clave, correo) : validarClaveLogin(clave),
  };
  const errorDe = (c: CampoForm) => (tocados[c] ? errores[c] : null) ?? undefined;
  const tocar = (c: CampoForm) => setTocados((t) => ({ ...t, [c]: true }));
  const abierto = useRef(0);
  const idBase = useId();
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
    const c = normalizarCorreo(correo);
    if (fallos >= PARAMETROS.intentosFallidos) return setError("Acceso bloqueado temporalmente por intentos fallidos (RF-43).");
    // Validación de formato antes de cualquier otra cosa: se marcan todos los campos y se enfoca el primero con error.
    setTocados({ nombre: true, correo: true, clave: true });
    const primero = (["nombre", "correo", "clave"] as const).find((k) => errores[k]);
    if (primero) {
      document.getElementById(`${idBase}-${primero}`)?.focus();
      return;
    }

    setVerificando(true);
    const bot = await antiBot(modo);
    setVerificando(false);
    if (bot) return setError(bot);

    // Las credenciales se procesan sólo después de superar la verificación anti-bots.
    if (modo === "registro") {
      const n = normalizarNombre(nombre);
      const r = registrarCliente(n, c, clave);
      if (!r.ok) return setError(r.error!);
      toast(`Cuenta creada con ${PARAMETROS.bonoBienvenida} créditos de bienvenida. Enviamos un correo de confirmación a ${c}.`, "ok");
      return terminar("cliente", n);
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
    <form onSubmit={enviar} className="space-y-4" autoComplete="on" noValidate>
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
              setTocados({});
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${modo === x ? "border border-rojo/60 bg-vino text-salmon" : "text-tenue hover:text-tinta"}`}
          >
            {x === "login" ? <LogIn aria-hidden className="h-3.5 w-3.5" /> : <UserPlus aria-hidden className="h-3.5 w-3.5" />}
            {x === "login" ? "Iniciar sesión" : "Registrarse"}
          </button>
        ))}
      </div>
      {modo === "registro" && (
        <Campo
          id={`${idBase}-nombre`}
          label="Nombre y apellido"
          value={nombre}
          onChange={setNombre}
          onBlur={() => {
            setNombre((v) => normalizarNombre(v));
            tocar("nombre");
          }}
          error={errorDe("nombre")}
          autoComplete="name"
          maxLength={NOMBRE_MAX}
          placeholder="Ej. Ana López"
        />
      )}
      <Campo
        id={`${idBase}-correo`}
        label="Correo electrónico"
        value={correo}
        onChange={(v) => setCorreo(v.replace(/\s/g, ""))}
        onBlur={() => {
          setCorreo((v) => normalizarCorreo(v));
          tocar("correo");
        }}
        error={errorDe("correo")}
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={CORREO_MAX}
        placeholder="nombre@dominio.com"
      />
      <Campo
        id={`${idBase}-clave`}
        label="Contraseña"
        value={clave}
        onChange={setClave}
        onBlur={() => tocar("clave")}
        error={errorDe("clave")}
        type={verClave ? "text" : "password"}
        autoComplete={modo === "login" ? "current-password" : "new-password"}
        maxLength={CLAVE_MAX}
        accion={
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            title={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="grid h-full w-10 place-items-center text-tenue transition-colors hover:text-tinta"
          >
            {verClave ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
          </button>
        }
      />
      {modo === "registro" && (
        <ul className="-mt-2 grid gap-1 sm:grid-cols-2" aria-label="Requisitos de la contraseña">
          {requisitosClave(clave, correo).map((r) => (
            <li key={r.texto} className={`flex items-center gap-1.5 text-[11px] ${r.ok ? "text-oro" : "text-apagado"}`}>
              {r.ok ? <Check aria-hidden className="h-3 w-3 shrink-0" /> : <Circle aria-hidden className="h-3 w-3 shrink-0" />}
              {r.texto}
            </li>
          ))}
        </ul>
      )}
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

type PropsCampo = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  type?: string;
  inputMode?: "email" | "text";
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
  /** Botón dentro del campo, a la derecha (p. ej. mostrar contraseña). */
  accion?: React.ReactNode;
};

/** Campo con mensaje de error accesible (aria-invalid + aria-describedby) debajo del input. */
function Campo({ id, label, value, onChange, onBlur, error, type = "text", inputMode, autoComplete, maxLength, placeholder, accion }: PropsCampo) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta block">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize={type === "email" || inputMode === "email" ? "none" : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`campo normal-case tracking-normal ${accion ? "pr-11" : ""} ${error ? "!border-rojo focus:!border-rojo" : ""}`}
        />
        {accion && <div className="absolute inset-y-0 right-0 mt-1">{accion}</div>}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-semibold text-salmon">
          {error}
        </p>
      )}
    </div>
  );
}
