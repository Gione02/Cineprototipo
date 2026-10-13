// Datos de demostración (modo prototipo). En producción provienen de la API en Go / PostgreSQL.

export type Rol = "cliente" | "agente" | "admin" | "auditor";

// Usuarios de demostración (se crean al iniciar el prototipo). En producción viven en la tabla usuarios con contraseña bcrypt.
export const USUARIOS_DEMO: { rol: Rol; nombre: string; correo: string; desc: string }[] = [
  { rol: "cliente", nombre: "Ana López", correo: "ana.lopez@correo.com", desc: "Compra, Mis Entradas, trivia" },
  { rol: "cliente", nombre: "Luis Pérez", correo: "luis.perez@correo.com", desc: "Otro cliente: créditos y boletos propios" },
  { rol: "agente", nombre: "Carlos Agente", correo: "agente@cineight.gt", desc: "Funciones, inventario, validar acceso" },
  { rol: "admin", nombre: "Admin Sistema", correo: "admin@cineight.gt", desc: "Métricas, gestión de usuarios, parámetros" },
  { rol: "auditor", nombre: "Laura Auditora", correo: "auditor@cineight.gt", desc: "Bitácora y reportes (solo lectura)" },
];

// Contraseña de los usuarios de demostración (sólo prototipo).
export const CLAVE_DEMO = "cineight123";

export const ROL_TXT: Record<Rol, string> = { cliente: "Cliente", agente: "Agente Operativo", admin: "Administrador del Sistema", auditor: "Auditor" };

export type Categoria = "cartelera" | "estreno" | "proximamente";

export type Pelicula = {
  id: string;
  titulo: string;
  tituloOriginal: string;
  categoria: Categoria;
  clasificacion: string;
  duracion: number; // minutos
  duracionEstimada?: boolean;
  genero: string;
  idioma: string;
  formatos: string[];
  director: string;
  reparto: string[];
  repartoVoces?: boolean;
  anio: string;
  sinopsis: string;
  trailer?: string; // ID de YouTube del tráiler oficial
  poster: string; // /posters/...
  posterLogo?: boolean; // aún sin póster oficial: se muestra el logotipo
  estrenoEnDias?: number; // sólo "próximamente"
  acento: string; // color de respaldo del póster
};

export type Sala = { id: string; nombre: string; tipo: string; filas: number; columnas: number; aforo: number; pasillos: number[] };

export type Funcion = {
  id: string;
  peliculaId: string;
  salaId: string;
  inicio: string; // ISO
  formato: string;
  idioma: string;
  precio: number; // créditos
  eventoId?: string; // preestreno con cola virtual
};

// Preestreno de alta demanda: la venta se regula con cola virtual (RF-36, RF-51).
export type EstrenoConCola = { id: string; nombre: string; funcionId: string; limitePorCliente: number };

// Parámetros globales (Tabla 31 de la ERS)
export const PARAMETROS = {
  retencionMinutos: 5,
  turnoColaMinutos: 3,
  maxButacasPorTransaccion: 6,
  maxBoletosPorEvento: 2,
  limpiezaMinutos: 20,
  costoBoleto: 50,
  bonoBienvenida: 120,
  preguntasTrivia: 3,
  creditosPorRespuesta: 10,
  bonoTriviaPerfecta: 50,
  intentosFallidos: 5,
  inactividadMinutos: 15,
  limiteSolicitudesMin: 5,
  iva: 0.12,
};

export const SALAS: Sala[] = [
  // pasillos: columnas después de las cuales hay un pasillo
  { id: "s1", nombre: "Sala 1", tipo: "IMAX Láser", filas: 12, columnas: 16, aforo: 192, pasillos: [4, 12] },
  { id: "s2", nombre: "Sala 2", tipo: "Dolby Atmos", filas: 10, columnas: 14, aforo: 140, pasillos: [3, 11] },
  { id: "s3", nombre: "Sala 3", tipo: "Tradicional", filas: 10, columnas: 12, aforo: 120, pasillos: [3, 9] },
];

