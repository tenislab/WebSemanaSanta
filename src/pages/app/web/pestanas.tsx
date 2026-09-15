/**
 * EL CATÁLOGO DE PESTAÑAS: cuáles hay, cómo se agrupan y a dónde saltan.
 *
 * Las veintitrés que ve la hermandad, con su nombre, su icono, el grupo del
 * menú lateral en que aparecen, la sección de la vista previa a la que se
 * asoman y las palabras por las que se encuentran en el buscador.
 *
 * Está aparte de la pantalla porque es una LISTA, no lógica: se lee entera de
 * un vistazo y se toca al añadir una pestaña, que es lo más frecuente que se
 * hace aquí.
 */
import { type FocoPreview } from '../../../components/SitioContenido'
import { type AlturaHero, type TipoRed } from '../../../lib/webPublica'
import { type ReactNode } from 'react'

export const REDES: TipoRed[] = ['Instagram', 'Facebook', 'X', 'YouTube', 'TikTok', 'Web']
export const ALTURAS: { id: AlturaHero; label: string }[] = [
  { id: 'compacta', label: 'Compacta' },
  { id: 'media', label: 'Media' },
  { id: 'completa', label: 'Pantalla completa' },
]

export type Pestana = 'diseno' | 'marco' | 'contacto' | 'compartir' | 'visitas' | 'avisos' | 'portada' | 'galeria' | 'actualidad' | 'cultos' | 'cartel' | 'caridad' | 'paginas' | 'boletines' | 'historia' | 'titulares' | 'hazte' | 'estacion' | 'junta' | 'donativos' | 'loteria' | 'tienda' | 'buzon'

/**
 * A qué sección de la web corresponde cada pestaña del editor: la vista previa
 * salta a ella y la resalta, para no perder de vista qué se está tocando.
 */
/** Las pestañas que existen, para poder fiarse de lo que venga en la URL. */
const PESTANAS: Pestana[] = [
  'diseno', 'marco', 'contacto', 'compartir', 'visitas', 'avisos', 'portada', 'galeria',
  'actualidad', 'cultos', 'cartel', 'caridad', 'paginas', 'boletines', 'historia',
  'titulares', 'hazte', 'estacion', 'junta', 'donativos', 'loteria', 'tienda', 'buzon',
]
export function esPestana(x: string | null): x is Pestana {
  return x !== null && (PESTANAS as string[]).includes(x)
}

export const SECCION_DE_PESTANA: Partial<Record<Pestana, FocoPreview>> = {
  galeria: 'galeria',
  actualidad: 'actualidad',
  cultos: 'cultos',
  cartel: 'cartel',
  caridad: 'caridad',
  paginas: 'paginas',
  boletines: 'boletines',
  contacto: 'contacto',
  historia: 'historia',
  titulares: 'titulares',
  hazte: 'hazte',
  estacion: 'estacion',
  junta: 'junta',
  donativos: 'donativos',
  loteria: 'loteria',
  tienda: 'tienda',
}
/**
 * El orden importa: primero lo que da forma a TODA la web (diseño, cabecera y
 * pie, contacto) y después el contenido. «Contacto» estaba la última y casi
 * nadie llegaba a ella: la dirección y las redes se quedaban sin poner.
 */
/**
 * Las secciones del editor, agrupadas. Diez pestañas en una fila se partían en
 * dos y no se sabía dónde estaba nada; en un raíl lateral con grupos se lee de
 * un vistazo y deja el ancho para lo que importa: la vista previa.
 */
/**
 * Por qué palabras se encuentra cada pestaña. Con quince secciones, buscar
 «itinerario» y que salga «Estación de penitencia» ahorra recorrer el raíl
 entero acordándose de dónde estaba cada cosa.
 */
/** Cómo se llama cada campo cuando se lo enseñamos a la hermandad. */
export const NOMBRE_CAMPO: Record<string, string> = {
  titulo: 'el nombre', lema: 'el lema', logoDataUrl: 'el escudo',
  colorPrimario: 'el color', colorSecundario: 'el color secundario',
  plantilla: 'la plantilla', pareja: 'la tipografía', tema: 'el fondo',
  redondeo: 'las esquinas', densidad: 'el aire', secciones: 'las secciones',
  historia: 'la historia', titulares: 'los titulares', cultos: 'los cultos',
  albumes: 'la galería', noticias: 'las noticias', paginas: 'las páginas',
  boletines: 'los boletines', hazte: 'hazte hermano', estacion: 'la estación de penitencia',
  junta: 'la junta', horarios: 'el horario', cifras: 'las cifras', sangre: 'la foto a sangre',
  heroFotos: 'la portada', cabecera: 'la cabecera', pie: 'el pie', seo: 'lo que se comparte',
  redes: 'las redes', estilo: 'el estilo',
}

export const PALABRAS_PESTANA: Partial<Record<Pestana, string>> = {
  diseno: 'estilo plantilla color colores paleta tipografia fuente secciones orden franjas capitular animacion idioma',
  marco: 'cabecera pie menu logo escudo legal columnas redes',
  portada: 'hero foto principal cuenta atras cifras sangre proximo culto boton',
  titulares: 'imagenes cristo virgen autoria marca agua derechos fotografo',
  estacion: 'itinerario salida horario paso calle viernes santo recorrido',
  hazte: 'alta solicitud requisitos cuota pasos hermano nuevo',
  junta: 'cargos gobierno hermano mayor secretario tesorero',
  historia: 'fundacion sede texto parrafos citas',
  galeria: 'fotos albumes peso imagenes salida',
  actualidad: 'noticias avisos cabildo enlace destacada',
  cultos: 'misa quinario funcion triduo calendario eventos',
  paginas: 'textos informacion caridad bolsa formacion',
  boletines: 'revista pdf descargas',
  contacto: 'direccion telefono correo mapa secretaria horario',
  compartir: 'seo google whatsapp titulo descripcion imagen enlace',
  donativos: 'donativo colabora bizum iban cuenta caridad limosna pasarela tarjeta',
  loteria: 'loteria navidad numero participaciones sorteo reserva',
  buzon: 'mensajes formulario contacto recibidos buzon correo',
}

