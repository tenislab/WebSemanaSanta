/**
 * DOS APAÑOS DE TEXTO DE LA WEB PÚBLICA.
 *
 * Viven aparte de `piezas.tsx` y no con los componentes porque un fichero que
 * exporta componentes Y funciones rompe el refresco en caliente, y este
 * proyecto se entrega sin un solo aviso de lint.
 */
import { formatDate } from '../../lib/format'

/** Corta por la última palabra entera antes del límite, sin partir a medias. */
export function recorta(texto: string, max: number): string {
  const limpio = texto.trim()
  if (limpio.length <= max) return limpio
  const corte = limpio.slice(0, max)
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[.,;:\s]+$/, '')}…`
}

export function fechaBonita(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : formatDate(d)
}
