// Utilidades de seguridad del boleto (prototipo). En producción el backend firma el código (TOTP/HMAC).

export const ROTACION_S = 60; // el código dinámico del QR cambia cada minuto

// Oculta la parte central del token: nunca se muestra completo fuera del visor seguro.
export const enmascarar = (t: string) => `${t.slice(0, 6)}••••••${t.slice(-3)}`;

export const ventanaActual = (ms = Date.now()) => Math.floor(ms / (ROTACION_S * 1000));

// Código de un solo uso derivado del token y la ventana de 60 s.
export function codigoDinamico(token: string, ventana: number) {
  let h = 5381;
  const s = `${token}:${ventana}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(7, "0").slice(-6);
}
