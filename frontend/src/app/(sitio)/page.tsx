"use client";

import { CATEGORIAS } from "@/data/catalogo";
import { useApp } from "@/store/AppProvider";
import { Carrusel } from "@/components/ui/Carrusel";
import { Destacado } from "@/components/cartelera/Destacado";
import { TarjetaPelicula } from "@/components/cartelera/TarjetaPelicula";
import { BannerTrivia } from "@/components/cartelera/BannerTrivia";

// Cartelera: portada del preestreno y un carrete horizontal por categoría (En cartelera, Estrenos, Próximamente).
export default function Cartelera() {
  const { peliculas } = useApp();
  return (
    <div className="space-y-14">
      <Destacado />
      {CATEGORIAS.map((c) => {
        const pelis = peliculas.filter((p) => p.categoria === c.id);
        return (
          <section key={c.id} id={c.id} className="scroll-mt-24">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="etiqueta text-oro">{c.sub}</p>
                <h2 className="titulo mt-1 text-2xl sm:text-3xl">{c.titulo}</h2>
              </div>
              <span className="etiqueta whitespace-nowrap">{pelis.length} películas</span>
            </div>
            <Carrusel etiqueta={c.titulo}>
              {pelis.map((p, i) => (
                <TarjetaPelicula key={p.id} p={p} i={i} />
              ))}
            </Carrusel>
          </section>
        );
      })}
      <BannerTrivia />
    </div>
  );
}
