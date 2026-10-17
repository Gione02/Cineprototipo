"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BotonIcono } from "./Boton";

type Props = {
  children: ReactNode;
  /** Nombre accesible del carrusel (p. ej. "En cartelera"). */
  etiqueta: string;
  /** Ancho de cada elemento en clases de Tailwind. Por defecto: 2 visibles en móvil, 3 en tableta, 4 en escritorio, 5 en pantallas anchas. */
  anchoItem?: string;
};

/**
 * Carrete horizontal de desplazamiento libre.
 * - Gestos táctiles y trackpad: es un contenedor con scroll nativo y scroll-snap, así que el arrastre es fluido.
 * - Sólo se desplaza en horizontal: overflow-y-hidden evita que la rueda del ratón o el gesto vertical queden
 *   atrapados en el carrete (overflow-x-auto activaría también el scroll vertical) y la página sigue bajando.
 * - Ratón y teclado: flechas laterales que avanzan una "página" visible. Se ocultan si no hay más contenido.
 */
export function Carrusel({ children, etiqueta, anchoItem = "w-[46%] sm:w-[31%] lg:w-[23.5%] 2xl:w-[18.8%]" }: Props) {
  const pista = useRef<HTMLDivElement>(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);

  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    setPuedeIzq(el.scrollLeft > 4);
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    el.addEventListener("scroll", medir, { passive: true });
    return () => {
      obs.disconnect();
      el.removeEventListener("scroll", medir);
    };
  }, [medir]);

  const mover = (dir: 1 | -1) => {
    const el = pista.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div className="group/carrusel relative" role="region" aria-roledescription="carrusel" aria-label={etiqueta}>
      <div
        ref={pista}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") mover(1);
          if (e.key === "ArrowLeft") mover(-1);
        }}
        className="sin-scrollbar -mx-4 flex touch-pan-x touch-pan-y snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 pb-2 outline-none sm:-mx-6 sm:scroll-px-6 sm:gap-5 sm:px-6"
      >
        {Children.map(children, (hijo) => (
          <div className={`shrink-0 snap-start ${anchoItem}`}>{hijo}</div>
        ))}
      </div>

      {/* Flechas: en pantallas táctiles el gesto es suficiente, por eso sólo se muestran desde sm */}
      <div className={`pointer-events-none absolute inset-y-0 -left-2 hidden items-center transition-opacity sm:flex ${puedeIzq ? "opacity-100" : "opacity-0"}`}>
        <BotonIcono icono={ChevronLeft} etiqueta={`Anterior · ${etiqueta}`} variante="borde" onClick={() => mover(-1)} disabled={!puedeIzq} className="pointer-events-auto !rounded-full bg-fondo/90 shadow-xl shadow-black/60 backdrop-blur" />
      </div>
      <div className={`pointer-events-none absolute inset-y-0 -right-2 hidden items-center transition-opacity sm:flex ${puedeDer ? "opacity-100" : "opacity-0"}`}>
        <BotonIcono icono={ChevronRight} etiqueta={`Siguiente · ${etiqueta}`} variante="borde" onClick={() => mover(1)} disabled={!puedeDer} className="pointer-events-auto !rounded-full bg-fondo/90 shadow-xl shadow-black/60 backdrop-blur" />
      </div>
    </div>
  );
}
