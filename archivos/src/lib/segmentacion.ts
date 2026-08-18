import type { Hermano } from '../data/hermanos'

/**
 * Segmentación de hermanos por criterios, para mandar comunicados solo a quien
 * toca (p. ej. «activos, mayores de edad, con cuota pendiente»). Se calcula al
 * vuelo sobre el censo; no guarda nada.
 */

export interface CriteriosSegmento {
  estado: 'Todos' | 'Activo' | 'Nuevo' | 'Baja'
  cuota: 'Todos' | 'AlDia' | 'Pendiente'
  /** Edad: mayores o menores de 18. */
  edad: 'Todos' | 'Mayores' | 'Menores'
  /** Etiqueta concreta, o '' para cualquiera. */
  etiqueta: string
  /** Solo quien tenga correo (para envíos por email). */
  soloConEmail: boolean
}

export const CRITERIOS_POR_DEFECTO: CriteriosSegmento = {
  estado: 'Activo',
  cuota: 'Todos',
  edad: 'Todos',
  etiqueta: '',
  soloConEmail: true,
}

/** Edad a día de hoy a partir de la fecha de nacimiento (o null si no hay). */
export function edadDe(fechaNacimiento: string | undefined, hoy = new Date()): number | null {
  if (!fechaNacimiento) return null
  const n = new Date(`${fechaNacimiento}T00:00:00`)
  if (Number.isNaN(n.getTime())) return null
  let e = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e -= 1
  return e
}

/** Hermanos que cumplen los criterios. */
export function filtrarSegmento(hermanos: Hermano[], c: CriteriosSegmento): Hermano[] {
  return hermanos.filter((h) => {
    // Las bajas nunca reciben salvo que se pidan explícitamente.
    if (c.estado === 'Todos' ? h.estado === 'Baja' : h.estado !== c.estado) return false
    if (c.cuota === 'AlDia' && !h.cuotaAlDia) return false
    if (c.cuota === 'Pendiente' && h.cuotaAlDia) return false
    if (c.edad !== 'Todos') {
      const e = edadDe(h.fechaNacimiento)
      if (e == null) return false
      if (c.edad === 'Mayores' && e < 18) return false
      if (c.edad === 'Menores' && e >= 18) return false
    }
    if (c.etiqueta && !(h.etiquetas ?? []).includes(c.etiqueta)) return false
    if (c.soloConEmail && !(h.email && h.email.includes('@'))) return false
    return true
  })
}

/** Etiqueta legible del segmento, para mostrarla como destinatario del comunicado. */
export function etiquetaSegmento(c: CriteriosSegmento): string {
  const partes: string[] = [
    c.estado === 'Todos' ? 'Hermanos' : c.estado === 'Activo' ? 'Activos' : c.estado === 'Nuevo' ? 'Nuevos' : 'Bajas',
  ]
  if (c.edad === 'Mayores') partes.push('mayores de edad')
  if (c.edad === 'Menores') partes.push('menores de edad')
  if (c.cuota === 'AlDia') partes.push('al día de cuota')
  if (c.cuota === 'Pendiente') partes.push('con cuota pendiente')
  if (c.etiqueta) partes.push(`etiqueta «${c.etiqueta}»`)
  return partes.join(' · ')
}
