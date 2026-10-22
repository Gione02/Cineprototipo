import type { Metadata } from "next";
import { Bebas_Neue, Montserrat } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/store/AppProvider";
import { Header } from "@/components/layout/Header";
import { GuardiaRol } from "@/components/layout/GuardiaRol";
import { Ventanas } from "@/components/layout/Ventanas";
import { AvisoTrivia } from "@/components/trivia/AvisoTrivia";

const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });
// Tipografía de cartelera para los títulos (clase .titulo): condensada, de un solo grosor.
const bebas = Bebas_Neue({ variable: "--font-bebas", subsets: ["latin", "latin-ext"], weight: "400" });

export const metadata: Metadata = {
  title: "Cineight — Cine y boletería en línea",
  description: "Compra boletos de cine en línea: cartelera, horarios, elección de butacas en tiempo real y preestrenos.",
};

// Esqueleto común: estado global, encabezado y ventanas emergentes.
// Cada sección define su propio contenedor: (sitio)/layout.tsx para el público y panel/layout.tsx para el personal.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: extensiones del navegador (p. ej. Scribe) agregan atributos a <html> antes de hidratar.
    <html lang="es" className={`${montserrat.variable} ${bebas.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col font-sans">
        <AppProvider>
          <Header />
          <GuardiaRol>{children}</GuardiaRol>
          <AvisoTrivia />
          <Ventanas />
        </AppProvider>
      </body>
    </html>
  );
}
