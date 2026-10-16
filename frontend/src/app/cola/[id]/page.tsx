"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { EVENTOS, PARAMETROS, funcionesBase, pelicula } from "@/lib/data";
import { BotonVolver } from "@/components/BotonVolver";

const funcionDe = (id: string) => funcionesBase().find((f) => f.id === id)!.peliculaId;
import { useApp } from "@/lib/store";
import { otorgarTurno, turnoVigente } from "@/lib/cola";

type Fase = "verificar" | "esperando" | "turno";

export default function ColaVirtual() {
  const { id } = useParams<{ id: string }>();
  const { usuario, registrar, abrirLogin } = useApp();
  const evento = EVENTOS.find((e) => e.id === id);
  const [fase, setFase] = useState<Fase>(() => (turnoVigente(id) ? "turno" : "verificar"));
  const [humano, setHumano] = useState(false);
  const [posicion, setPosicion] = useState(0);
  const [inicial, setInicial] = useState(1);
  const [enCola, setEnCola] = useState(1800);
  const [expira, setExpira] = useState(() => turnoVigente(id));
  const [ahora, setAhora] = useState(() => Date.now());

  // Avance simulado de la cola (en producción: posición vía ZRANK en Redis, push por SSE)
  useEffect(() => {
    if (fase !== "esperando") return;
    const t = setInterval(() => {
      setPosicion((p) => {
        const n = Math.max(0, p - Math.ceil(Math.random() * 9 + 3));
        if (n === 0) {
          otorgarTurno(id);
          setExpira(turnoVigente(id));
          setFase("turno");
        }
        return n;
      });
      setEnCola((c) => c + Math.round(Math.random() * 30 - 8));
    }, 700);
    return () => clearInterval(t);
  }, [fase, id]);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!evento) return <p className="text-tenue">Preestreno no encontrado.</p>;

  const entrar = () => {
    const pos = 120 + Math.floor(Math.random() * 160);
    setPosicion(pos);
    setInicial(pos);
    setFase("esperando");
    registrar("COLA_INGRESO", `${evento.id} · posición ${pos}`);
  };

  const restanteTurno = Math.max(0, expira - ahora);
  const minutosEspera = Math.max(1, Math.ceil(posicion / 60));

  return (
    <div className="mx-auto max-w-2xl">
      <BotonVolver href={`/pelicula/${pelicula(funcionDe(evento.funcionId)).id}`} texto="Volver a la película" />
      <div className="mt-6 flex flex-wrap gap-2">
        <span className="badge-vino">★ Preestreno · Cola virtual</span>
        <span className="badge-borde">Límite {evento.limitePorCliente} boletos por cliente</span>
      </div>
      <h1 className="titulo mt-3 text-3xl leading-tight">{evento.nombre}</h1>
      <p className="mt-2 text-sm text-tenue">
        La demanda supera la capacidad de atención simultánea. Te atenderemos por orden de llegada. No cierres esta ventana: si la abandonas,
        pierdes tu posición.
      </p>

      <div className="mt-6 rounded-xl border border-rojo/40 bg-gradient-to-br from-panel via-panel to-vino/40 p-6 sm:p-8">
        {!usuario && (
          <div className="text-center">
            <p className="titulo text-lg">Inicia sesión para entrar a la cola</p>
            <p className="mt-2 text-sm text-tenue">Necesitas una cuenta de cliente. Al iniciar sesión seguirás aquí mismo.</p>
            <button onClick={() => abrirLogin()} className="btn-vino mt-5">
              Iniciar sesión
            </button>
          </div>
        )}
        {usuario && fase === "verificar" && (
          <div className="space-y-4">
            <p className="etiqueta text-salmon">Verificación de persona (RF-53)</p>
            <label className="flex w-fit cursor-pointer items-center gap-3 rounded-md border border-borde bg-fondo px-4 py-3">
              <input type="checkbox" checked={humano} onChange={(e) => setHumano(e.target.checked)} className="h-5 w-5 accent-[#c8372d]" />
              <span className="text-sm font-semibold">No soy un robot</span>
              <span className="etiqueta ml-6">anti-bots</span>
            </label>
            <p className="text-xs text-tenue">
              Límite: {PARAMETROS.limiteSolicitudesMin} solicitudes por minuto por cliente y por IP. Los intentos bloqueados quedan registrados.
            </p>
            <button disabled={!humano} onClick={entrar} className="btn-vino w-full py-3.5">
              Ingresar a la cola
            </button>
          </div>
        )}

        {usuario && fase === "esperando" && (
          <div className="text-center">
            <p className="etiqueta">Tu posición</p>
            <m.p key={posicion} initial={{ scale: 1.15, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className="mt-1 text-7xl font-black tabular-nums">
              {posicion}
            </m.p>
            <p className="mt-1 text-sm text-tenue">
              Tiempo estimado: <b className="text-oro">~{minutosEspera} min</b>
            </p>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-fondo">
              <m.div className="h-full bg-rojo" animate={{ width: `${(1 - posicion / inicial) * 100}%` }} />
            </div>
            <p className="etiqueta mt-4">{enCola.toLocaleString("es-GT")} personas en la cola · se actualiza automáticamente</p>
          </div>
        )}

        {usuario && fase === "turno" && (
          <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl border border-oro/50 bg-oro/10 text-3xl">🎟️</div>
            <h2 className="titulo mt-3 text-2xl">¡Es tu turno!</h2>
            <p className="mt-2 text-sm text-tenue">
              Tienes{" "}
              <b className="text-lg font-black text-oro tabular-nums">
                {Math.floor(restanteTurno / 60000)}:{String(Math.floor((restanteTurno % 60000) / 1000)).padStart(2, "0")}
              </b>{" "}
              para seleccionar tus asientos. Si no lo aprovechas, el turno pasa al siguiente cliente.
            </p>
            {restanteTurno > 0 ? (
              <Link href={`/funcion/${evento.funcionId}`} className="btn-vino mt-5">
                ♟ Seleccionar asientos →
              </Link>
            ) : (
              <button onClick={() => setFase("verificar")} className="btn-borde mt-5">
                Turno vencido · volver a la cola
              </button>
            )}
          </m.div>
        )}
      </div>
    </div>
  );
}
