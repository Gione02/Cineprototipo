import Image from "next/image";
import type { Pelicula } from "@/types/catalogo";
import { posterSinOptimizar } from "@/utils/imagen";

type Props = {
  p: Pelicula;
  className?: string;
  rounded?: string;
  // Ancho con el que se muestra, para que next/image elija el tamaño justo (las miniaturas no bajan el póster completo).
  sizes?: string;
  // Imagen principal visible al cargar (LCP): se pide con prioridad alta y sin carga diferida.
  prioridad?: boolean;
};

// El contenedor fija la proporción (aspect-[2/3] en className) y la imagen lo llena: no hay saltos de diseño (CLS).
export function Poster({ p, className = "", rounded = "rounded-lg", sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px", prioridad = false }: Props) {
  // Pósters subidos desde el panel (data URL o servidos por la API): se muestran sin pasar por el optimizador.
  const unoptimized = posterSinOptimizar(p.poster);
  const carga = prioridad ? ({ fetchPriority: "high", loading: "eager" } as const) : ({ loading: "lazy" } as const);
  return (
    <div className={`relative overflow-hidden ${rounded} border border-white/5 ${className}`} style={{ background: `linear-gradient(160deg, ${p.acento}, #0b0b0d 75%)` }}>
      {p.posterLogo ? (
        <>
          {/* Caja centrada (85 % × 45 %) donde el logotipo se ajusta sin deformarse */}
          <div className="absolute inset-x-[7.5%] top-[27.5%] h-[45%]">
            <Image src={p.poster} alt={`Logotipo de ${p.titulo}`} fill sizes={sizes} quality={75} unoptimized={unoptimized} className="object-contain" {...carga} />
          </div>
          <span className="absolute inset-x-0 top-[68%] text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">Póster próximamente</span>
        </>
      ) : (
        <Image src={p.poster} alt={`Póster de ${p.titulo}`} fill sizes={sizes} quality={75} unoptimized={unoptimized} className="object-cover" {...carga} />
      )}
    </div>
  );
}
