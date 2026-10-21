// Validación de datos de cuentas (registro, inicio de sesión y gestión de usuarios).
// Cada función devuelve null si el dato es válido, o el mensaje que se muestra junto al campo.
// El backend en Go aplica las mismas reglas (internal/domain/validacion.go).

// ───────── Nombre ─────────

/** Letras de cualquier idioma (incluye tildes y ñ), separadas por un espacio, guion o apóstrofo. */
const PATRON_NOMBRE = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;

export const NOMBRE_MAX = 60;

/** Quita espacios sobrantes: "  ana   lópez " → "ana lópez". */
export const normalizarNombre = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * Nombre de una persona: sólo letras (con tildes y ñ), espacios, guiones o apóstrofos (O'Connor, Pérez-Gómez).
 * Sin números ni símbolos, y con al menos nombre y apellido si `completo` es true.
 */
export function validarNombre(valor: string, { completo = true } = {}): string | null {
  const n = normalizarNombre(valor);
  if (!n) return "Escribe tu nombre.";
  if (/\d/.test(n)) return "El nombre no puede contener números.";
  if (!PATRON_NOMBRE.test(n)) return "Usa sólo letras y espacios (se permiten tildes, ñ, guion y apóstrofo).";
  if (n.length > NOMBRE_MAX) return `El nombre admite hasta ${NOMBRE_MAX} caracteres.`;
  const palabras = n.split(/[ ]/);
  if (palabras.some((p) => p.replace(/['’-]/g, "").length < 2)) return "Cada nombre o apellido debe tener al menos 2 letras.";
  if (completo && palabras.length < 2) return "Escribe tu nombre y apellido.";
  if (/(\p{L})\1\1/iu.test(n)) return "El nombre tiene letras repetidas de más.";
  return null;
}

// ───────── Correo ─────────

export const CORREO_MAX = 254;

/**
 * Formato práctico (RFC 5321 simplificado): usuario con letras, números y . _ % + -, sin puntos al inicio, al final ni
 * seguidos; dominio con etiquetas válidas y extensión de 2 a 24 letras.
 */
const PATRON_CORREO = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/** Errores de tipeo frecuentes en los dominios más usados. */
const DOMINIOS_CORREGIDOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com", "gmaill.com": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotmail.con": "hotmail.com",
  "hotamil.com": "hotmail.com", "outlok.com": "outlook.com", "outllok.com": "outlook.com", "outlook.co": "outlook.com", "outlook.con": "outlook.com",
  "yaho.com": "yahoo.com", "yahoo.co": "yahoo.com", "yahoo.con": "yahoo.com", "yhoo.com": "yahoo.com", "iclud.com": "icloud.com", "icloud.co": "icloud.com",
};

/** Dominios de correo temporal o reservados para ejemplos: no sirven para recibir boletos ni recuperar la cuenta. */
const DOMINIOS_NO_VALIDOS = new Set([
  "mailinator.com", "yopmail.com", "10minutemail.com", "guerrillamail.com", "sharklasers.com", "tempmail.com", "temp-mail.org",
  "trashmail.com", "getnada.com", "dispostable.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mintemail.com",
  "example.com", "example.org", "example.net", "test.com", "prueba.com", "correo.test", "localhost.com",
]);

/** Normaliza el correo (sin espacios, en minúsculas). */
export const normalizarCorreo = (s: string) => s.trim().toLowerCase();

/**
 * Valida el correo. En el registro (`estricto`) además rechaza dominios temporales/de ejemplo y sugiere la corrección
 * de errores de tipeo comunes ("gmial.com" → "gmail.com").
 */
export function validarCorreo(valor: string, { estricto = true } = {}): string | null {
  const c = normalizarCorreo(valor);
  if (!c) return "Escribe tu correo electrónico.";
  if (/\s/.test(c)) return "El correo no puede tener espacios.";
  if (c.length > CORREO_MAX) return "El correo es demasiado largo.";
  if ((c.match(/@/g) ?? []).length !== 1) return "El correo debe tener un solo «@». Ejemplo: nombre@dominio.com";
  if (c.includes("..")) return "El correo no puede tener dos puntos seguidos.";
  if (!PATRON_CORREO.test(c)) return "Correo no válido. Ejemplo: nombre@dominio.com";
  if (!estricto) return null;
  const [usuario, dominio] = c.split("@");
  if (DOMINIOS_CORREGIDOS[dominio]) return `¿Quisiste decir ${usuario}@${DOMINIOS_CORREGIDOS[dominio]}?`;
  if (DOMINIOS_NO_VALIDOS.has(dominio)) return "Usa un correo real: no se aceptan correos temporales ni de ejemplo.";
  return null;
}

// ───────── Contraseña ─────────

export const CLAVE_MIN = 8;
export const CLAVE_MAX = 72; // límite de bcrypt

const CLAVES_COMUNES = new Set(["12345678", "123456789", "1234567890", "password", "password1", "contraseña", "contrasena", "qwerty123", "abc12345", "11111111", "00000000", "iloveyou1", "admin123"]);

/** Requisitos de una contraseña nueva, para mostrarlos como lista a medida que se escribe. */
export function requisitosClave(clave: string, correo = "") {
  // Se comparan sólo letras y números: "analopez2026" contiene el usuario de "ana.lopez@…".
  const limpiar = (t: string) => t.toLowerCase().replace(/[^\p{L}\d]/gu, "");
  const usuario = limpiar(normalizarCorreo(correo).split("@")[0]);
  return [
    { ok: clave.length >= CLAVE_MIN && clave.length <= CLAVE_MAX, texto: `Entre ${CLAVE_MIN} y ${CLAVE_MAX} caracteres` },
    { ok: /\p{L}/u.test(clave) && /\d/.test(clave), texto: "Letras y al menos un número" },
    { ok: clave.trim() === clave && clave !== "", texto: "Sin espacios al inicio ni al final" },
    { ok: clave !== "" && !CLAVES_COMUNES.has(clave.toLowerCase()) && !(usuario.length >= 4 && limpiar(clave).includes(usuario)), texto: "Que no sea común ni contenga tu correo" },
  ];
}

/** Contraseña nueva (registro o contraseña temporal creada por el administrador). */
export function validarClaveNueva(clave: string, correo = ""): string | null {
  if (!clave) return "Crea una contraseña.";
  const fallo = requisitosClave(clave, correo).find((r) => !r.ok);
  return fallo ? `La contraseña no cumple: ${fallo.texto.toLowerCase()}.` : null;
}

/** Contraseña al iniciar sesión: sólo se comprueba que exista (no se revelan las reglas de las cuentas). */
export function validarClaveLogin(clave: string): string | null {
  if (!clave) return "Escribe tu contraseña.";
  if (clave.length > CLAVE_MAX) return "Contraseña demasiado larga.";
  return null;
}
