import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { Header } from "@/components/Header";
import { AvisoTrivia } from "@/components/AvisoTrivia";
import { GuardiaRol } from "@/components/GuardiaRol";
import { Ventanas } from "@/components/Ventanas";
import { EstadoApi } from "@/components/EstadoApi";

const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "Cineight — Cine y boletería en línea",
  description: "Prototipo de la plataforma de boletería Cineight (ERS v1.4)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: extensiones del navegador (p. ej. Scribe) agregan atributos a <html> antes de hidratar.
    <html lang="es" className={`${montserrat.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col font-sans">
        <AppProvider>
          <Header />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <GuardiaRol>{children}</GuardiaRol>
          </main>
          <footer className="border-t border-borde">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-[10px] uppercase tracking-[0.16em] text-apagado sm:px-6">
              <span>
                <b className="text-sm tracking-tight text-tinta">CINEIGHT</b> <span className="ml-2 text-oro">Cine en línea</span>
              </span>
              <span>Prototipo académico · Análisis de Sistemas II · UMG</span>
              <EstadoApi />
              <span>Pósters: Wikipedia (uso académico) · Tráileres: YouTube</span>
            </div>
          </footer>
          <AvisoTrivia />
          <Ventanas />
        </AppProvider>
      </body>
    </html>
  );
}
