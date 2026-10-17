"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { ArrowLeft } from "lucide-react";

const MotionLink = m.create(Link);

/**
 * Regreso minimalista: sólo una flecha. El destino se anuncia a lectores de pantalla
 * y aparece como tooltip al pasar el cursor.
 */
export function BotonVolver({ href = "/", texto = "Volver a la cartelera", className = "" }: { href?: string; texto?: string; className?: string }) {
  return (
    <MotionLink
      href={href}
      aria-label={texto}
      title={texto}
      whileHover={{ x: -3 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`grid h-10 w-10 place-items-center rounded-full border border-borde bg-panel/80 text-tinta shadow-lg shadow-black/40 backdrop-blur transition-colors hover:border-oro hover:text-oro ${className}`}
    >
      <ArrowLeft aria-hidden className="h-5 w-5" />
    </MotionLink>
  );
}
