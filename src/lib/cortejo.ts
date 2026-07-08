import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'
import { esCirio, type Cuerpo, type Tramo } from './tramos'

export type EstadoAsignacion = 'Reservada' | 'Confirmada' | 'Con incidencia' | 'Excede aforo'

export interface Asignacion {
  papeleta: Papeleta
  hermano: Hermano
  /** Tramo en el que queda colocado tras el reparto (puede no ser el que pidió). */
  tramo: Tramo | null
  /** Puesto dentro del tramo (1 = cabeza del tramo). */
  puesto: number
  estado: EstadoAsignacion
}

const ORDEN_CUERPOS: Cuerpo[] = ['Cristo', 'Virgen', 'Único']

function estadoDe(papeleta: Papeleta, incidenciasAbiertas: Set<string>): EstadoAsignacion {
  if (incidenciasAbiertas.has(papeleta.id)) return 'Con incidencia'
  return papeleta.estado === 'Pagada' || papeleta.estado === 'Entregada' ? 'Confirmada' : 'Reservada'
}

interface Candidato {
  papeleta: Papeleta
  hermano: Hermano
}

function candidatosDe(
  papeletas: Papeleta[],
  predicado: (p: Papeleta) => boolean,
  hermanoDe: (id: string) => Hermano | undefined,
): Candidato[] {
  return papeletas
    .filter((p) => predicado(p) && p.estado !== 'Anulada' && p.estado !== 'Renuncia')
    .map((p) => ({ papeleta: p, hermano: hermanoDe(p.hermanoId) }))
    .filter((x): x is Candidato => Boolean(x.hermano))
}

/**
 * Reparto de un cuerpo (Cristo, Virgen o Único). La hermandad define los
 * tramos, y la app los reparte según el tipo:
 *
 *  - Tramos de cirio: automáticos por número. Todos los cirios del cuerpo se
 *    ordenan de mayor a menor número (los modernos delante, tras la cruz de
 *    guía) y se llenan en orden; al llenarse uno empieza el siguiente. Si un
 *    número entra en un cirio lleno, el más bajo de ese tramo baja al
 *    siguiente (efecto cascada).
 *  - Tramos designados (cruz de guía, insignias, varas, presidencia…): por
 *    solicitud. Cada hermano pide un tramo concreto y, entre quienes lo piden,
 *    se lo queda el de menor número (más antigüedad) hasta llenar el aforo.
 *
 * El puesto no se guarda: se recalcula cada vez a partir de las papeletas.
 */
export function repartoDeCuerpo(
  cuerpo: Cuerpo,
  tramos: Tramo[],
  papeletas: Papeleta[],
  hermanoDe: (id: string) => Hermano | undefined,
  incidenciasAbiertas: Set<string>,
): Asignacion[] {
  const tramosCuerpo = tramos.filter((t) => t.cuerpo === cuerpo)
  const out: Asignacion[] = []

  // 1) Tramos designados: cada uno con sus solicitantes, por menor número.
  tramosCuerpo
    .filter((t) => !esCirio(t))
    .forEach((tramo) => {
      const solicitantes = candidatosDe(papeletas, (p) => p.tramoId === tramo.id, hermanoDe).sort(
        (a, b) => a.hermano.numero - b.hermano.numero || a.papeleta.id.localeCompare(b.papeleta.id),
      )
      solicitantes.forEach(({ papeleta, hermano }, i) => {
        const estado: EstadoAsignacion = i >= tramo.capacidad ? 'Excede aforo' : estadoDe(papeleta, incidenciasAbiertas)
        out.push({ papeleta, hermano, tramo, puesto: i + 1, estado })
      })
    })

  // 2) Cirios del cuerpo: un único pool por número (mayor a menor), en cascada.
  const cirios = tramosCuerpo.filter((t) => esCirio(t))
  const idsCirio = new Set(cirios.map((t) => t.id))
  const pool = candidatosDe(papeletas, (p) => p.tramoId !== null && idsCirio.has(p.tramoId), hermanoDe).sort(
    (a, b) => b.hermano.numero - a.hermano.numero || a.papeleta.id.localeCompare(b.papeleta.id),
  )

  let idx = 0
  for (const tramo of cirios) {
    for (let i = 0; i < tramo.capacidad && idx < pool.length; i += 1, idx += 1) {
      const { papeleta, hermano } = pool[idx]
      out.push({ papeleta, hermano, tramo, puesto: i + 1, estado: estadoDe(papeleta, incidenciasAbiertas) })
    }
  }
  const ultimoCirio = cirios[cirios.length - 1] ?? null
  let sobra = 1
  while (idx < pool.length) {
    const { papeleta, hermano } = pool[idx]
    out.push({ papeleta, hermano, tramo: ultimoCirio, puesto: sobra, estado: 'Excede aforo' })
    idx += 1
    sobra += 1
  }
  return out
}

/** Reparto de todo el cortejo: cada cuerpo presente, colocado por número con cascada. */
export function repartoCompleto(
  tramos: Tramo[],
  papeletas: Papeleta[],
  hermanoDe: (id: string) => Hermano | undefined,
  incidenciasAbiertas: Set<string>,
): Asignacion[] {
  const cuerpos = ORDEN_CUERPOS.filter((c) => tramos.some((t) => t.cuerpo === c))
  return cuerpos.flatMap((c) => repartoDeCuerpo(c, tramos, papeletas, hermanoDe, incidenciasAbiertas))
}

/**
 * Agrupa un reparto por el tramo en el que cada hermano ha quedado colocado.
 * Incluye los "Excede aforo" bajo su tramo (para que la tarjeta del tramo
 * pueda avisar); quien consume el mapa filtra por estado si solo quiere los
 * confirmados.
 */
export function repartoPorTramo(asignaciones: Asignacion[]): Map<string, Asignacion[]> {
  const map = new Map<string, Asignacion[]>()
  asignaciones.forEach((a) => {
    if (!a.tramo) return
    const arr = map.get(a.tramo.id) ?? []
    arr.push(a)
    map.set(a.tramo.id, arr)
  })
  return map
}

/** Mapa papeleta.id → su asignación (tramo colocado, puesto, estado). */
export function asignacionPorPapeleta(asignaciones: Asignacion[]): Map<string, Asignacion> {
  const map = new Map<string, Asignacion>()
  asignaciones.forEach((a) => map.set(a.papeleta.id, a))
  return map
}
