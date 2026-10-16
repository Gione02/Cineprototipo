"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { m } from "framer-motion";
import { FILAS, PARAMETROS, etiqueta, fmtDuracion, fmtFechaLarga, fmtHora, pelicula, sala, finFuncion } from "@/lib/data";
import { useApp, type Boleto } from "@/lib/store";
import { Poster } from "@/components/Poster";
import { GrupoBoletos } from "@/components/Boleto";
import { Modal } from "@/components/Modal";
import { BotonVolver } from "@/components/BotonVolver";
import { turnoVigente } from "@/lib/cola";

type Alerta = { titulo: string; texto: string };


export default function PaginaFuncion() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const app = useApp();
  const { funciones, ocupacion, cargarOcupacion, usuario, reserva, saldo, listo } = app;
  const f = funciones.find((x) => x.id === id);
  const [sel, setSel] = useState<string[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [errorPago, setErrorPago] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [emitidos, setEmitidos] = useState<Boleto[] | null>(null);

  // Con la API: estado real de las butacas (vendidas en PostgreSQL + retenidas en Redis), refrescado cada 5 s.
  const fid = f?.id;
  useEffect(() => {
    if (!fid) return;
    cargarOcupacion([fid]);
    const t = setInterval(() => cargarOcupacion([fid]), 5000);
    return () => clearInterval(t);
  }, [fid, cargarOcupacion]);

  if (!f)
    return (
      <div className="space-y-4">
        <BotonVolver />
        <p className="text-tenue">La función no existe.</p>
      </div>
    );
  const p = pelicula(f.peliculaId);
  const s = sala(f.salaId);
  const occ = ocupacion(f.id);
  const PASILLOS = new Set(s.pasillos);
  const miReserva = reserva?.funcionId === f.id ? reserva : null;
  const asientosResumen = miReserva?.asientos ?? sel;
  const total = asientosResumen.length * f.precio;
  const sinTurno = listo && f.eventoId && !turnoVigente(f.eventoId) && !miReserva && !emitidos;

  const toggle = (a: string) => {
    if (miReserva) return setCheckout(true);
    if (!sel.includes(a) && sel.length >= PARAMETROS.maxButacasPorTransaccion)
      return setAlerta({ titulo: "Límite de butacas", texto: `Puedes seleccionar hasta ${PARAMETROS.maxButacasPorTransaccion} butacas por compra.` });
    setSel((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]));
  };

  const reservar = async () => {
    if (!usuario) return app.abrirLogin();
    if (procesando) return;
    setProcesando(true);
    const r = await app.reservar(f.id, sel);
    setProcesando(false);
    if (!r.ok) {
      setAlerta({ titulo: "No pudimos reservar", texto: r.error! });
      if (r.error!.includes("Otro cliente") || r.error!.includes("ya no está") || r.error!.includes("vendido")) setSel([]);
      return;
    }
    setSel([]);
    setErrorPago("");
    setCheckout(true);
  };

  const confirmar = () => {
    const r = app.retenerCreditos();
    setErrorPago(r.ok ? "" : r.error!);
  };

  const pagar = async () => {
    if (procesando) return;
    setProcesando(true);
    const r = await app.pagar();
    setProcesando(false);
    if (!r.ok) return setErrorPago(r.error!);
    setCheckout(false);
    setEmitidos(r.boletos!);
  };

  // La trivia se abre encima de esta ventana: al volver, la reserva y las butacas siguen igual y el saldo ya está actualizado.
  const jugarTrivia = () => {
    setErrorPago("");
    app.abrirTrivia();
  };

  const cancelar = () => {
    app.cancelarReserva();
    setConfirmarCancelar(false);
    setCheckout(false);
  };

  const resumenLateral = (
    <>
      {miReserva ? (
        <Cuenta expira={miReserva.expira} />
      ) : (
        <div className="flex items-baseline justify-between rounded-md border border-borde bg-fondo px-3 py-2.5">
          <span className="etiqueta">Retención al reservar</span>
          <span className="text-lg font-black">{PARAMETROS.retencionMinutos}:00</span>
        </div>
      )}
      <div>
        <p className="etiqueta mb-2">{miReserva ? "Butacas retenidas a tu nombre" : "Tu selección"}</p>
        {asientosResumen.length === 0 ? (
          <p className="text-xs text-tenue">Elige hasta {PARAMETROS.maxButacasPorTransaccion} butacas en el mapa.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {asientosResumen.map((a) => (
              <span key={a} className="rounded border border-borde bg-panel-2 px-2 py-1 text-[11px] font-semibold">
                <span className="mr-1 text-salmon">●</span>Fila {a.split("-")[0]} · {a.split("-")[1]}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-end justify-between border-t border-borde pt-3">
        <span>
          <span className="etiqueta block">
            Total ({asientosResumen.length} boleto{asientosResumen.length === 1 ? "" : "s"})
          </span>
          <span className="text-2xl font-black text-oro">{total} créditos</span>
        </span>
        {usuario?.rol === "cliente" && <span className="text-[11px] text-tenue">Saldo: ◆ {saldo}</span>}
      </div>
      {miReserva ? (
        <div className="grid gap-2">
          <button onClick={() => setCheckout(true)} className="btn-vino w-full py-3.5">
            ⎘ Continuar con el pago
          </button>
          <button onClick={() => setConfirmarCancelar(true)} className="btn-borde w-full">
            Cancelar reserva
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          <button disabled={!sel.length || procesando || (!!reserva && !miReserva)} onClick={reservar} className="btn-vino w-full py-3.5">
            ⎘ {!usuario ? "Inicia sesión para reservar" : procesando ? "Reservando…" : `Confirmar reserva (${total} cr.)`}
          </button>
          <button onClick={() => setSel([])} disabled={!sel.length} className="btn-borde w-full">
            Cancelar selección
          </button>
        </div>
      )}
      {reserva && !miReserva && <p className="text-[11px] text-tenue">Ya tienes una reserva activa en otra función. Termínala o cancélala primero.</p>}
    </>
  );

  return (
    <div className="pb-20 lg:pb-0">
      {/* Encabezado de la función */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <BotonVolver href={`/pelicula/${p.id}`} texto={`Volver a ${p.titulo}`} />
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="badge-vino">{f.formato}</span>
            {s.tipo !== f.formato && <span className="badge-borde">{s.tipo}</span>}
            <span className="badge-borde">{f.idioma}</span>
            <span className="badge-borde">{p.clasificacion}</span>
          </div>
          <h1 className="titulo mt-3 text-2xl leading-tight sm:text-3xl xl:text-4xl">
            {p.titulo} <span className="text-apagado">/</span> {s.nombre} {s.tipo}
          </h1>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-tenue">
            <span className="first-letter:uppercase">{fmtFechaLarga(f.inicio)}</span>
            <span>
              ◷ <b className="text-tinta">{fmtHora(f.inicio)} hrs</b> – {fmtHora(finFuncion(f))}
            </span>
            <span className="font-semibold text-oro">{fmtDuracion(p.duracion)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Poster p={p} className="hidden aspect-[2/3] w-14 sm:block" rounded="rounded-md" sizes="56px" />
          <Link href={`/pelicula/${p.id}#horarios`} className="btn-borde">
            ▦ Cambiar función
          </Link>
        </div>
      </div>

      {sinTurno ? (
        <div className="tarjeta mt-8 border-rojo/50 bg-vino/30 p-10 text-center">
          <p className="titulo text-lg">Preestreno de {p.titulo}</p>
          <p className="mt-2 text-sm text-tenue">Por la alta demanda, para elegir asientos necesitas un turno vigente de la cola virtual.</p>
          <Link href={`/cola/${f.eventoId}`} className="btn-vino mt-5">
            Ir a la cola virtual
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Leyenda → pantalla → butacas: la pantalla queda siempre pegada al mapa */}
          <div className="min-w-0">
            <Leyenda />
            <div className="tarjeta mt-3 overflow-x-auto px-2 pb-5 pt-6 sm:px-6">
              <div className="mx-auto w-max">
                <div className="mx-auto mb-6 w-[92%]">
                  <div className="pantalla" />
                  <p className="-mt-1.5 text-center text-[9px] font-bold uppercase tracking-[0.3em] text-tinta/70 sm:text-[10px]">● Pantalla {s.tipo} ●</p>
                </div>
                <div className="mb-1.5 flex items-center gap-[2px] px-1 sm:gap-1">
                  <span className="w-4 sm:w-5" />
                  {Array.from({ length: s.columnas }).map((_, c) => (
                    <Fragment key={c}>
                      <span className={`butaca !h-auto text-center text-[9px] font-bold sm:text-[10px] ${asientosResumen.some((a) => a.endsWith(String(c + 1).padStart(2, "0"))) ? "text-oro" : "text-apagado"}`}>
                        {String(c + 1).padStart(2, "0")}
                      </span>
                      {PASILLOS.has(c + 1) && <span className="pasillo" />}
                    </Fragment>
                  ))}
                  <span className="w-4 sm:w-5" />
                </div>
                {Array.from({ length: s.filas }).map((_, fi) => {
                  const filaActiva = asientosResumen.some((a) => a.startsWith(FILAS[fi]));
                  return (
                    <div key={fi} className={`mb-[3px] flex items-center gap-[2px] rounded-md px-1 py-0.5 sm:mb-1 sm:gap-1 ${filaActiva ? "bg-panel-2 ring-1 ring-borde" : ""}`}>
                      <span className="w-4 text-center text-[10px] font-bold text-tenue sm:w-5 sm:text-[11px]">{FILAS[fi]}</span>
                      {Array.from({ length: s.columnas }).map((_, c) => {
                        const a = etiqueta(fi, c);
                        const mio = miReserva?.asientos.includes(a);
                        const estado = mio ? "mio" : occ.vendidos.has(a) ? "vendida" : occ.retenidos.has(a) ? "bloqueada" : sel.includes(a) ? "sel" : "libre";
                        return (
                          <Fragment key={a}>
                            <Butaca a={a} estado={estado} onClick={() => toggle(a)} />
                            {PASILLOS.has(c + 1) && <span className="pasillo" />}
                          </Fragment>
                        );
                      })}
                      <span className="w-4 text-center text-[10px] font-bold text-tenue sm:w-5 sm:text-[11px]">{FILAS[fi]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-1 border-t border-borde pt-4 text-[9px] font-semibold uppercase tracking-[0.14em] text-tenue sm:text-[10px]">
                <span>▣ Cabina de proyección trasera (fila {FILAS[s.filas - 1]})</span>
                <span>♿ Acceso adaptado en fila A</span>
              </div>
            </div>
          </div>

          {/* Resumen (RF-21): panel lateral fijo arriba en escritorio */}
          <aside className="tarjeta hidden space-y-4 p-5 lg:sticky lg:top-24 lg:block">
            {resumenLateral}
          </aside>
        </div>
      )}

      {/* Barra inferior compacta (sólo pantallas pequeñas) */}
      {!sinTurno && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-fondo/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
            {miReserva && (
              <span className="rounded border border-rojo/60 bg-vino/50 px-2 py-1 text-sm font-black tabular-nums text-salmon">
                ⏱ <Reloj expira={miReserva.expira} />
              </span>
            )}
            <span className="min-w-0 flex-1 leading-tight">
              <span className="etiqueta block truncate">
                {asientosResumen.length ? asientosResumen.join(", ") : `Hasta ${PARAMETROS.maxButacasPorTransaccion} butacas`}
              </span>
              <span className="text-base font-black text-oro">{total} créditos</span>
            </span>
            {miReserva ? (
              <button onClick={() => setCheckout(true)} className="btn-vino px-4">
                Pagar
              </button>
            ) : (
              <button disabled={!sel.length || procesando || (!!reserva && !miReserva)} onClick={reservar} className="btn-vino px-4">
                {usuario ? "Reservar" : "Iniciar sesión"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ventana emergente de compra */}
      <Modal abierto={checkout && !!miReserva} onCerrar={() => setCheckout(false)} titulo="Finalizar compra" ancho="max-w-lg">
        {miReserva && (
          <div className="space-y-4">
            <Cuenta expira={miReserva.expira} />
            <div className="flex gap-3 rounded-lg border border-borde bg-fondo p-3">
              <Poster p={p} className="aspect-[2/3] w-14 shrink-0" rounded="rounded" sizes="56px" />
              <div className="text-sm">
                <p className="titulo">{p.titulo}</p>
                <p className="text-tenue">
                  {s.nombre} · {s.tipo}
                </p>
                <p className="text-tenue first-letter:uppercase">
                  {fmtFechaLarga(f.inicio)} · {fmtHora(f.inicio)}
                </p>
              </div>
            </div>
            <Resumen asientos={miReserva.asientos} precio={f.precio} total={total} />

            <ol className="grid grid-cols-2 gap-2 text-xs">
              <Paso n={1} activo={!miReserva.creditosRetenidos} hecho={!!miReserva.creditosRetenidos} texto="Retener créditos" />
              <Paso n={2} activo={!!miReserva.creditosRetenidos} hecho={false} texto="Confirmar pago" />
            </ol>

            {errorPago && (
              <div className="rounded-md border border-rojo/60 bg-vino/50 p-3 text-sm text-salmon">
                {errorPago}
                {errorPago.startsWith("Saldo insuficiente") && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-salmon/80">
                    <span>Tu reserva sigue activa. Gana hasta {PARAMETROS.bonoTriviaPerfecta} créditos sin salir de aquí:</span>
                    <button onClick={jugarTrivia} className="btn-oro px-3 py-2 text-[10px]">
                      🎬 Jugar la trivia
                    </button>
                  </div>
                )}
              </div>
            )}

            {miReserva.creditosRetenidos ? (
              <>
                <p className="rounded-md border border-oro/30 bg-oro/10 p-2 text-xs text-oro">
                  {miReserva.creditosRetenidos} créditos retenidos. Confirma el pago antes de que termine el tiempo.
                </p>
                <button onClick={pagar} disabled={procesando} className="btn-vino w-full py-3.5">
                  {procesando ? "Procesando pago…" : `Pagar ◆ ${total} créditos`}
                </button>
              </>
            ) : (
              <button onClick={confirmar} className="btn-vino w-full py-3.5">
                Confirmar compra (saldo: ◆ {saldo})
              </button>
            )}
            <button onClick={() => setConfirmarCancelar(true)} className="btn-borde w-full">
              Cancelar reserva
            </button>
          </div>
        )}
      </Modal>

      {/* Confirmación de cancelación */}
      <Modal abierto={confirmarCancelar} onCerrar={() => setConfirmarCancelar(false)} titulo="¿Cancelar la reserva?" z="z-[55]">
        <p className="text-sm text-tenue">
          Las butacas {miReserva?.asientos.join(", ")} se liberarán para otros clientes
          {miReserva?.creditosRetenidos ? ` y se devolverán ${miReserva.creditosRetenidos} créditos a tu saldo` : ""}.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setConfirmarCancelar(false)} className="btn-borde flex-1">
            Volver
          </button>
          <button onClick={cancelar} className="btn-vino flex-1">
            Sí, cancelar
          </button>
        </div>
      </Modal>

      {/* Avisos (butaca tomada, límites…) */}
      <Modal abierto={!!alerta} onCerrar={() => setAlerta(null)} titulo={alerta?.titulo}>
        <p className="text-sm text-tenue">{alerta?.texto}</p>
        <button onClick={() => setAlerta(null)} className="btn-vino mt-5 w-full">
          Entendido
        </button>
      </Modal>

      {/* Compra exitosa */}
      <Modal abierto={!!emitidos} onCerrar={() => router.push("/mis-entradas")} ancho="max-w-xl">
        {emitidos && (
          <m.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-oro/60 bg-oro/15 text-2xl text-oro">✓</div>
              <h2 className="titulo mt-3 text-2xl">¡Compra exitosa!</h2>
              <p className="text-sm text-tenue">
                Se debitaron {emitidos.length * f.precio} créditos. Enviamos el comprobante a {usuario?.correo}.
              </p>
            </div>
            <GrupoBoletos boletos={emitidos} />
            <div className="flex gap-2">
              <Link href="/mis-entradas" className="btn-vino flex-1">
                Ir a Mis Entradas
              </Link>
              <Link href="/" className="btn-borde flex-1">
                Volver a cartelera
              </Link>
            </div>
          </m.div>
        )}
      </Modal>
    </div>
  );
}

const mmss = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

function Paso({ n, activo, hecho, texto }: { n: number; activo: boolean; hecho: boolean; texto: string }) {
  return (
    <li
      className={`flex items-center gap-2 rounded-md border px-2.5 py-2 font-semibold uppercase tracking-wide ${
        hecho ? "border-oro/40 text-oro" : activo ? "border-rojo/60 text-salmon" : "border-borde text-apagado"
      }`}
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-panel-2 text-[10px] font-bold">{hecho ? "✓" : n}</span>
      {texto}
    </li>
  );
}

// RNF-34: el estado se comunica con color y además con símbolo
const ESTILO = {
  libre: ["border-butaca-borde bg-butaca hover:bg-butaca-hover hover:-translate-y-0.5", "", "Disponible"],
  sel: ["border-rojo bg-vino text-salmon ring-2 ring-rojo/60", "★", "Tu selección"],
  mio: ["border-oro bg-vino text-oro ring-2 ring-oro/50", "★", "Retenida por ti"],
  bloqueada: ["border-arena/30 bg-arena/10 text-arena/80 cursor-not-allowed", "⏱", "Bloqueado / en proceso"],
  vendida: ["border-borde/60 bg-fondo text-apagado cursor-not-allowed", "✕", "Ocupado"],
} as const;

// Botón nativo: una sala tiene hasta 192 butacas y un componente animado por cada una cargaba el hilo principal.
// El "toque" se resuelve con CSS (active:scale-90), que corre en el compositor.
function Butaca({ a, estado, onClick }: { a: string; estado: keyof typeof ESTILO; onClick: () => void }) {
  const [cls, sym, txt] = ESTILO[estado];
  const ocupada = estado === "vendida" || estado === "bloqueada";
  return (
    <button
      disabled={ocupada}
      onClick={onClick}
      title={`${a} · ${txt}`}
      aria-label={`Butaca ${a}, ${txt}`}
      className={`butaca grid place-items-center rounded-[5px] border text-[9px] font-bold transition-[transform,background-color,border-color] duration-150 sm:text-[11px] ${ocupada ? "" : "active:scale-90"} ${cls}`}
    >
      {sym}
    </button>
  );
}

function Leyenda() {
  const items: (keyof typeof ESTILO)[] = ["libre", "sel", "bloqueada", "vendida"];
  return (
    <div className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-x-5 gap-y-2 rounded-lg border border-borde bg-panel px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.14em] text-tenue sm:text-[10px]">
      {items.map((k) => (
        <span key={k} className="flex items-center gap-2">
          <span className={`grid h-4 w-4 place-items-center rounded border text-[8px] ${ESTILO[k][0]}`}>{ESTILO[k][1]}</span>
          <span className={k === "sel" ? "text-tinta" : ""}>{ESTILO[k][2]}</span>
        </span>
      ))}
    </div>
  );
}

// Los relojes se actualizan solos: antes un setInterval de 500 ms en la página volvía a pintar el mapa completo.
function useRestante(expira: number) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, expira - ahora);
}

function Reloj({ expira }: { expira: number }) {
  return <>{mmss(useRestante(expira))}</>;
}

function Cuenta({ expira }: { expira: number }) {
  const restante = useRestante(expira);
  const pct = restante / (PARAMETROS.retencionMinutos * 60000);
  return (
    <div className="rounded-md border border-rojo/50 bg-vino/40 p-3">
      <div className="flex items-baseline justify-between">
        <span className="etiqueta text-salmon">⏱ Reserva expira en</span>
        <span className={`text-2xl font-black tabular-nums ${pct < 0.2 ? "text-salmon" : "text-tinta"}`}>{mmss(restante)}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-fondo">
        <div className="h-full origin-left bg-rojo transition-transform duration-1000 ease-linear" style={{ transform: `scaleX(${pct})` }} />
      </div>
    </div>
  );
}

function Resumen({ asientos, precio, total }: { asientos: string[]; precio: number; total: number }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-1">
        {asientos.map((a) => (
          <span key={a} className="rounded border border-borde bg-panel-2 px-2 py-0.5 text-xs font-bold">
            {a}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-tenue">
        <span>
          {asientos.length} × {precio} créditos
        </span>
        <span>{total}</span>
      </div>
      <div className="flex justify-between text-apagado">
        <span>Descuentos</span>
        <span>0</span>
      </div>
      <div className="flex justify-between border-t border-borde pt-2 font-bold">
        <span className="uppercase tracking-wide">Total</span>
        <span className="text-oro">{total} créditos</span>
      </div>
    </div>
  );
}
