import Link from "next/link";

// Botón de regreso destacado (ficha de película, función, cola).
export function BotonVolver({ href = "/", texto = "Volver a la cartelera" }: { href?: string; texto?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-3 rounded-md border border-arena/50 bg-panel/90 py-2 pl-2 pr-4 text-xs font-bold uppercase tracking-[0.14em] text-tinta shadow-lg shadow-black/40 backdrop-blur transition hover:border-oro hover:text-oro"
    >
      <span className="grid h-8 w-8 place-items-center rounded border border-rojo/60 bg-vino text-base text-salmon transition group-hover:-translate-x-0.5">←</span>
      {texto}
    </Link>
  );
}
