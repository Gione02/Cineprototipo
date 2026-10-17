// Google reCAPTCHA v3 (invisible): el navegador obtiene un token con un puntaje de "humanidad" sin que el
// usuario tenga que resolver nada. El token se envía al backend en Go, que lo confirma con Google.
// https://developers.google.com/recaptcha/docs/v3

type Grecaptcha = {
  ready: (cb: () => void) => void;
  execute: (claveSitio: string, opciones: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

/** Clave pública del sitio. Sin ella el prototipo usa sólo el campo trampa y el tiempo mínimo de envío. */
export const CLAVE_SITIO = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";
export const recaptchaConfigurado = CLAVE_SITIO !== "";

/** Acciones que el backend acepta (services.AccionesCaptcha en Go). */
export type AccionCaptcha = "login" | "registro" | "cola";

let carga: Promise<Grecaptcha> | null = null;

/** Inserta el script de Google una sola vez y resuelve cuando está listo. */
export function cargarRecaptcha(): Promise<Grecaptcha> {
  if (!recaptchaConfigurado) return Promise.reject(new Error("reCAPTCHA no configurado"));
  carga ??= new Promise<Grecaptcha>((resolver, rechazar) => {
    const listo = () => window.grecaptcha!.ready(() => resolver(window.grecaptcha!));
    if (window.grecaptcha) return listo();
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(CLAVE_SITIO)}`;
    script.async = true;
    script.onload = listo;
    script.onerror = () => {
      carga = null; // permite reintentar más tarde
      rechazar(new Error("No se pudo cargar reCAPTCHA"));
    };
    document.head.appendChild(script);
  });
  return carga;
}

/** Obtiene un token nuevo para la acción indicada (cada token es de un solo uso y vence a los 2 minutos). */
export async function ejecutarRecaptcha(accion: AccionCaptcha): Promise<string> {
  const g = await cargarRecaptcha();
  return g.execute(CLAVE_SITIO, { action: accion });
}
