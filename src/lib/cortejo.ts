import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'
import type { Cuerpo, Tramo } from './tramos'

export type EstadoAsignacion = 'Reservada' | 'Confirmada' | 'Con incidencia'

export interface Asignacion {
  papeleta: Papeleta
  hermano: Hermano
  /** Tramo que le corresponde por su puesto en el reparto, o null si supera el aforo total del cuerpo. */
  tramo: Tramo | null
  /** Puesto que ocupa dentro de su cuerpo: 1 = justo detrás de la cruz de guía. */
  puesto: number
  estado: EstadoAsignacion
}

/**
 * Reparto derivado de un cuerpo completo (Cristo, Virgen o Único): ordena a
 * todos los hermanos con papeleta activa en ese cuerpo por su número de
 * hermano (a menor número, más cerca de la cruz de guía) y los reparte por
 * los tramos configurados según el aforo de cada uno, en su orden de
 * desfile. La Papeleta es la única fuente de verdad — el tramo no se guarda
 * en ningún sitio, se recalcula cada vez a partir del censo y de las
 * papeletas activas de ese cuerpo.
 */
export function repartoDeCuerpo(
  cuerpo: Cuerpo,
  papeletas: Papeleta[],
  hermanoDe: (id: string) => Hermano | undefined,
  tramosDelCuerpo: Tramo[],
  incidenciasAbiertas: Set<string>,
): Asignacion[] {
  const candidatos = papeletas
    .filter((p) => p.cuerpo === cuerpo && p.estado !== 'Anulada')
    .map((p) => ({ papeleta: p, hermano: hermanoDe(p.hermanoId) }))
    .filter((x): x is { papeleta: Papeleta; hermano: Hermano } => Boolean(x.hermano))
    .sort((a, b) => a.hermano.numero - b.hermano.numero || a.papeleta.id.localeCompare(b.papeleta.id))

  return candidatos.map((c, i) => {
    const puesto = i + 1
    const tramo = tramoDelPuesto(puesto, tramosDelCuerpo)
    const confirmada = c.papeleta.estado === 'Pagada' || c.papeleta.estado === 'Entregada'
    let estado: EstadoAsignacion = confirmada ? 'Confirmada' : 'Reservada'
    if (incidenciasAbiertas.has(c.papeleta.id)) estado = 'Con incidencia'
    return { papeleta: c.papeleta, hermano: c.hermano, tramo, puesto, estado }
  })
}

/** A qué tramo corresponde un puesto (1 = primero), según el aforo acumulado de cada tramo en orden. */
function tramoDelPuesto(puesto: number, tramosDelCuerpo: Tramo[]): Tramo | null {
  let acumulado = 0
  for (const t of tramosDelCuerpo) {
    acumulado += t.capacidad
    if (puesto <= acumulado) return t
  }
  return null
}
