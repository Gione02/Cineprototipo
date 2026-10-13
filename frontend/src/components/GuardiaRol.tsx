"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";

/**
 * Control de acceso por rol en el frontend (RF-44): el personal interno (administrador, agente operativo y auditor)
 * no compra boletos ni entra a la cola virtual; su espacio de trabajo es el panel de operaciones.
 * En producción el backend aplica la misma regla en cada endpoint.
 */
export function GuardiaRol({ children }: { children: React.ReactNode }) {
  const { usuario } = useApp();
  const ruta = usePathname();
  const router = useRouter();
  const staff = !!usuario && usuario.rol !== "cliente";
  const bloqueada = staff && !ruta.startsWith("/panel");

  useEffect(() => {
    if (bloqueada) router.replace("/panel");
  }, [bloqueada, router]);

  if (bloqueada) return <div className="py-24 text-center text-sm text-tenue">Redirigiendo al panel de operaciones…</div>;
  return <>{children}</>;
}
