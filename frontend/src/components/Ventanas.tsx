"use client";

import dynamic from "next/dynamic";
import { useApp } from "@/lib/store";

// Ventanas globales con carga diferida: su código se descarga la primera vez que se abren,
// no en la carga inicial de cada página. Una vez abiertas quedan montadas para conservar
// la animación de cierre.
const TriviaModal = dynamic(() => import("./TriviaModal"), { ssr: false });
const LoginModal = dynamic(() => import("./LoginModal").then((x) => x.LoginModal), { ssr: false });

export function Ventanas() {
  const { triviaUsada, loginUsado } = useApp();
  return (
    <>
      {loginUsado && <LoginModal />}
      {triviaUsada && <TriviaModal />}
    </>
  );
}
