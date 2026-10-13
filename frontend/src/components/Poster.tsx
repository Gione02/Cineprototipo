/* eslint-disable @next/next/no-img-element -- pósters locales pequeños; no requieren optimización */
import type { Pelicula } from "@/lib/data";

export function Poster({ p, className = "", rounded = "rounded-lg" }: { p: Pelicula; className?: string; rounded?: string }) {
  return (
    <div className={`relative overflow-hidden ${rounded} border border-white/5 ${className}`} style={{ background: `linear-gradient(160deg, ${p.acento}, #0b0b0d 75%)` }}>
      {p.posterLogo ? (
        <>
          <img src={p.poster} alt={`Logotipo de ${p.titulo}`} className="absolute inset-0 m-auto max-h-[45%] w-[85%] object-contain" />
          <span className="absolute inset-x-0 top-[68%] text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">Póster próximamente</span>
        </>
      ) : (
        <img src={p.poster} alt={`Póster de ${p.titulo}`} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </div>
  );
}
