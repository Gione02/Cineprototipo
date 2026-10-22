// Preparación del póster en el navegador antes de enviarlo: se valida el tipo, se reduce a 500 × 750 px
// como máximo y se comprime en JPEG. Así la imagen pesa decenas de KB (viaja rápido a la API
// y viaja rápido a la API, que acepta hasta 2 MB).

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_ORIGINAL = 10 * 1024 * 1024; // 10 MB antes de comprimir
const ANCHO = 500;
const ALTO = 750;

/** Convierte un archivo de imagen en un data URL JPEG listo para guardar. Lanza un Error con mensaje para el usuario. */
export async function prepararPoster(archivo: File): Promise<string> {
  if (!TIPOS.includes(archivo.type)) throw new Error("El póster debe ser JPG, PNG o WebP.");
  if (archivo.size > MAX_ORIGINAL) throw new Error("La imagen pesa más de 10 MB.");
  const bitmap = await createImageBitmap(archivo).catch(() => {
    throw new Error("No se pudo leer la imagen.");
  });
  const escala = Math.min(1, ANCHO / bitmap.width, ALTO / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b0b0d"; // fondo para PNG con transparencia
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Los pósters propios (/posters/…) se optimizan con next/image; los subidos (data: o de la API) se muestran tal cual. */
export const posterSinOptimizar = (src: string) => !src.startsWith("/");