export const PELICULAS: Pelicula[] = [
  // ───────── EN CARTELERA ─────────
  {
    id: "the-batman",
    titulo: "The Batman",
    tituloOriginal: "The Batman",
    categoria: "cartelera",
    clasificacion: "PG-13",
    duracion: 176,
    genero: "Acción / Crimen / Drama",
    idioma: "Subtitulada",
    formatos: ["IMAX Láser", "Dolby Atmos", "2D"],
    director: "Matt Reeves",
    reparto: ["Robert Pattinson", "Zoë Kravitz", "Paul Dano", "Colin Farrell"],
    anio: "2022",
    sinopsis:
      "En su segundo año luchando contra el crimen, Batman explora la corrupción existente en Gotham City y el vínculo que esta tiene con su propia familia, mientras persigue al Acertijo, un asesino en serie que ataca a la élite de la ciudad.",
    trailer: "mqqft2x_Aa4",
    poster: "/posters/the-batman.jpg",
    acento: "#4a0b0b",
  },
  {
    id: "avatar-agua",
    titulo: "Avatar: El Camino del Agua",
    tituloOriginal: "Avatar: The Way of Water",
    categoria: "cartelera",
    clasificacion: "PG-13",
    duracion: 192,
    genero: "Ciencia Ficción / Aventura / Acción",
    idioma: "Español",
    formatos: ["IMAX Láser", "3D"],
    director: "James Cameron",
    reparto: ["Sam Worthington", "Zoe Saldaña", "Sigourney Weaver", "Stephen Lang"],
    anio: "2022",
    sinopsis:
      "Jake Sully vive con su nueva familia formada en el planeta Pandora. Una antigua amenaza regresa para terminar lo que comenzó, obligando a Jake a unirse a Neytiri y al ejército Na'vi para proteger su hogar en los océanos.",
    trailer: "d9MyW72ELq0",
    poster: "/posters/avatar-agua.jpg",
    acento: "#0b2e4a",
  },
  {
    id: "gladiador",
    titulo: "Gladiador",
    tituloOriginal: "Gladiator",
    categoria: "cartelera",
    clasificacion: "R",
    duracion: 155,
    genero: "Acción / Aventura / Drama Histórico",
    idioma: "Subtitulada",
    formatos: ["2D"],
    director: "Ridley Scott",
    reparto: ["Russell Crowe", "Joaquin Phoenix", "Connie Nielsen", "Oliver Reed"],
    anio: "2000",
    sinopsis:
      "Un leal general romano es traicionado cuando el ambicioso hijo del emperador asesina a su padre y usurpa el trono. Reducido a la esclavitud, el general se convierte en gladiador para ascender en la arena y vengar el asesinato de su familia.",
    trailer: "P5ieIbInFpg",
    poster: "/posters/gladiator.png",
    acento: "#4a330b",
  },
  {
    id: "dark-knight",
    titulo: "El Caballero de la Noche",
    tituloOriginal: "The Dark Knight",
    categoria: "cartelera",
    clasificacion: "PG-13",
    duracion: 152,
    genero: "Acción / Crimen / Drama",
    idioma: "Subtitulada",
    formatos: ["Dolby Atmos", "2D"],
    director: "Christopher Nolan",
    reparto: ["Christian Bale", "Heath Ledger", "Aaron Eckhart", "Maggie Gyllenhaal"],
    anio: "2008",
    sinopsis:
      "Con la ayuda del teniente Jim Gordon y el fiscal Harvey Dent, Batman combate al crimen organizado en Gotham. Sin embargo, la llegada del Guasón, un criminal anarquista, sume a la ciudad en el caos y pone a prueba los límites éticos del héroe.",
    trailer: "EXeTwQWrcwY",
    poster: "/posters/dark-knight.jpg",
    acento: "#0b1a2e",
  },
  // ───────── ESTRENOS (preestrenos activos) ─────────
  {
    id: "deadpool-wolverine",
    titulo: "Deadpool & Wolverine",
    tituloOriginal: "Deadpool & Wolverine",
    categoria: "estreno",
    clasificacion: "R",
    duracion: 128,
    genero: "Acción / Comedia / Ciencia Ficción",
    idioma: "Subtitulada",
    formatos: ["Dolby Atmos", "2D"],
    director: "Shawn Levy",
    reparto: ["Ryan Reynolds", "Hugh Jackman", "Emma Corrin", "Morena Baccarin"],
    anio: "2024",
    sinopsis:
      "La Autoridad de Variación Temporal (TVA) recluta a un apático Deadpool para una misión urgente que alterará la historia del multiverso, obligándolo a hacer equipo con un reticente y desgastado Wolverine.",
    trailer: "73_1biulkYk",
    poster: "/posters/deadpool-wolverine.jpg",
    acento: "#5a0b0b",
  },
  {
    id: "dune-2",
    titulo: "Duna: Parte Dos",
    tituloOriginal: "Dune: Part Two",
    categoria: "estreno",
    clasificacion: "PG-13",
    duracion: 166,
    genero: "Ciencia Ficción / Aventura",
    idioma: "Subtitulada",
    formatos: ["IMAX Láser", "Dolby Atmos"],
    director: "Denis Villeneuve",
    reparto: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson", "Javier Bardem", "Austin Butler"],
    anio: "2024",
    sinopsis:
      "Paul Atreides se une a Chani y a los Fremen mientras busca venganza contra los conspiradores que destruyeron a su familia. Ante una elección entre el amor de su vida y el destino del universo, debe prevenir un futuro catastrófico.",
    trailer: "Way9Dexny3w",
    poster: "/posters/dune-2.jpg",
    acento: "#5a3a0b",
  },
  {
    id: "intensa-mente-2",
    titulo: "Intensa-Mente 2",
    tituloOriginal: "Inside Out 2",
    categoria: "estreno",
    clasificacion: "PG",
    duracion: 96,
    genero: "Animación / Aventura / Comedia",
    idioma: "Español",
    formatos: ["2D", "3D"],
    director: "Kelsey Mann",
    reparto: ["Amy Poehler", "Maya Hawke", "Kensington Tallman", "Liza Lapira"],
    repartoVoces: true,
    anio: "2024",
    sinopsis:
      "La mente de Riley, ahora una adolescente, sufre una demolición repentina para hacer espacio a nuevas emociones. Alegría, Tristeza, Furia, Temor y Desagrado no saben cómo reaccionar cuando Ansiedad y Envidia irrumpen en el cuartel general.",
    trailer: "LEjhY15eCx0",
    poster: "/posters/inside-out-2.jpg",
    acento: "#3a0b5a",
  },
  {
    id: "oppenheimer",
    titulo: "Oppenheimer",
    tituloOriginal: "Oppenheimer",
    categoria: "estreno",
    clasificacion: "R",
    duracion: 180,
    genero: "Biografía / Drama / Historia",
    idioma: "Subtitulada",
    formatos: ["IMAX Láser", "2D"],
    director: "Christopher Nolan",
    reparto: ["Cillian Murphy", "Emily Blunt", "Matt Damon", "Robert Downey Jr."],
    anio: "2023",
    sinopsis:
      "Historia del físico teórico J. Robert Oppenheimer, su papel al frente del Proyecto Manhattan durante la Segunda Guerra Mundial y las consecuencias políticas y éticas del desarrollo de la bomba atómica.",
    trailer: "uYPbbksJxIg",
    poster: "/posters/oppenheimer.jpg",
    acento: "#5a2a0b",
  },
  // ───────── PRÓXIMAMENTE (apertura de taquilla programada) ─────────
  {
    id: "spider-verse",
    titulo: "Spider-Man: Beyond the Spider-Verse",
    tituloOriginal: "Spider-Man: Beyond the Spider-Verse",
    categoria: "proximamente",
    clasificacion: "PG",
    duracion: 145,
    duracionEstimada: true,
    genero: "Animación / Acción / Aventura",
    idioma: "Español",
    formatos: ["IMAX Láser", "3D"],
    director: "Joaquim Dos Santos, Kemp Powers, Justin K. Thompson",
    reparto: ["Shameik Moore", "Hailee Steinfeld", "Oscar Isaac", "Daniel Kaluuya"],
    repartoVoces: true,
    anio: "Próximo lanzamiento",
    sinopsis:
      "Tras los desgarradores acontecimientos del multiverso, Miles Morales debe escapar de su contraparte alternativa en la Tierra-42 mientras Gwen Stacy reúne a un equipo de Spider-Personas para rescatarlo y salvar la red del destino.",
    poster: "/posters/spider-verse.jpg",
    posterLogo: true,
    estrenoEnDias: 45,
    acento: "#3a0b2e",
  },
  {
    id: "avatar-fuego",
    titulo: "Avatar: Fuego y Ceniza",
    tituloOriginal: "Avatar: Fire and Ash",
    categoria: "proximamente",
    clasificacion: "PG-13",
    duracion: 190,
    duracionEstimada: true,
    genero: "Ciencia Ficción / Aventura",
    idioma: "Español",
    formatos: ["IMAX Láser", "3D"],
    director: "James Cameron",
    reparto: ["Sam Worthington", "Zoe Saldaña", "Sigourney Weaver", "Oona Chaplin"],
    anio: "Próximo lanzamiento",
    sinopsis:
      'La familia Sully explora nuevas regiones de Pandora y entra en contacto con el "Pueblo de la Ceniza", un clan Na\'vi con una cultura agresiva y oscura asociada directamente con el elemento fuego.',
    trailer: "nb_fFj_0rq8",
    poster: "/posters/avatar-fuego.jpg",
    estrenoEnDias: 20,
    acento: "#5a1a0b",
  },
  {
    id: "gladiator-2",
    titulo: "Gladiator II",
    tituloOriginal: "Gladiator II",
    categoria: "proximamente",
    clasificacion: "R",
    duracion: 148,
    genero: "Acción / Aventura / Drama Histórico",
    idioma: "Subtitulada",
    formatos: ["IMAX Láser", "Dolby Atmos"],
    director: "Ridley Scott",
    reparto: ["Paul Mescal", "Pedro Pascal", "Denzel Washington", "Connie Nielsen"],
    anio: "Próximo lanzamiento",
    sinopsis:
      "Años después de presenciar el sacrificio de Máximo, Lucius, el nieto del antiguo emperador Marco Aurelio, se ve obligado a ingresar al Coliseo tras la conquista de su hogar a manos de los tiránicos emperadores de Roma.",
    trailer: "4rgYUipGJNo",
    poster: "/posters/gladiator-2.jpg",
    estrenoEnDias: 12,
    acento: "#4a2a0b",
  },
  {
    id: "batman-2",
    titulo: "The Batman: Parte II",
    tituloOriginal: "The Batman: Part II",
    categoria: "proximamente",
    clasificacion: "PG-13",
    duracion: 170,
    duracionEstimada: true,
    genero: "Acción / Crimen / Drama",
    idioma: "Subtitulada",
    formatos: ["IMAX Láser", "Dolby Atmos"],
    director: "Matt Reeves",
    reparto: ["Robert Pattinson", "Zoë Kravitz", "Colin Farrell", "Andy Serkis"],
    anio: "Próximo lanzamiento",
    sinopsis:
      "Tras la gran inundación de Gotham, Batman se enfrenta al colapso del control territorial entre las mafias de la ciudad mientras un nuevo antagonista emerge del caos para desmantelar la estructura social.",
    poster: "/posters/batman-2.png",
    posterLogo: true,
    estrenoEnDias: 60,
    acento: "#2e0b0b",
  },
];

