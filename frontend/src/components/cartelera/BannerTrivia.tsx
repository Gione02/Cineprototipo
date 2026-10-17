"use client";

import { Clapperboard, Gamepad2, LogIn } from "lucide-react";
import { PARAMETROS } from "@/data/parametros";
import { useApp } from "@/store/AppProvider";
import { Boton } from "@/components/ui/Boton";

/** Invitación a la trivia para ganar créditos. */
export function BannerTrivia() {
  const { usuario, abrirLogin, abrirTrivia } = useApp();
  return (
    <section className="relative overflow-hidden rounded-xl border border-rojo/40 bg-gradient-to-r from-panel via-panel to-vino/60 p-6 sm:p-8">
      <div className="grid items-center gap-6 md:grid-cols-[auto_1fr_auto]">
        <span className="grid h-14 w-14 place-items-center rounded-lg border border-rojo/50 bg-vino text-salmon">
          <Clapperboard aria-hidden className="h-7 w-7" />
        </span>
        <div>
          <p className="etiqueta text-salmon">Trivia de cine · {PARAMETROS.preguntasTrivia} preguntas</p>
          <h2 className="titulo mt-1 text-xl sm:text-2xl">¿Te faltan créditos para el próximo estreno?</h2>
          <p className="mt-1 text-sm text-tenue">
            Responde la trivia y gana {PARAMETROS.creditosPorRespuesta} créditos por acierto, o <b className="text-oro">{PARAMETROS.bonoTriviaPerfecta} créditos</b> si
            aciertas todas. Accede tocando <b className="text-oro">tus créditos</b> en la parte superior.
          </p>
        </div>
        {usuario ? (
          <Boton icono={Gamepad2} onClick={abrirTrivia}>
            Jugar trivia
          </Boton>
        ) : (
          <Boton icono={LogIn} onClick={() => abrirLogin()}>
            Inicia sesión para jugar
          </Boton>
        )}
      </div>
    </section>
  );
}
