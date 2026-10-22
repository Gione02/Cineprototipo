"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { m, type Transition } from "framer-motion";
import { Loader2, type LucideIcon } from "lucide-react";

// Botones del sistema de diseño: estilos de Tailwind (globals.css) + micro-animaciones de Framer Motion.
// Sólo se animan transform/opacity, que corren en el compositor sin recalcular el layout.

export type Variante = "vino" | "borde" | "oro" | "fantasma";
export type Tamano = "sm" | "md" | "lg";

const VARIANTE: Record<Variante, string> = { vino: "btn-vino", borde: "btn-borde", oro: "btn-oro", fantasma: "btn-fantasma" };
const TAMANO: Record<Tamano, string> = { sm: "!px-3 !py-2 !text-xs", md: "", lg: "!py-3.5 !text-sm" };
const ICONO: Record<Tamano, string> = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-4 w-4" };

const resorte: Transition = { type: "spring", stiffness: 500, damping: 30 };
const hover = { y: -1 };
const tap = { scale: 0.97 };

type Comunes = {
  variante?: Variante;
  tamano?: Tamano;
  /** Ícono de lucide-react antes del texto. */
  icono?: LucideIcon;
  /** Ícono después del texto (p. ej. una flecha). */
  iconoFinal?: LucideIcon;
  children?: ReactNode;
  className?: string;
};

function Contenido({ icono: Icono, iconoFinal: IconoFinal, tamano = "md", cargando, children }: Comunes & { cargando?: boolean }) {
  const cls = `${ICONO[tamano]} shrink-0`;
  return (
    <>
      {cargando ? <Loader2 aria-hidden className={`${cls} animate-spin`} /> : Icono && <Icono aria-hidden className={cls} />}
      {/* El texto puede partirse en dos líneas en contenedores angostos en lugar de desbordar el botón */}
      {children != null && children !== false && <span className="min-w-0 text-balance">{children}</span>}
      {IconoFinal && <IconoFinal aria-hidden className={`${cls} transition-transform group-hover:translate-x-0.5`} />}
    </>
  );
}

type PropsBoton = Comunes & Omit<ComponentProps<typeof m.button>, "children"> & { cargando?: boolean };

/** Botón con ícono opcional, estado de carga y animación al pasar el cursor y al pulsar. */
export function Boton({ variante = "vino", tamano = "md", icono, iconoFinal, cargando, className = "", children, disabled, type = "button", ...props }: PropsBoton) {
  const inactivo = disabled || cargando;
  return (
    <m.button
      type={type}
      disabled={inactivo}
      aria-busy={cargando || undefined}
      whileHover={inactivo ? undefined : hover}
      whileTap={inactivo ? undefined : tap}
      transition={resorte}
      className={`group ${VARIANTE[variante]} ${TAMANO[tamano]} ${className}`}
      {...props}
    >
      <Contenido icono={icono} iconoFinal={iconoFinal} tamano={tamano} cargando={cargando}>
        {children}
      </Contenido>
    </m.button>
  );
}

const MotionLink = m.create(Link);

type PropsEnlace = Comunes & Omit<ComponentProps<typeof MotionLink>, "children">;

/** Enlace con apariencia de botón (navegación interna con next/link). */
export function BotonEnlace({ variante = "vino", tamano = "md", icono, iconoFinal, className = "", children, ...props }: PropsEnlace) {
  return (
    <MotionLink whileHover={hover} whileTap={tap} transition={resorte} className={`group ${VARIANTE[variante]} ${TAMANO[tamano]} ${className}`} {...props}>
      <Contenido icono={icono} iconoFinal={iconoFinal} tamano={tamano}>
        {children}
      </Contenido>
    </MotionLink>
  );
}

type PropsIcono = Omit<ComponentProps<typeof m.button>, "children"> & {
  icono: LucideIcon;
  /** Texto accesible obligatorio: el botón no tiene texto visible. También se muestra como tooltip. */
  etiqueta: string;
  variante?: "borde" | "fantasma" | "vino";
  tamano?: "sm" | "md";
};

const ICONO_VARIANTE = {
  borde: "border border-borde bg-panel-2 text-tinta hover:border-arena hover:text-white",
  fantasma: "text-tenue hover:bg-panel-2 hover:text-white",
  vino: "border border-rojo/60 bg-vino text-salmon hover:bg-vino-2 hover:text-white",
};

/** Botón cuadrado sólo con ícono (cerrar, menú, navegar). */
export function BotonIcono({ icono: Icono, etiqueta, variante = "fantasma", tamano = "md", className = "", disabled, type = "button", ...props }: PropsIcono) {
  return (
    <m.button
      type={type}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.06 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={resorte}
      className={`grid shrink-0 place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${tamano === "sm" ? "h-8 w-8" : "h-10 w-10"} ${ICONO_VARIANTE[variante]} ${className}`}
      {...props}
    >
      <Icono aria-hidden className={tamano === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </m.button>
  );
}
