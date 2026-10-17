"use client";

import type { Pelicula } from "@/types/catalogo";
import { Modal } from "@/components/ui/Modal";

export function ModalTrailer({ p, abierto, onCerrar }: { p: Pelicula; abierto: boolean; onCerrar: () => void }) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={`Tráiler oficial · ${p.titulo}`} ancho="max-w-4xl">
      {p.trailer ? (
        <div className="aspect-video overflow-hidden rounded-lg border border-borde bg-black">
          {abierto && (
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${p.trailer}?autoplay=1&rel=0`}
              title={`Tráiler de ${p.titulo}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      ) : (
        <div className="grid aspect-video place-items-center rounded-lg border border-dashed border-borde bg-fondo text-center">
          <div>
            <p className="titulo text-lg">Tráiler aún no disponible</p>
            <p className="mt-1 text-sm text-tenue">El estudio todavía no ha publicado el avance oficial de esta película.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