export const CATEGORIAS: { id: Categoria; titulo: string; sub: string }[] = [
  { id: "cartelera", titulo: "En cartelera", sub: "Funciones disponibles hoy y los próximos días" },
  { id: "estreno", titulo: "Estrenos", sub: "Preestrenos activos" },
  { id: "proximamente", titulo: "Próximamente", sub: "Apertura de taquilla programada" },
];

function hoyA(diasExtra: number, hora: number, minuto = 0) {
  const d = new Date();
  d.setDate(d.getDate() + diasExtra);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
}

// Programación sin traslapes por sala (inicio + duración + 20 min de limpieza).
// Se calcula al primer uso (en el navegador) para que las fechas sean relativas a hoy.
let _funciones: Funcion[] | null = null;
export const funcionesBase = (): Funcion[] =>
  (_funciones ??= (
    [
      // Sala 1 · IMAX Láser
      ["f1", "dune-2", "s1", 0, 14, 0, "IMAX Láser", "Subtitulada", 70],
      ["f2", "avatar-agua", "s1", 0, 17, 30, "IMAX 3D", "Español", 70],
      ["f3", "the-batman", "s1", 0, 21, 15, "IMAX Láser", "Subtitulada", 70],
      ["f4", "avatar-agua", "s1", 1, 15, 30, "IMAX 3D", "Español", 70],
      ["f5", "dune-2", "s1", 1, 20, 0, "IMAX Láser", "Subtitulada", 80, "e1"],
      ["f6", "oppenheimer", "s1", 2, 16, 0, "IMAX Láser", "Subtitulada", 70],
      ["f7", "dune-2", "s1", 2, 19, 45, "IMAX Láser", "Subtitulada", 70],
      // Sala 2 · Dolby Atmos
      ["f8", "intensa-mente-2", "s2", 0, 13, 0, "Dolby Atmos", "Español", 50],
      ["f9", "dark-knight", "s2", 0, 15, 30, "Dolby Atmos", "Subtitulada", 60],
      ["f10", "deadpool-wolverine", "s2", 0, 19, 0, "Dolby Atmos", "Subtitulada", 60],
      ["f11", "gladiador", "s2", 1, 16, 0, "Dolby Atmos", "Subtitulada", 60],
      ["f12", "deadpool-wolverine", "s2", 1, 19, 30, "Dolby Atmos", "Subtitulada", 60],
      ["f13", "intensa-mente-2", "s2", 2, 11, 0, "Dolby Atmos", "Español", 40],
      ["f14", "the-batman", "s2", 2, 18, 0, "Dolby Atmos", "Subtitulada", 60],
      // Sala 3 · Tradicional
      ["f15", "gladiador", "s3", 0, 16, 0, "2D", "Subtitulada", 50],
      ["f16", "oppenheimer", "s3", 0, 19, 30, "2D", "Subtitulada", 50],
      ["f17", "intensa-mente-2", "s3", 1, 12, 0, "3D", "Español", 50],
      ["f18", "dark-knight", "s3", 1, 17, 0, "2D", "Subtitulada", 50],
      ["f19", "the-batman", "s3", 1, 20, 30, "2D", "Subtitulada", 50],
      ["f20", "avatar-agua", "s3", 3, 15, 0, "3D", "Español", 60],
      ["f21", "oppenheimer", "s3", 3, 19, 0, "2D", "Subtitulada", 50],
    ] as [string, string, string, number, number, number, string, string, number, string?][]
  ).map(([id, peliculaId, salaId, d, h, m, formato, idioma, precio, eventoId]) => ({
    id,
    peliculaId,
    salaId,
    inicio: hoyA(d, h, m),
    formato,
    idioma,
    precio,
    ...(eventoId ? { eventoId } : {}),
  })));

