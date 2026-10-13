"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";

// El inicio de sesión es una ventana emergente; esta ruta sólo existe para enlaces directos.
export default function Login() {
  const router = useRouter();
  const { abrirLogin, usuario } = useApp();
  useEffect(() => {
    router.replace(usuario ? (usuario.rol === "cliente" ? "/" : "/panel") : "/");
    if (!usuario) abrirLogin();
    // Se ejecuta una sola vez al entrar a /login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="py-24 text-center text-sm text-tenue">Abriendo inicio de sesión…</div>;
}
