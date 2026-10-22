"use client";

import { KeyRound, Lock, LockOpen, Pencil, RotateCcw, Save, Trash2, UserPlus } from "lucide-react";
import { Boton } from "@/components/ui/Boton";
import { useState } from "react";
import { ROL_TXT } from "@/data/catalogo";
import type { Rol } from "@/types/catalogo";
import { useApp } from "@/store/AppProvider";
import { Modal } from "@/components/ui/Modal";
import { card, thCls } from "@/components/panel/Elementos";

/* ─────────── Usuarios: crear, editar y dar de baja (RF-15, RF-44) ─────────── */
type AccionUsuario = { tipo: "crear" } | { tipo: "editar"; correo: string } | { tipo: "estado"; correo: string; activo: boolean };

const PERMISOS: [Rol, string][] = [
  ["cliente", "Cartelera, compra con créditos, Mis Entradas y trivia."],
  ["agente", "Programación de funciones, inventario de salas y validación de accesos."],
  ["admin", "Control total: métricas, gestión de usuarios y roles, parámetros, reportes y bitácora."],
  ["auditor", "Sólo lectura de reportes y bitácora; no puede modificar información."],
];

export function Usuarios() {
  const { cuentas, usuario, adminVerificado, verificarAdmin, crearUsuario, editarUsuario, cambiarEstadoUsuario, toast } = useApp();
  const [filtro, setFiltro] = useState<Rol | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [pendiente, setPendiente] = useState<AccionUsuario | null>(null); // acción que espera la reautenticación
  const [accion, setAccion] = useState<AccionUsuario | null>(null);
  const [clave, setClave] = useState("");
  const [errorClave, setErrorClave] = useState("");
  const [intentos, setIntentos] = useState(0);
  const [form, setForm] = useState({ nombre: "", correo: "", rol: "agente" as Rol, clave: "" });
  const [errorForm, setErrorForm] = useState("");

  const abrir = (a: AccionUsuario) => {
    setErrorForm("");
    if (a.tipo === "crear") setForm({ nombre: "", correo: "", rol: "agente", clave: "" });
    if (a.tipo === "editar") setForm({ nombre: cuentas[a.correo].nombre, correo: a.correo, rol: cuentas[a.correo].rol, clave: "" });
    if (adminVerificado) setAccion(a);
    else {
      setClave("");
      setErrorClave("");
      setPendiente(a);
    }
  };

  const confirmarIdentidad = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificarAdmin(clave)) {
      setAccion(pendiente);
      setPendiente(null);
      setIntentos(0);
      return;
    }
    const n = intentos + 1;
    setIntentos(n);
    setClave("");
    if (n >= 3) {
      setPendiente(null);
      setIntentos(0);
      toast("Demasiados intentos fallidos. La acción fue cancelada y quedó registrada en la bitácora.", "error");
    } else setErrorClave(`Contraseña incorrecta. Te quedan ${3 - n} intento(s).`);
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accion) return;
    const r =
      accion.tipo === "crear"
        ? crearUsuario(form)
        : accion.tipo === "editar"
          ? editarUsuario(accion.correo, { nombre: form.nombre, rol: form.rol })
          : cambiarEstadoUsuario(accion.correo, accion.activo);
    if (!r.ok) return setErrorForm(r.error!);
    toast(
      accion.tipo === "crear"
        ? `Cuenta creada para ${form.correo} (${ROL_TXT[form.rol]}).`
        : accion.tipo === "editar"
          ? "Cambios guardados."
          : accion.activo
            ? "Cuenta reactivada."
            : "Cuenta dada de baja. Su historial se conserva.",
      "ok",
    );
    setAccion(null);
  };

  const filas = Object.entries(cuentas)
    .filter(([c, x]) => (filtro === "todos" || x.rol === filtro) && (c + x.nombre).toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => Number(b[1].activo) - Number(a[1].activo) || a[1].rol.localeCompare(b[1].rol));
  const objetivo = accion && accion.tipo !== "crear" ? cuentas[accion.correo] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["todos", "cliente", "agente", "admin", "auditor"] as const).map((r) => (
          <button key={r} onClick={() => setFiltro(r)} className={`chip ${filtro === r ? "!border-oro text-oro" : ""}`}>
            {r === "todos" ? "Todos" : ROL_TXT[r]} <span className="text-tenue">{r === "todos" ? Object.keys(cuentas).length : Object.values(cuentas).filter((x) => x.rol === r).length}</span>
          </button>
        ))}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre o correo…" className="campo !mt-0 w-full sm:ml-auto sm:w-64" />
        <Boton icono={UserPlus} onClick={() => abrir({ tipo: "crear" })} className="w-full sm:w-auto">
          Nuevo usuario
        </Boton>
      </div>

      <p className={`flex items-center gap-2 text-xs ${adminVerificado ? "text-oro" : "text-tenue"}`}>
        {adminVerificado ? <LockOpen aria-hidden className="h-4 w-4 shrink-0" /> : <Lock aria-hidden className="h-4 w-4 shrink-0" />}
        {adminVerificado
          ? "Identidad de administrador verificada: puedes gestionar usuarios durante 5 minutos."
          : "Por seguridad, crear, editar o dar de baja usuarios exige reconfirmar tu contraseña de administrador."}
      </p>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-borde">
            <tr>
              <th className={thCls}>Usuario</th>
              <th className={thCls}>Rol</th>
              <th className={thCls}>Estado</th>
              <th className={thCls}>Alta</th>
              <th className={`${thCls} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(([correo, c]) => {
              const yo = correo === usuario?.correo;
              return (
                <tr key={correo} className={`border-b border-borde/60 last:border-0 ${c.activo ? "" : "opacity-55"}`}>
                  <td className="py-3 pr-3">
                    <p className="font-bold">
                      {c.nombre} {yo && <span className="badge-borde ml-1">Tú</span>}
                    </p>
                    <p className="text-[11px] text-tenue">{correo}</p>
                  </td>
                  <td className="pr-3">
                    <span className={c.rol === "cliente" ? "badge-borde" : "badge-vino"}>{ROL_TXT[c.rol]}</span>
                  </td>
                  <td className="pr-3 text-xs font-bold">{c.activo ? <span className="text-oro">● Activo</span> : <span className="text-salmon">● Dado de baja</span>}</td>
                  <td className="pr-3 text-xs text-tenue">{new Date(c.creado).toLocaleDateString("es-GT")}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Boton variante="borde" tamano="sm" icono={Pencil} onClick={() => abrir({ tipo: "editar", correo })} disabled={!c.activo}>
                        Editar
                      </Boton>
                      {c.activo ? (
                        <button onClick={() => abrir({ tipo: "estado", correo, activo: false })} disabled={yo} title={yo ? "No puedes darte de baja a ti mismo" : ""} className="btn-borde px-3 py-2 text-[10px] hover:!border-rojo hover:!text-salmon">
                          <Trash2 aria-hidden className="h-3.5 w-3.5" /> Eliminar
                        </button>
                      ) : (
                        <button onClick={() => abrir({ tipo: "estado", correo, activo: true })} className="btn-borde px-3 py-2 text-[10px]">
                          <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Reactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filas.length === 0 && <p className="py-6 text-center text-sm text-tenue">No hay usuarios con ese filtro.</p>}
      </div>

      <div className={card}>
        <p className="etiqueta text-oro">Permisos por rol (control de acceso basado en roles, RF-44)</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PERMISOS.map(([r, t]) => (
            <div key={r} className="rounded-md border border-borde bg-fondo p-3">
              <span className={r === "cliente" ? "badge-borde" : "badge-vino"}>{ROL_TXT[r]}</span>
              <p className="mt-2 text-xs text-tenue">{t}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-apagado">
          Reglas: sólo el Administrador del Sistema gestiona usuarios; no puede cambiar su propio rol ni darse de baja; siempre debe quedar al menos un administrador activo. Las
          cuentas eliminadas se dan de baja (no pueden iniciar sesión) y su historial se conserva para auditoría.
        </p>
      </div>

      {/* Reautenticación del administrador */}
      <Modal abierto={!!pendiente} onCerrar={() => setPendiente(null)} titulo="Confirma tu identidad" z="z-[55]">
        <form onSubmit={confirmarIdentidad} className="space-y-3">
          <p className="text-sm text-tenue">
            Para gestionar usuarios y roles vuelve a ingresar la contraseña de <b className="text-tinta">{usuario?.correo}</b>. La verificación dura 5 minutos.
          </p>
          <input type="password" autoFocus value={clave} onChange={(e) => { setClave(e.target.value); setErrorClave(""); }} placeholder="Contraseña de administrador" autoComplete="current-password" className="campo" />
          {errorClave && <p className="text-sm text-salmon">{errorClave}</p>}
          <Boton type="submit" icono={KeyRound} tamano="lg" className="w-full">
            Verificar y continuar
          </Boton>
        </form>
      </Modal>

      {/* Crear / editar */}
      <Modal abierto={accion?.tipo === "crear" || accion?.tipo === "editar"} onCerrar={() => setAccion(null)} titulo={accion?.tipo === "crear" ? "Nuevo usuario" : "Editar usuario"}>
        <form onSubmit={guardar} className="space-y-4">
          <label className="etiqueta block">
            Nombre completo
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="campo normal-case tracking-normal" />
          </label>
          <label className="etiqueta block">
            Correo electrónico
            <input
              type="email"
              value={form.correo}
              disabled={accion?.tipo === "editar"}
              onChange={(e) => setForm({ ...form, correo: e.target.value })}
              className="campo normal-case tracking-normal disabled:opacity-60"
            />
          </label>
          <label className="etiqueta block">
            Rol
            <select
              value={form.rol}
              disabled={accion?.tipo === "editar" && accion.correo === usuario?.correo}
              onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
              className="campo normal-case tracking-normal disabled:opacity-60"
            >
              {(["agente", "auditor", "admin", "cliente"] as Rol[]).map((r) => (
                <option key={r} value={r}>
                  {ROL_TXT[r]}
                </option>
              ))}
            </select>
          </label>
          <p className="-mt-2 text-[11px] text-tenue">{PERMISOS.find(([r]) => r === form.rol)?.[1]}</p>
          {accion?.tipo === "crear" && (
            <label className="etiqueta block">
              Contraseña temporal (mín. 8 caracteres)
              <input type="password" value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} autoComplete="new-password" className="campo" />
            </label>
          )}
          {errorForm && <p className="rounded-md border border-rojo/60 bg-vino/50 p-2.5 text-sm text-salmon">{errorForm}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAccion(null)} className="btn-borde flex-1">
              Cancelar
            </button>
            <Boton type="submit" icono={accion?.tipo === "crear" ? UserPlus : Save} className="flex-1">
              {accion?.tipo === "crear" ? "Crear cuenta" : "Guardar cambios"}
            </Boton>
          </div>
        </form>
      </Modal>

      {/* Dar de baja / reactivar */}
      <Modal abierto={accion?.tipo === "estado"} onCerrar={() => setAccion(null)} titulo={accion?.tipo === "estado" && accion.activo ? "¿Reactivar la cuenta?" : "¿Eliminar la cuenta?"}>
        {objetivo && accion?.tipo === "estado" && (
          <form onSubmit={guardar}>
            <p className="text-sm text-tenue">
              {accion.activo ? (
                <>
                  <b className="text-tinta">{objetivo.nombre}</b> podrá volver a iniciar sesión con su rol de {ROL_TXT[objetivo.rol]}.
                </>
              ) : (
                <>
                  <b className="text-tinta">{objetivo.nombre}</b> ({accion.correo}) ya no podrá iniciar sesión. Su historial de compras y operaciones se conserva para
                  auditoría.
                </>
              )}
            </p>
            {errorForm && <p className="mt-3 rounded-md border border-rojo/60 bg-vino/50 p-2.5 text-sm text-salmon">{errorForm}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setAccion(null)} className="btn-borde flex-1">
                Cancelar
              </button>
              <Boton type="submit" icono={accion.activo ? RotateCcw : Trash2} className="flex-1">
                {accion.activo ? "Reactivar" : "Sí, eliminar"}
              </Boton>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