export const EVENTOS: EstrenoConCola[] = [{ id: "e1", nombre: "Duna: Parte Dos — Preestreno IMAX", funcionId: "f5", limitePorCliente: 2 }];

export type Pregunta = { texto: string; opciones: string[]; correcta: number };

// Preguntas basadas en los datos curiosos de las películas de la cartelera.
export const PREGUNTAS: Pregunta[] = [
  { texto: "En «The Batman», ¿qué se puso Paul Dano bajo la máscara del Acertijo para no dejar rastros de ADN?", opciones: ["Una media de nailon", "Plástico transparente envuelto en la cabeza", "Pintura corporal", "Un casco de cuero"], correcta: 1 },
  { texto: "¿Cuánto tiempo aguantó Kate Winslet la respiración bajo el agua en el rodaje de «Avatar: El Camino del Agua»?", opciones: ["4 minutos", "5 minutos 30 segundos", "7 minutos 15 segundos", "9 minutos"], correcta: 2 },
  { texto: "En «Gladiador», ¿qué personaje grita «¡¿No están entretenidos?!» en la arena?", opciones: ["Cómodo", "Máximo", "Próximo", "Lucila"], correcta: 1 },
  { texto: "¿Cuánto tiempo se aisló Heath Ledger en un hotel para crear al Joker de «El Caballero de la Noche»?", opciones: ["Casi un mes", "Una semana", "Tres meses", "Un año"], correcta: 0 },
  { texto: "¿Qué hito marcó «Deadpool & Wolverine» dentro del Universo Cinematográfico de Marvel?", opciones: ["La primera en blanco y negro", "La primera animada", "La primera con clasificación R", "La primera sin héroes"], correcta: 2 },
  { texto: "¿Cómo se crearon los sonidos de los gusanos de arena de «Duna: Parte Dos»?", opciones: ["Con sintetizadores", "Grabando ballenas", "Con motores de avión", "Enterrando micrófonos en la arena del desierto de Jordania"], correcta: 3 },
  { texto: "Para retratar un ataque de ansiedad en «Intensa-Mente 2», ¿con quién trabajó el equipo de animación?", opciones: ["Psicólogos del desarrollo", "Neurocirujanos", "Actores de teatro", "Atletas olímpicos"], correcta: 0 },
  { texto: "¿Cómo se recreó la prueba de la bomba Trinity en «Oppenheimer»?", opciones: ["Totalmente con CGI", "Con efectos físicos reales, sin CGI", "Con material de archivo", "Con dibujos animados"], correcta: 1 },
  { texto: "En «Spider-Man: Beyond the Spider-Verse», ¿de qué Tierra debe escapar Miles Morales?", opciones: ["Tierra-616", "Tierra-1610", "Tierra-42", "Tierra-65"], correcta: 2 },
  { texto: "¿Por qué James Cameron filmó «Avatar: Fuego y Ceniza» junto con «El Camino del Agua»?", opciones: ["Para ahorrar en vestuario", "Para evitar el envejecimiento visible de los actores jóvenes", "Por el clima de Nueva Zelanda", "Por un contrato con el estudio"], correcta: 1 },
  { texto: "Para las batallas navales de «Gladiator II», ¿qué hizo la producción?", opciones: ["Usó sólo CGI", "Filmó en el mar Mediterráneo", "Construyó una réplica del Coliseo y llenó la fosa de agua", "Usó maquetas en una piscina"], correcta: 2 },
  { texto: "¿A qué sello de DC pertenece la saga de «The Batman» de Matt Reeves?", opciones: ["Elseworlds", "DCEU", "Vertigo", "Black Label"], correcta: 0 },
];

