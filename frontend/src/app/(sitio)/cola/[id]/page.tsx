"use client";

import { useParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { Armchair, LogIn, LogOut, RotateCcw, Ticket, Users } from "lucide-react";
import { EVENTOS, funcionDelEvento, pelicula } from "@/data/catalogo";
import { PARAMETROS } from "@/data/parametros";
import { useApp } from "@/store/AppProvider";
import type { PosicionColaApi } from "@/types/api";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { otorgarTurno, quitarTurno, turnoVigente } from "@/utils/turnoCola";
import { BotonVolver } from "@/components/ui/BotonVolver";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { AvisoRecaptcha } from "@/components/auth/AvisoRecaptcha";

type Fase = "verificar" | "esperando" | "turno";

/** Cada cuánto consulta su lugar quien espera. El servidor saca de la fila a quien deja de consultar (20 s). */
const CONSULTA_MS = 2500;

/**
 * Cola virtual de un preestreno (RF-36, RF-51): fila en Redis por orden de llegada. El servidor atiende a pocos
 * clientes a la vez, da a cada uno un turno con vencimiento y rechaza bloquear o reservar butacas del preestreno
 * sin turno vigente.
 */
export default function ColaVirtual() {
  const { id } = useParams<{ id: string }>();
  const app = useApp();
  const { usuario, funciones } = app;
  const evento = EVENTOS.find((e) => e.id === id);
  const funcionEvento = evento && funcionDelEvento(funciones, evento.id);
  const [fase, setFase] = useState<Fase>(() => (turnoVigente(id) ? "turno" : "verificar"));
  const { verificar } = useRecaptcha();
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [posicion, setPosicion] = useState(0);
  const [inicial, setInicial] = useState(1);
  const [enCola, setEnCola] = useState(0);
  const [espera, setEspera] = useState(0);
  const [capacidad, setCapacidad] = useState(0);
  const [expira, setExpira] = useState(() => turnoVigente(id));
  const [ahora, setAhora] = useState(() => Date.now());

  // Funciones del store siempre al día sin volver a lanzar los efectos en cada render.
  const appRef = useRef(app);
  useLayoutEffect(() => {
    appRef.current = app;
  });

  // Aplica la respuesta del servidor: turno concedido o lugar en la fila.
  const aplicar = (pos: PosicionColaApi) => {
    setEnCola(pos.en_cola);
    setCapacidad(pos.capacidad);
    if (pos.turno_habilitado && pos.expira) {
      const vence = Date.parse(pos.expira);
      otorgarTurno(id, vence);
      setExpira(vence);
      setFase("turno");
      return;
    }
    setPosicion(pos.posicion);
    setInicial((i) => Math.max(i, pos.posicion));
    setEspera(pos.espera_min);
    setFase("esperando");
  };
  const aplicarRef = useRef(aplicar);
  useLayoutEffect(() => {
    aplicarRef.current = aplicar;
  });

  // Al abrir (o recargar) la página se recupera el lugar o el turno que el usuario ya tenía.
  const correo = usuario?.correo;
  useEffect(() => {
    if (!correo) return;
    let vivo = true;
    appRef.current.colaConsultar(id).then((r) => {
      if (vivo && r.ok && r.pos) aplicarRef.current(r.pos);
    });
    return () => {
      vivo = false;
    };
  }, [correo, id]);

  // Mientras espera, consulta su lugar (y así conserva su posición en la fila).
  useEffect(() => {
    if (fase !== "esperando") return;
    let vivo = true;
    const t = setInterval(async () => {
      const r = await appRef.current.colaConsultar(id);
      if (!vivo) return;
      if (r.ok && r.pos) aplicarRef.current(r.pos);
      else if (r.fuera) {
        setFase("verificar");
        setAviso("Perdiste tu lugar en la cola. Vuelve a ingresar.");
      }
    }, CONSULTA_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [fase, id]);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!evento || !funcionEvento) return <p className="text-tenue">No hay un preestreno con cola virtual disponible en este momento.</p>;

  // Verificación anti-bots invisible (reCAPTCHA v3) antes de tomar un lugar en la cola (RF-53).
  const entrar = async () => {
    setVerificando(true);
    setAviso("");
    const r = await verificar("cola");
    if (!r.ok) {
      setVerificando(false);
      return setAviso(r.error!);
    }
    const res = await app.colaEntrar(id);
    setVerificando(false);
    if (!res.ok || !res.pos) return setAviso(res.error ?? "No se pudo ingresar a la cola.");
    setInicial(res.pos.posicion || 1);
    aplicar(res.pos);
  };

  const abandonar = () => {
    app.colaSalir(id);
    quitarTurno(id);
    setExpira(0);
    setFase("verificar");
  };

  const restanteTurno = Math.max(0, expira - ahora);
  const minutosEspera = Math.max(1, espera);

  return (
    <div className="mx-auto max-w-2xl">
      <BotonVolver href={`/pelicula/${pelicula(funcionEvento.peliculaId).id}`} texto="Volver a la película" />
      <div className="mt-6 flex flex-wrap gap-2">
        <span className="badge-vino">★ Preestreno · Cola virtual</span>
        <span className="badge-borde">Límite {evento.limitePorCliente} boletos por cliente</span>
      </div>
      <h1 className="titulo mt-3 text-4xl leading-tight">{evento.nombre}</h1>
      <p className="mt-2 text-sm text-tenue">
        La demanda supera la capacidad de atención simultánea. Te atenderemos por orden de llegada. No cierres esta ventana: si la abandonas,
        pierdes tu posición.
      </p>

      <div className="mt-6 rounded-xl border border-rojo/40 bg-gradient-to-br from-panel via-panel to-vino/40 p-6 sm:p-8">
        {!usuario && (
          <div className="text-center">
            <p className="titulo text-2xl">Inicia sesión para entrar a la cola</p>
            <p className="mt-2 text-sm text-tenue">Necesitas una cuenta de cliente. Al iniciar sesión seguirás aquí mismo.</p>
            <Boton icono={LogIn} onClick={() => app.abrirLogin()} className="mt-5">
              Iniciar sesión
            </Boton>
          </div>
        )}
        {usuario && fase === "verificar" && (
          <div className="space-y-4">
            <p className="etiqueta text-salmon">Verificación de persona (RF-53)</p>
            <p className="text-sm text-tenue">La verificación es automática e invisible: no tienes que marcar casillas ni resolver retos.</p>
            <p className="text-xs text-tenue">
              Límite: {PARAMETROS.limiteSolicitudesMin} solicitudes por minuto por cliente y por IP. Los intentos bloqueados quedan registrados.
            </p>
            {aviso && <p className="rounded-md border border-rojo/60 bg-vino/50 p-2.5 text-sm text-salmon">{aviso}</p>}
            <Boton icono={Users} tamano="lg" cargando={verificando} onClick={entrar} className="w-full">
              {verificando ? "Verificando…" : "Ingresar a la cola"}
            </Boton>
            <AvisoRecaptcha />
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
              <m.div className="h-full bg-rojo" animate={{ width: `${Math.max(4, (1 - (posicion - 1) / Math.max(inicial, 1)) * 100)}%` }} />
            </div>
            <p className="etiqueta mt-4">
              {enCola.toLocaleString("es-GT")} {enCola === 1 ? "persona" : "personas"} en la cola · se actualiza automáticamente
            </p>
            {capacidad > 0 && (
              <p className="mt-2 text-xs text-tenue">
                Atendemos a {capacidad} {capacidad === 1 ? "cliente" : "clientes"} a la vez; cada turno dura {PARAMETROS.turnoColaMinutos} minutos.
              </p>
            )}
            <Boton variante="fantasma" tamano="sm" icono={LogOut} onClick={abandonar} className="mt-4">
              Salir de la cola
            </Boton>
          </div>
        )}

        {usuario && fase === "turno" && (
          <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl border border-oro/50 bg-oro/10 text-oro">
              <Ticket aria-hidden className="h-8 w-8" />
            </div>
            <h2 className="titulo mt-3 text-3xl">¡Es tu turno!</h2>
            <p className="mt-2 text-sm text-tenue">
              Tienes{" "}
              <b className="text-lg font-black text-oro tabular-nums">
                {Math.floor(restanteTurno / 60000)}:{String(Math.floor((restanteTurno % 60000) / 1000)).padStart(2, "0")}
              </b>{" "}
              para seleccionar tus asientos. Si no lo aprovechas, el turno pasa al siguiente cliente.
            </p>
            {restanteTurno > 0 ? (
              <BotonEnlace href={`/funcion/${funcionEvento.id}`} icono={Armchair} className="mt-5">
                Seleccionar asientos
              </BotonEnlace>
            ) : (
              <Boton variante="borde" icono={RotateCcw} onClick={abandonar} className="mt-5">
                Turno vencido · volver a la cola
              </Boton>
            )}
          </m.div>
        )}
      </div>
    </div>
  );
}
