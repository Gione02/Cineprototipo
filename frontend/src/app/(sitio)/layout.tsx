import { PiePagina } from "@/components/layout/PiePagina";

// Sitio público (cartelera, compra, Mis Entradas): contenido centrado y pie de página.
export default function LayoutSitio({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <PiePagina />
    </>
  );
}