export const pelicula = (id: string) => PELICULAS.find((p) => p.id === id)!;
export const sala = (id: string) => SALAS.find((s) => s.id === id)!;

export function fechaEstreno(p: Pelicula) {
  const d = new Date();
  d.setDate(d.getDate() + (p.estrenoEnDias ?? 0));
  return d.toLocaleDateString("es-GT", { day: "numeric", month: "long" });
}

export const fmtDuracion = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

export function finFuncion(f: Funcion) {
  const p = pelicula(f.peliculaId);
  return new Date(new Date(f.inicio).getTime() + (p.duracion + PARAMETROS.limpiezaMinutos) * 60000);
}

// Generador determinista para simular ocupación de otros compradores
function semilla(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export const FILAS = "ABCDEFGHIJKLMNOP";
export const etiqueta = (fila: number, col: number) => `${FILAS[fila]}-${String(col + 1).padStart(2, "0")}`;

export function ocupacionSimulada(funcionId: string) {
  const r = semilla(funcionId);
  const vendidos = new Set<string>();
  const retenidos = new Set<string>();
  const f = funcionesBase().find((x) => x.id === funcionId);
  const s = sala(f?.salaId ?? "s1");
  const tasa = f?.eventoId ? 0.55 : 0.28;
  for (let fi = 0; fi < s.filas; fi++)
    for (let c = 0; c < s.columnas; c++) {
      const x = r();
      if (x < tasa) vendidos.add(etiqueta(fi, c));
      else if (x < tasa + 0.06) retenidos.add(etiqueta(fi, c));
    }
  return { vendidos, retenidos };
}

export const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString("es-GT", { weekday: "short", day: "2-digit", month: "short" });
export const fmtFechaLarga = (iso: string) => new Date(iso).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });
export const fmtHora = (iso: string | Date) => new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", hour12: false });
