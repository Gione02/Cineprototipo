"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";

const ROL_TXT = { cliente: "Cliente", agente: "Agente Operativo", admin: "Administrador", auditor: "Auditor" } as const;

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-md border border-rojo/50 bg-vino">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-salmon" aria-hidden>
          <path d="M7 4.5v15l12-7.5z" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block text-lg font-black tracking-tight">CINEIGHT</span>
        <span className="hidden whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.28em] text-oro sm:block">Cine en línea</span>
      </span>
    </Link>
  );
}

export function Header() {
  const { usuario, saldo, logout, listo, abrirLogin } = useApp();
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const staff = usuario && usuario.rol !== "cliente";

  // El personal interno no compra boletos: sólo ve su panel de operaciones.
  const links = staff
    ? [{ href: "/panel", txt: "Panel de operaciones" }]
    : [
        { href: "/", txt: "Cartelera" },
        { href: "/#estreno", txt: "Estrenos" },
        { href: "/#proximamente", txt: "Próximamente" },
        ...(usuario?.rol === "cliente" ? [{ href: "/mis-entradas", txt: "Mis Entradas" }] : []),
      ];
  const iniciales = usuario?.nombre.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-borde bg-fondo/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Logo href={staff ? "/panel" : "/"} />

        <nav className="ml-4 hidden gap-1 xl:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                ruta === l.href ? "border border-borde bg-panel-2 text-oro" : "text-tenue hover:text-tinta"
              }`}
            >
              {l.txt}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {listo && usuario?.rol === "cliente" && (
            <Link
              href="/trivia"
              title="Gana más créditos jugando la trivia"
              aria-label={`${saldo} créditos. Abrir la trivia para ganar más`}
              className="relative flex items-center gap-2 rounded-md border border-borde bg-panel px-3 py-1.5 transition hover:border-oro"
            >
              <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-oro opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-oro" />
              </span>
              <span className="grid h-5 w-5 place-items-center rounded-full border border-oro/70 text-[10px] font-black text-oro">◆</span>
              <span className="text-sm font-bold tabular-nums">{saldo.toLocaleString("es-GT")}</span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-tenue sm:inline">créditos</span>
            </Link>
          )}
          {listo && usuario ? (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-arena/60 bg-panel-2 text-xs font-black text-arena">{iniciales}</span>
              <span className="text-xs leading-tight">
                <span className="block font-bold">{usuario.nombre}</span>
                <span className="block text-[10px] uppercase tracking-wider text-tenue">{ROL_TXT[usuario.rol]}</span>
              </span>
              <button onClick={logout} className="btn-borde ml-1 px-3 py-2 text-[10px]">
                Salir
              </button>
            </div>
          ) : (
            listo && (
              <button onClick={() => abrirLogin()} className="btn-vino px-4 py-2.5">
                Iniciar sesión
              </button>
            )
          )}
          <button className="btn-borde px-3 py-2 xl:hidden" onClick={() => setAbierto(!abierto)} aria-label="Menú">
            ☰
          </button>
        </div>
      </div>
      {abierto && (
        <nav className="flex flex-col border-t border-borde px-4 py-2 xl:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setAbierto(false)} className="py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-tinta">
              {l.txt}
            </Link>
          ))}
          {usuario && (
            <button onClick={() => { logout(); setAbierto(false); }} className="py-2.5 text-left text-xs font-bold uppercase tracking-[0.14em] text-tenue">
              Salir ({ROL_TXT[usuario.rol]})
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
