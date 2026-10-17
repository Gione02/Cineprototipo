// Tipos del dominio compartidos por toda la interfaz (catálogo, compra, cuentas y panel).

export type Rol = "cliente" | "agente" | "admin" | "auditor";

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
  personalizada?: boolean; // creada por un agente o administrador desde el panel
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

export type Pregunta = { texto: string; opciones: string[]; correcta: number };

/** Datos de una película nueva desde el panel (el póster es un data URL ya comprimido). */
export type NuevaPelicula = Omit<Pelicula, "id" | "acento" | "personalizada" | "posterLogo" | "repartoVoces">;

/** Función a programar para una película. */
export type NuevaFuncion = Omit<Funcion, "id" | "peliculaId" | "eventoId">;
