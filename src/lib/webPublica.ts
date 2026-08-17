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
export type TipografiaWeb = 'clasica' | 'moderna' | 'elegante'
export type AlturaHero = 'compacta' | 'media' | 'completa'
export type TipoSeccion = 'historia' | 'titulares' | 'cultos' | 'galeria' | 'actualidad' | 'contacto'
export type TipoRed = 'Instagram' | 'Facebook' | 'X' | 'YouTube' | 'TikTok' | 'Web'

export const PLANTILLAS: { id: PlantillaWeb; nombre: string; descripcion: string }[] = [
  { id: 'clasica', nombre: 'Clásica', descripcion: 'Serif, tonos cálidos y aire tradicional cofrade.' },
  { id: 'sobria', nombre: 'Sobria', descripcion: 'Líneas limpias, mucho blanco y tipografía discreta.' },
  { id: 'moderna', nombre: 'Moderna', descripcion: 'Portada a pantalla completa y contraste marcado.' },
]

export const TIPOGRAFIAS: { id: TipografiaWeb; nombre: string; css: string }[] = [
  { id: 'clasica', nombre: 'Clásica (serif)', css: "Georgia, 'Times New Roman', serif" },
  { id: 'moderna', nombre: 'Moderna (sans)', css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'elegante', nombre: 'Elegante', css: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
]

export const SECCIONES_INFO: Record<TipoSeccion, { nombre: string }> = {
  historia: { nombre: 'Historia' },
  titulares: { nombre: 'Titulares' },
  cultos: { nombre: 'Cultos y actos' },
  galeria: { nombre: 'Galería de fotos' },
  actualidad: { nombre: 'Actualidad (comunicados)' },
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

  // Portada
  heroFotoDataUrl: string | null
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
  { tipo: 'actualidad', visible: false },
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

  heroFotoDataUrl: null,
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
  return {
    ...WEB_PUBLICA_INICIAL,
    ...guardado,
    secciones: guardado.secciones && guardado.secciones.length ? guardado.secciones : SECCIONES_POR_DEFECTO,
    titulares: guardado.titulares ?? WEB_PUBLICA_INICIAL.titulares,
    cultos: guardado.cultos ?? WEB_PUBLICA_INICIAL.cultos,
    galeria: guardado.galeria ?? [],
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
