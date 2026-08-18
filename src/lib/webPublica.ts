import { useEffect, useState } from 'react'
import { guardarConAviso, leerPersistido } from './persistencia'

/**
 * Web pública de la hermandad, creada y personalizada desde la propia app.
 * La hermandad elige una plantilla, ajusta colores, tipografía, portada y qué
 * secciones enseñar (historia, titulares, cultos, galería, actualidad,
 * contacto), y publica la web en /w/<slug>. Incluye un botón «Entrar» que
 * lleva al portal del hermano (/hermano). Todo se guarda en el navegador
 * (localStorage) y, más adelante, en una tabla propia de Supabase.
 */

export type PlantillaWeb = 'clasica' | 'sobria' | 'moderna'
export type TemaWeb = 'claro' | 'oscuro'
/** Id de tipografía; se resuelve contra TIPOGRAFIAS (ver abajo). */
export type TipografiaWeb = string
export type AlturaHero = 'compacta' | 'media' | 'completa'
export type TipoSeccion =
  | 'historia'
  | 'titulares'
  | 'cultos'
  | 'galeria'
  | 'actualidad'
  | 'paginas'
  | 'boletines'
  | 'contacto'
export type TipoRed = 'Instagram' | 'Facebook' | 'X' | 'YouTube' | 'TikTok' | 'Web'

export const PLANTILLAS: { id: PlantillaWeb; nombre: string; descripcion: string }[] = [
  { id: 'clasica', nombre: 'Clásica', descripcion: 'Serif, tonos cálidos y aire tradicional cofrade.' },
  { id: 'sobria', nombre: 'Sobria', descripcion: 'Líneas limpias, mucho blanco y tipografía discreta.' },
  { id: 'moderna', nombre: 'Moderna', descripcion: 'Portada a pantalla completa y contraste marcado.' },
]

