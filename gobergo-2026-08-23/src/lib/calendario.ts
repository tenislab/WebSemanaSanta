import type { TipoEvento } from '../data/eventos'

/**
 * Utilidades del calendario. Van en lib y no en el componente para que el
 * archivo del componente exporte solo el componente (y el recargado en
 * caliente de Vite siga funcionando).
 */

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Color del punto según el tipo de acto. */
export function claseTipo(tipo: TipoEvento): string {
  if (tipo === 'Culto') return 'evento-tipo--culto'
  if (tipo === 'Salida') return 'evento-tipo--salida'
  if (tipo === 'Cabildo') return 'evento-tipo--cabildo'
  if (tipo === 'Caridad') return 'evento-tipo--caridad'
  return 'evento-tipo--otro'
}

/** Días del mes en una rejilla de semanas que empieza en lunes (null = hueco). */
export function rejillaDelMes(anio: number, mes: number): (number | null)[] {
  const primero = new Date(anio, mes, 1).getDay()
  // getDay() da 0 para domingo; aquí la semana empieza en lunes.
  const offset = (primero + 6) % 7
  const dias = new Date(anio, mes + 1, 0).getDate()
  const celdas: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= dias; d++) celdas.push(d)
  return celdas
}

export function iso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function fechaLarga(f: string): string {
  const d = new Date(`${f}T00:00:00`)
  if (Number.isNaN(d.getTime())) return f
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
