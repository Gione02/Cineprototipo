"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Clapperboard, Gem, LayoutDashboard, LogIn, Menu, Sparkles, Ticket, X, type LucideIcon } from "lucide-react";
import { useApp } from "@/store/AppProvider";
import { Boton, BotonIcono } from "@/components/ui/Boton";
import { Logo } from "./Logo";
import { MenuUsuario } from "./MenuUsuario";

type Enlace = { href: string; txt: string; icono: LucideIcon };

/** Barra de navegación superior fija (alto = --alto-header). */
export function Header() {
  const { usuario, saldo, saldoListo, listo, abrirLogin, abrirTrivia } = useApp();
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const staff = !!usuario && usuario.rol !== "cliente";

  // El personal interno no compra boletos: sólo ve su panel de operaciones.
  const enlaces: Enlace[] = staff
    ? [{ href: "/panel", txt: "Panel de operaciones", icono: LayoutDashboard }]
    : [
        { href: "/", txt: "Cartelera", icono: Clapperboard },
        { href: "/#estreno", txt: "Estrenos", icono: Sparkles },
        { href: "/#proximamente", txt: "Próximamente", icono: Gem },
        ...(usuario?.rol === "cliente" ? [{ href: "/mis-entradas", txt: "Mis Entradas", icono: Ticket }] : []),
      ];

  return (
    <header className="sticky top-0 z-40 h-[var(--alto-header)] border-b border-borde bg-fondo/85 backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Logo href={staff ? "/panel" : "/"} />

        <nav className="ml-4 hidden gap-1 xl:flex" aria-label="Principal">
          {enlaces.map(({ href, txt, icono: Icono }) => (
            <Link
              key={href}
              href={href}
              aria-current={ruta === href ? "page" : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
                ruta === href ? "border border-borde bg-panel-2 text-oro" : "text-tenue hover:text-tinta"
              }`}
            >
              <Icono aria-hidden className="h-3.5 w-3.5" />
              {txt}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {listo && usuario?.rol === "cliente" && (
            <m.button
              type="button"
              onClick={abrirTrivia}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              title="Gana más créditos jugando la trivia"
              className="relative flex items-center gap-2 rounded-md border border-borde bg-panel px-2.5 py-1.5 transition-colors hover:border-oro sm:px-3"
            >
              <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-oro opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-oro" />
              </span>
              <Gem aria-hidden className="h-4 w-4 text-oro" />
              {saldoListo ? (
                <span className="text-sm font-bold tabular-nums">{saldo.toLocaleString("es-GT")}</span>
              ) : (
                <>
                  <span aria-hidden className="inline-block h-4 w-6 animate-pulse rounded bg-panel-2" />
                  <span className="sr-only">Cargando saldo</span>
                </>
              )}{" "}
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-tenue sm:inline">créditos</span>
              <span className="sr-only sm:hidden">créditos</span>
              <span className="sr-only">. Abrir la trivia para ganar más</span>
            </m.button>
          )}
          {listo && usuario ? (
            <MenuUsuario />
          ) : (
            listo && (
              <Boton icono={LogIn} onClick={() => abrirLogin()} className="!px-3 !py-2.5 sm:!px-4">
                <span className="hidden sm:inline">Iniciar sesión</span>
                <span className="sm:hidden">Entrar</span>
              </Boton>
            )
          )}
          {!staff && <BotonIcono icono={abierto ? X : Menu} etiqueta={abierto ? "Cerrar menú" : "Abrir menú"} variante="borde" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="xl:hidden" />}
        </div>
      </div>

      <AnimatePresence>
        {abierto && (
          <m.nav
            aria-label="Principal"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-0 top-full flex flex-col border-b border-borde bg-fondo/95 px-4 py-2 backdrop-blur xl:hidden"
          >
            {enlaces.map(({ href, txt, icono: Icono }) => (
              <Link key={href} href={href} onClick={() => setAbierto(false)} className="flex items-center gap-3 py-3 text-sm font-semibold text-tinta">
                <Icono aria-hidden className="h-4 w-4 text-arena" />
                {txt}
              </Link>
            ))}
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
