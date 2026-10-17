import { ShieldCheck } from "lucide-react";
import { recaptchaConfigurado } from "@/services/recaptcha";

/**
 * Aviso legal que Google exige cuando se oculta la insignia flotante de reCAPTCHA (ver .grecaptcha-badge en globals.css).
 * Sin clave configurada muestra qué protección queda activa.
 */
export function AvisoRecaptcha() {
  return (
    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-apagado">
      <ShieldCheck aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-arena" />
      {recaptchaConfigurado ? (
        <span>
          Protegido por reCAPTCHA (verificación invisible). Se aplican la{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline hover:text-tinta">
            Política de privacidad
          </a>{" "}
          y los{" "}
          <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline hover:text-tinta">
            Términos del servicio
          </a>{" "}
          de Google.
        </span>
      ) : (
        <span>Protección anti-bots básica activa (reCAPTCHA sin configurar en este entorno).</span>
      )}
    </p>
  );
}
