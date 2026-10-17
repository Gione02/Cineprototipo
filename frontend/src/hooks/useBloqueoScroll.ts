"use client";

import { useEffect } from "react";

// Bloqueo de scroll compartido por todas las ventanas emergentes.
//
// Antes, cada Modal guardaba el `overflow` que había al abrirse y lo restauraba al cerrarse.
// Con dos ventanas abiertas que se cierran en distinto orden (aviso de sesión + login, compra + alerta),
// la última en cerrarse restauraba "hidden" y la página quedaba sin scroll.
// Ahora se cuentan las ventanas abiertas y el scroll se libera cuando se cierra la última.
let abiertas = 0;

function aplicar() {
  if (typeof document === "undefined") return;
  if (abiertas > 0) document.body.style.overflow = "hidden";
  else document.body.style.removeProperty("overflow");
}

export function useBloqueoScroll(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    abiertas++;
    aplicar();
    // La limpieza corre al cerrar la ventana y también si el componente se desmonta abierto
    // (cambio de ruta, cierre de sesión, la página que la contiene deja de existir).
    return () => {
      abiertas = Math.max(0, abiertas - 1);
      aplicar();
    };
  }, [activo]);
}

// Red de seguridad para cambios de ruta: si no queda ninguna ventana abierta, el scroll se libera.
export function restablecerScroll() {
  if (abiertas === 0) aplicar();
}
