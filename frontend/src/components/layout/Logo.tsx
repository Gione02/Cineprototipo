import Link from "next/link";
import Image from "next/image";

/**
 * Logotipo de Cineight: emblema (PNG con fondo transparente) + nombre.
 * El emblema mantiene su proporción (480 × 245) y escala con la altura: 28 px en móvil, 36 px desde sm.
 * Al cargar la página se enciende con un resplandor rojo y un destello lo recorre una vez (.logo-destello en globals.css).
 */
export function Logo({ href = "/", compacto = false }: { href?: string; compacto?: boolean }) {
  return (
    <Link href={href} className="group flex shrink-0 items-center gap-2" title="Ir al inicio">
      <span className="logo-destello transition-transform duration-300 group-hover:scale-105">
        <Image src="/logo-cineight.png" alt="" aria-hidden width={480} height={245} priority quality={75} sizes="72px" className="h-7 w-auto sm:h-9" />
      </span>
      {/* El nombre accesible sale del texto visible (WCAG 2.5.3); sin texto visible, se agrega uno sólo para lectores de pantalla */}
      {compacto && <span className="sr-only">Cineight, ir al inicio</span>}
      {!compacto && (
        <span className="leading-none">
          <span className="titulo block text-xl leading-none sm:text-2xl">CINEIGHT</span>
          <span className="hidden whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.28em] text-oro sm:block">Cine en línea</span>
        </span>
      )}
    </Link>
  );
}
