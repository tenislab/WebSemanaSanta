import { formatDate } from '../../../lib/format'
/**
 * Hoy como lo escribe una papeleta: «19 sep 2026».
 *
 * Aparte porque la usan la pantalla y tres de las piezas que salieron de ella.
 * Es el mismo formato de texto que llevan las fechas de los recibos, y por lo
 * mismo: así están guardadas desde la primera versión.
 */
export function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtIso(iso: string | null) {
  if (!iso) return '—'
  return formatDate(new Date(`${iso}T00:00:00`))
}
