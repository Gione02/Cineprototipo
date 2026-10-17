"use client";

import { LogIn } from "lucide-react";
import { Boton } from "@/components/ui/Boton";
import { PARAMETROS } from "@/data/parametros";
import { useApp } from "@/store/AppProvider";
import { TriviaJuego } from "@/components/trivia/TriviaJuego";

// Página directa de la trivia (enlaces compartidos). Dentro de la app, la trivia se abre en ventana emergente
// desde la píldora de créditos, para no sacar al cliente de la página en la que está.
export default function Trivia() {
  const { usuario, listo, abrirLogin } = useApp();

  if (listo && !usuario)
    return (
      <div className="tarjeta mx-auto max-w-md p-8 text-center">
        <p className="titulo text-lg">Trivia de cine</p>
        <p className="mt-2 text-sm text-tenue">Inicia sesión para jugar la trivia y ganar créditos.</p>
        <Boton icono={LogIn} onClick={() => abrirLogin()} className="mt-5">
          Iniciar sesión
        </Boton>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <p className="etiqueta text-salmon">Programa de créditos Cineight</p>
      <h1 className="titulo mt-1 text-3xl">Trivia de cine</h1>
      <p className="mb-4 mt-1 text-sm text-tenue">
        {PARAMETROS.preguntasTrivia} preguntas sobre la cartelera. {PARAMETROS.creditosPorRespuesta} créditos por acierto, {PARAMETROS.bonoTriviaPerfecta} si las aciertas todas.
      </p>
      <TriviaJuego />
    </div>
  );
}
