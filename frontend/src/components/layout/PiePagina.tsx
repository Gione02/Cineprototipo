/** Pie de página del sitio público (el panel de operaciones no lo usa). */
export function PiePagina() {
  return (
    <footer className="border-t border-borde">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-[10px] uppercase tracking-[0.16em] text-apagado sm:px-6">
        <span>
          <b className="text-sm tracking-tight text-tinta">CINEIGHT</b> <span className="ml-2 text-oro">Cine en línea</span>
        </span>
        <span>Análisis de Sistemas II · UMG</span>
        <span>Pósters: Wikipedia (uso académico) · Tráileres: YouTube</span>
      </div>
    </footer>
  );
}
