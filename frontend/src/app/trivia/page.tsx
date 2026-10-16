"use client";

import { PARAMETROS } from "@/lib/data";
import { useApp } from "@/lib/store";
import { TriviaJuego } from "@/components/TriviaJuego";

// Página directa de la trivia (enlaces compartidos). Dentro de la app, la trivia se abre en ventana emergente
// desde la píldora de créditos, para no sacar al cliente de la página en la que está.
export default function Trivia() {
  const { usuario, listo, abrirLogin } = useApp();

  if (listo && !usuario)
    return (
      <div className="tarjeta mx-auto max-w-md p-8 text-center">
        <p className="titulo text-lg">Trivia de cine</p>
        <p className="mt-2 text-sm text-tenue">Inicia sesión para jugar la trivia y ganar créditos.</p>
        <button onClick={() => abrirLogin()} className="btn-vino mt-5">
          Iniciar sesión
        </button>
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
