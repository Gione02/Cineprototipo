// Panel de operaciones: ocupa todo el alto disponible bajo el encabezado.
// En escritorio la página no se desplaza; sólo lo hace el área de contenido (ver components/panel/MarcoPanel).
export default function LayoutPanel({ children }: LayoutProps<"/panel">) {
  return <main className="flex w-full flex-1 flex-col">{children}</main>;
}