export const GRUPOS_PESTANAS: { titulo: string; items: { id: Pestana; label: string; icono: ReactNode }[] }[] = [
  {
    titulo: 'Aspecto',
    items: [
      { id: 'diseno', label: 'Estilo y secciones', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H13a1.5 1.5 0 0 1 0-3h3.5A4.5 4.5 0 0 0 21 9.5C21 5.9 16.97 3 12 3Z" /><circle cx="7.5" cy="10.5" r="1" fill="currentColor" /><circle cx="12" cy="7.5" r="1" fill="currentColor" /><circle cx="16.5" cy="10.5" r="1" fill="currentColor" /></svg> },
      { id: 'marco', label: 'Cabecera y pie', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 8.5h18M3 16h18" /></svg> },
    ],
  },
  {
    titulo: 'Contenido',
    items: [
      { id: 'portada', label: 'Portada', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 16 5-4 4 3 3-2 6 4" /><circle cx="8.5" cy="9" r="1.3" /></svg> },
      { id: 'titulares', label: 'Titulares', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v18M8 7h8" /><circle cx="12" cy="15" r="3.2" /></svg> },
      { id: 'estacion', label: 'Estación de penitencia', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 20h16" /><path d="M7 20V9l5-5 5 5v11" /><path d="M10.5 20v-4.5h3V20" /></svg> },
      { id: 'hazte', label: 'Hazte hermano', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M18 8v6M15 11h6" /></svg> },
      { id: 'junta', label: 'Junta de gobierno', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="9" r="2.6" /><circle cx="16" cy="9" r="2.6" /><path d="M3 19c0-2.6 2.2-4.4 5-4.4s5 1.8 5 4.4M13 19c0-2.6 1.6-4.4 4-4.4s4 1.8 4 4.4" /></svg> },
      { id: 'historia', label: 'Historia', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5Z" /></svg> },
      { id: 'galeria', label: 'Galería', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M19 8v10a2 2 0 0 1-2 2H7" /></svg> },
      { id: 'actualidad', label: 'Actualidad', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h12v14H5a1 1 0 0 1-1-1V5Z" /><path d="M16 9h3a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2" /><path d="M7 8h6M7 11.5h6M7 15h4" /></svg> },
      { id: 'cultos', label: 'Cultos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v18M8 7h8" /></svg> },
      { id: 'cartel', label: 'El cartel', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8.5 7.5h7M8.5 11h7" /><circle cx="12" cy="16" r="2.2" /></svg> },
      { id: 'caridad', label: 'Caridad', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 13.5 6.8 11.3a2.6 2.6 0 0 1 3.7-3.7l1.5 1.5 1.5-1.5a2.6 2.6 0 0 1 3.7 3.7L15 13.5" /><path d="M4 20c1.6-2.3 3.6-3.4 6-3.4h3.4c1 0 1.6.6 1.6 1.4s-.6 1.4-1.6 1.4h-2.6" /><path d="m13 18.6 5.4-2.4c.9-.4 1.8 0 2.1.8" /></svg> },
      { id: 'paginas', label: 'Páginas y textos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h4" /></svg> },
      { id: 'boletines', label: 'Boletines', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg> },
      { id: 'donativos', label: 'Donativos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z" /></svg> },
      { id: 'loteria', label: 'Lotería', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" /><path d="M12 7v10" strokeDasharray="2 2" /></svg> },
      { id: 'tienda', label: 'Tienda', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 8h12l-1 11a2 2 0 0 1-2 1.8H9A2 2 0 0 1 7 19Z" /><path d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" /></svg> },
    ],
  },
  {
    titulo: 'Datos',
    items: [
      { id: 'contacto', label: 'Contacto y mapa', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg> },
      { id: 'buzon', label: 'Buzón de la web', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></svg> },
      { id: 'visitas', label: 'Visitas', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 20V9M10 20V4M16 20v-7M22 20H2" /></svg> },
      { id: 'avisos', label: 'Avisos por correo', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg> },
      { id: 'compartir', label: 'Al compartir', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.3M8.2 13.2l7.6 4.3" /></svg> },
    ],
  },
]

/** Tamaños de la vista previa. El sitio se pinta a este ancho y se escala. */
export type Dispositivo = 'movil' | 'tableta' | 'escritorio'
export const DISPOSITIVOS: { id: Dispositivo; nombre: string; ancho: number; icono: ReactNode }[] = [
  {
    id: 'movil', nombre: 'Móvil', ancho: 390,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18.5h2" /></svg>,
  },
  {
    id: 'tableta', nombre: 'Tableta', ancho: 768,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M11 18.5h2" /></svg>,
  },
  {
    id: 'escritorio', nombre: 'Escritorio', ancho: 1280,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2.5" y="4" width="19" height="12" rx="1.6" /><path d="M9 20h6M12 16v4" /></svg>,
  },
]
