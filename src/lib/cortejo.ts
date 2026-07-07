import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'
import { capacidadDe, type Tramo } from './tramos'

export type EstadoAsignacion = 'Reservada' | 'Confirmada' | 'En cola' | 'Con incidencia'

export interface Asignacion {
  papeleta: Papeleta
  hermano: Hermano
  estado: EstadoAsignacion
}

/**
 * Reparto derivado de un tramo, ordenado por antigüedad ascendente: los
 * primeros `capacidad` puestos quedan Reservados o Confirmados, el resto
 * queda En cola. Papeleta es la única fuente de verdad — esta cola no se
 * guarda en ningún sitio, se recalcula cada vez a partir de las papeletas
 * activas de ese tramo.
 */
export function repartoDeTramo(
  tramo: Tramo,
  papeletas: Papeleta[],
  hermanoDe: (id: string) => Hermano | undefined,
  incidenciasAbiertas: Set<string>,
): Asignacion[] {
  const candidatos = papeletas
    .filter((p) => p.tramo === tramo.nombre && p.estado !== 'Anulada')
    .map((p) => ({ papeleta: p, hermano: hermanoDe(p.hermanoId) }))
    .filter((x): x is { papeleta: Papeleta; hermano: Hermano } => Boolean(x.hermano))
    .sort((a, b) => a.hermano.antiguedad - b.hermano.antiguedad)

  const capacidad = capacidadDe(tramo)

  return candidatos.map((c, i) => {
    const confirmada = c.papeleta.estado === 'Pagada' || c.papeleta.estado === 'Entregada'
    let estado: EstadoAsignacion = confirmada ? 'Confirmada' : i < capacidad ? 'Reservada' : 'En cola'
    if (estado !== 'En cola' && incidenciasAbiertas.has(c.papeleta.id)) estado = 'Con incidencia'
    return { papeleta: c.papeleta, hermano: c.hermano, estado }
  })
}

export function ocupacionDe(reparto: Asignacion[]) {
  return reparto.filter((a) => a.estado !== 'En cola').length
}
