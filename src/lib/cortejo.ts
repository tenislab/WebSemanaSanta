import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'
import type { Tramo } from './tramos'

export type EstadoAsignacion = 'Reservada' | 'Confirmada' | 'Con incidencia' | 'Excede aforo'

export interface Asignacion {
  papeleta: Papeleta
  hermano: Hermano
  /** Puesto dentro del tramo elegido: 1 = el hermano con el número más bajo. */
  puesto: number
  estado: EstadoAsignacion
}

/**
 * Reparto derivado de un tramo: el hermano elige el tramo (cruz de guía,
 * vara, cirio…) al sacar su papeleta, y el puesto dentro de ese tramo se
 * calcula solo, ordenando por número de hermano (a menor número, más cerca
 * de la cabeza del tramo). Si el tramo recibe más papeletas de las que
 * caben, las que sobran quedan marcadas como "Excede aforo" en vez de
 * generar una cola: la Papeleta es la única fuente de verdad, este reparto
 * no se guarda en ningún sitio, se recalcula cada vez.
 */
export function repartoDeTramo(
  tramo: Tramo,
  papeletas: Papeleta[],
  hermanoDe: (id: string) => Hermano | undefined,
  incidenciasAbiertas: Set<string>,
): Asignacion[] {
  const candidatos = papeletas
    .filter((p) => p.tramoId === tramo.id && p.estado !== 'Anulada')
    .map((p) => ({ papeleta: p, hermano: hermanoDe(p.hermanoId) }))
    .filter((x): x is { papeleta: Papeleta; hermano: Hermano } => Boolean(x.hermano))
    .sort((a, b) => a.hermano.numero - b.hermano.numero || a.papeleta.id.localeCompare(b.papeleta.id))

  return candidatos.map((c, i) => {
    const puesto = i + 1
    const confirmada = c.papeleta.estado === 'Pagada' || c.papeleta.estado === 'Entregada'
    let estado: EstadoAsignacion = puesto > tramo.capacidad ? 'Excede aforo' : confirmada ? 'Confirmada' : 'Reservada'
    if (estado !== 'Excede aforo' && incidenciasAbiertas.has(c.papeleta.id)) estado = 'Con incidencia'
    return { papeleta: c.papeleta, hermano: c.hermano, puesto, estado }
  })
}
