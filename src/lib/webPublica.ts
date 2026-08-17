import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'

/**
 * Web pública de la hermandad, creada desde la propia app. La hermandad elige
 * una de tres plantillas, la activa/desactiva, personaliza el enlace (slug) y
 * edita el contenido. La web tiene un botón «Entrar» que lleva al portal del
 * hermano de la app (/hermano). Todo se guarda en el navegador (localStorage)
 * y, más adelante, en una tabla propia de Supabase.
 */

export type PlantillaWeb = 'clasica' | 'sobria' | 'moderna'

export const PLANTILLAS: { id: PlantillaWeb; nombre: string; descripcion: string }[] = [
  { id: 'clasica', nombre: 'Clásica', descripcion: 'Serif, tonos cálidos y aire tradicional cofrade.' },
  { id: 'sobria', nombre: 'Sobria', descripcion: 'Líneas limpias, mucho blanco y tipografía discreta.' },
  { id: 'moderna', nombre: 'Moderna', descripcion: 'Portada a pantalla completa y contraste marcado.' },
]

export interface CultoWeb {
  id: string
  titulo: string
  detalle: string
}

export interface WebPublica {
  publicada: boolean
  plantilla: PlantillaWeb
  /** Parte final del enlace: …/w/<slug> */
  slug: string
  titulo: string
  lema: string
  historia: string
  fotoPortadaDataUrl: string | null
  colorPrimario: string
  email: string
  telefono: string
  direccion: string
  cultos: CultoWeb[]
}

export const CLAVE_WEB_PUBLICA = 'cabildo-web-publica'

export const WEB_PUBLICA_INICIAL: WebPublica = {
  publicada: false,
  plantilla: 'clasica',
  slug: 'mi-hermandad',
  titulo: '',
  lema: 'Fe, tradición y caridad',
  historia:
    'Escribe aquí la historia de tu hermandad: fundación, titulares, sede canónica y todo lo que quieras contar a quien visite la web.',
  fotoPortadaDataUrl: null,
  colorPrimario: '#6A1A23',
  email: '',
  telefono: '',
  direccion: '',
  cultos: [
    { id: 'culto-1', titulo: 'Cultos de Cuaresma', detalle: 'Quinario y función principal en la sede canónica.' },
    { id: 'culto-2', titulo: 'Estación de penitencia', detalle: 'Salida procesional en la tarde del Viernes Santo.' },
  ],
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

export function getWebPublica(): WebPublica {
  return leerPersistido<WebPublica>(CLAVE_WEB_PUBLICA, WEB_PUBLICA_INICIAL)
}

export function saveWebPublica(web: WebPublica) {
  localStorage.setItem(CLAVE_WEB_PUBLICA, JSON.stringify(web))
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