export const TIPOGRAFIAS: { id: TipografiaWeb; nombre: string; css: string }[] = [
  { id: 'clasica', nombre: 'Clásica (Georgia)', css: "Georgia, 'Times New Roman', serif" },
  { id: 'elegante', nombre: 'Elegante (Palatino)', css: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
  { id: 'cinzel', nombre: 'Cinzel (cofrade)', css: "'Cinzel', Georgia, serif" },
  { id: 'cormorant', nombre: 'Cormorant Garamond', css: "'Cormorant Garamond', Georgia, serif" },
  { id: 'playfair', nombre: 'Playfair Display', css: "'Playfair Display', Georgia, serif" },
  { id: 'ebgaramond', nombre: 'EB Garamond', css: "'EB Garamond', Georgia, serif" },
  { id: 'merriweather', nombre: 'Merriweather', css: "'Merriweather', Georgia, serif" },
  { id: 'lora', nombre: 'Lora', css: "'Lora', Georgia, serif" },
  { id: 'moderna', nombre: 'Moderna (sistema)', css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'montserrat', nombre: 'Montserrat', css: "'Montserrat', system-ui, sans-serif" },
  { id: 'raleway', nombre: 'Raleway', css: "'Raleway', system-ui, sans-serif" },
  { id: 'poppins', nombre: 'Poppins', css: "'Poppins', system-ui, sans-serif" },
  { id: 'lato', nombre: 'Lato', css: "'Lato', system-ui, sans-serif" },
  { id: 'oswald', nombre: 'Oswald (titulares)', css: "'Oswald', system-ui, sans-serif" },
  { id: 'bebas', nombre: 'Bebas Neue (impacto)', css: "'Bebas Neue', system-ui, sans-serif" },
  { id: 'dancing', nombre: 'Dancing Script (caligrafía)', css: "'Dancing Script', cursive" },
]

export const SECCIONES_INFO: Record<TipoSeccion, { nombre: string }> = {
  historia: { nombre: 'Historia' },
  titulares: { nombre: 'Titulares' },
  cultos: { nombre: 'Cultos y actos' },
  galeria: { nombre: 'Galería de fotos' },
  actualidad: { nombre: 'Actualidad (noticias)' },
  paginas: { nombre: 'Páginas y textos' },
  boletines: { nombre: 'Boletines' },
  contacto: { nombre: 'Contacto' },
}

export interface SeccionConfig {
  tipo: TipoSeccion
  visible: boolean
}

export interface Titular {
  id: string
  nombre: string
  fotoDataUrl: string | null
  descripcion: string
}

export interface FotoGaleria {
  id: string
  fotoDataUrl: string
  pie: string
}

export interface CultoWeb {
  id: string
  titulo: string
  detalle: string
}

/** Noticia de la sección Actualidad. */
export interface Noticia {
  id: string
  titulo: string
  fecha: string
  resumen: string
  fotoDataUrl: string | null
  publicada: boolean
}

/** Párrafo de una página de texto (con subtítulo opcional). */
export interface ParrafoPagina {
  id: string
  subtitulo: string
  texto: string
}

/** Página de la sección «Páginas y textos» (Titulares, Historia, Junta…). */
export interface PaginaWeb {
  id: string
  icono: string
  antetitulo: string
  titulo: string
  entradilla: string
  parrafos: ParrafoPagina[]
  fotos: string[]
  /** Si aparece en el menú de la web (y se publica). Por defecto sí. */
  enMenu?: boolean
}

/** Boletín en PDF (por ahora se guarda el título; el PDF, al conectar almacenamiento). */
export interface Boletin {
  id: string
  titulo: string
  subtitulo: string
  pdfNombre: string | null
}

export interface RedWeb {
  id: string
  tipo: TipoRed
  url: string
}

export interface WebPublica {
  publicada: boolean
  plantilla: PlantillaWeb
  /** Parte final del enlace: …/w/<slug> */
  slug: string
  /** Dominio personalizado propio (p. ej. hermandaddetriana.es), si lo han configurado. */
  dominio?: string

  // Marca
  titulo: string
  lema: string
  /** Logo propio de la web; si es null se usa el de la hermandad. */
  logoDataUrl: string | null

  // Diseño
  colorPrimario: string
  colorSecundario: string
  tema: TemaWeb
  tipografia: TipografiaWeb

  // Portada: varias fotos que se alternan de fondo en la cabecera.
  heroFotos: string[]
  /** Oscurecido de la foto de portada, 0–80 (%). */
  heroOverlay: number
  heroAltura: AlturaHero
  heroTextoBoton: string

  // Secciones: orden y visibilidad
  secciones: SeccionConfig[]

  // Contenido
  historia: string
  titulares: Titular[]
  cultos: CultoWeb[]
  galeria: FotoGaleria[]
  noticias: Noticia[]
  paginas: PaginaWeb[]
  boletines: Boletin[]
  /** Muestra en la web los últimos comunicados publicados. */
  mostrarActualidad: boolean

  // Contacto
  email: string
  telefono: string
  direccion: string
  /** URL de Google Maps (enlace o embed). */
  mapaUrl: string
  redes: RedWeb[]

  // Pie
  textoPie: string
}

export const CLAVE_WEB_PUBLICA = 'cabildo-web-publica'

export const SECCIONES_POR_DEFECTO: SeccionConfig[] = [
  { tipo: 'historia', visible: true },
  { tipo: 'titulares', visible: true },
  { tipo: 'cultos', visible: true },
  { tipo: 'galeria', visible: true },
  { tipo: 'actualidad', visible: true },
  { tipo: 'paginas', visible: true },
  { tipo: 'boletines', visible: false },
  { tipo: 'contacto', visible: true },
]

export const WEB_PUBLICA_INICIAL: WebPublica = {
  publicada: false,
  plantilla: 'clasica',
  slug: 'mi-hermandad',

  titulo: '',
  lema: 'Fe, tradición y caridad',
  logoDataUrl: null,

  colorPrimario: '#6A1A23',
  colorSecundario: '#C5A059',
  tema: 'claro',
  tipografia: 'clasica',

  heroFotos: [],
  heroOverlay: 55,
  heroAltura: 'media',
  heroTextoBoton: 'Portal del hermano',

  secciones: SECCIONES_POR_DEFECTO,

  historia:
    'Escribe aquí la historia de tu hermandad: fundación, titulares, sede canónica y todo lo que quieras contar a quien visite la web.',
  titulares: [
    { id: 'tit-1', nombre: 'Ntro. Padre Jesús', fotoDataUrl: null, descripcion: 'Sagrada imagen del Señor.' },
    { id: 'tit-2', nombre: 'María Santísima', fotoDataUrl: null, descripcion: 'Bendita imagen de la Virgen.' },
  ],
  cultos: [
    { id: 'culto-1', titulo: 'Cultos de Cuaresma', detalle: 'Quinario y función principal en la sede canónica.' },
    { id: 'culto-2', titulo: 'Estación de penitencia', detalle: 'Salida procesional en la tarde del Viernes Santo.' },
  ],
  galeria: [],
  noticias: [
    { id: 'not-1', titulo: 'Convocatoria de Cabildo General', fecha: '2026-02-02', resumen: 'Por orden del Hermano Mayor se convoca a todos los hermanos al Cabildo General.', fotoDataUrl: null, publicada: true },
  ],
  paginas: [
    {
      id: 'pag-1', icono: '✝️', antetitulo: 'La Hermandad', titulo: 'Sagrados Titulares',
      entradilla: 'Nuestros Sagrados Titulares.',
      parrafos: [{ id: 'p-1', subtitulo: 'Historia de la imagen', texto: 'Describe aquí a los titulares de tu hermandad.' }],
      fotos: [],
    },
  ],
  boletines: [],
  mostrarActualidad: false,

  email: '',
  telefono: '',
  direccion: '',
  mapaUrl: '',
  redes: [],

  textoPie: '',
}

/** Convierte un texto en un slug válido para la URL (minúsculas, sin acentos, con guiones). */
export function aSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Mezcla lo guardado con los valores por defecto, para que los datos antiguos no pierdan campos nuevos. */
function conDefectos(guardado: Partial<WebPublica> | null): WebPublica {
  if (!guardado) return WEB_PUBLICA_INICIAL
  // Compatibilidad: si venía con una sola foto de portada (modelo anterior),
  // se pasa al array de fotos.
  const heroFotos =
    guardado.heroFotos && guardado.heroFotos.length
      ? guardado.heroFotos
      : (guardado as { heroFotoDataUrl?: string | null }).heroFotoDataUrl
        ? [(guardado as { heroFotoDataUrl?: string }).heroFotoDataUrl as string]
        : []
  // Si los datos son antiguos y no traían las secciones nuevas, se completan.
  const secciones = guardado.secciones && guardado.secciones.length ? guardado.secciones : SECCIONES_POR_DEFECTO
  const tiposPresentes = new Set(secciones.map((s) => s.tipo))
  const seccionesCompletas = [
    ...secciones,
    ...SECCIONES_POR_DEFECTO.filter((s) => !tiposPresentes.has(s.tipo)),
  ]
  return {
    ...WEB_PUBLICA_INICIAL,
    ...guardado,
    heroFotos,
    secciones: seccionesCompletas,
    titulares: guardado.titulares ?? WEB_PUBLICA_INICIAL.titulares,
    cultos: guardado.cultos ?? WEB_PUBLICA_INICIAL.cultos,
    galeria: guardado.galeria ?? [],
    noticias: guardado.noticias ?? WEB_PUBLICA_INICIAL.noticias,
    paginas: guardado.paginas ?? WEB_PUBLICA_INICIAL.paginas,
    boletines: guardado.boletines ?? [],
    redes: guardado.redes ?? [],
  }
}

export function getWebPublica(): WebPublica {
  return conDefectos(leerPersistido<Partial<WebPublica>>(CLAVE_WEB_PUBLICA, WEB_PUBLICA_INICIAL))
}

export function saveWebPublica(web: WebPublica) {
  guardarConAviso(CLAVE_WEB_PUBLICA, web)
}

/** Hook con la web pública y un setter que persiste. */
export function useWebPublica(): [WebPublica, (siguiente: WebPublica) => void] {
  const [web, setWebState] = useState<WebPublica>(() => getWebPublica())

  useEffect(() => {
    function sincronizar() {
      setWebState(getWebPublica())
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  function setWeb(siguiente: WebPublica) {
    setWebState(siguiente)
    saveWebPublica(siguiente)
  }

  return [web, setWeb]
}
