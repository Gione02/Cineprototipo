import Link from "next/link";
import Image from "next/image";

/**
 * Logotipo de Cineight: emblema (PNG con fondo transparente) + nombre.
 * El emblema mantiene su proporción (480 × 245) y escala con la altura: 28 px en móvil, 36 px desde sm.
 * Al ser transparente funciona sobre cualquier fondo; el resplandor rojo le da contraste en el tema oscuro.
 */
export function Logo({ href = "/", compacto = false }: { href?: string; compacto?: boolean }) {
  return (
    <Link href={href} className="group flex shrink-0 items-center gap-2" aria-label="Cineight, ir al inicio">
      <Image
        src="/logo-cineight.png"
        alt=""
        aria-hidden
        width={480}
        height={245}
        priority
        quality={75}
        sizes="72px"
        className="h-7 w-auto drop-shadow-[0_0_10px_rgba(200,55,45,0.35)] transition-transform duration-300 group-hover:scale-105 sm:h-9"
      />
      {!compacto && (
        <span className="leading-none">
          <span className="block text-base font-black tracking-tight sm:text-lg">CINEIGHT</span>
          <span className="hidden whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.28em] text-oro sm:block">Cine en línea</span>
        </span>
      )}
    </Link>
  );
}
