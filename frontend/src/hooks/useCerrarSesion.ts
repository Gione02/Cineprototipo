"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/store/AppProvider";

/**
 * Cierra la sesión (limpia usuario, reserva, sesión con la API y turnos de cola) y lleva a la cartelera.
 * `replace` evita que el botón "atrás" regrese a una página que requería sesión.
 */
export function useCerrarSesion() {
  const { logout } = useApp();
  const router = useRouter();
  return useCallback(() => {
    logout();
    router.replace("/");
  }, [logout, router]);
}
