import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'
import { cuerposPresentes, esAutomatico, gruposAutomaticos, type Cuerpo, type Tramo } from './tramos'

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

function estadoDe(papeleta: Papeleta, incidenciasAbiertas: Set<string>): EstadoAsignacion {
  if (incidenciasAbiertas.has(papeleta.id)) return 'Con incidencia'
  return papeleta.estado === 'Pagada' || papeleta.estado === 'Entregada' ? 'Confirmada' : 'Reservada'
}

interface Candidato {
  papeleta: Papeleta
  hermano: Hermano
}

/**
 * ¿PUEDE ESTA PERSONA SALIR EN EL CORTEJO?
 *
 * Es la regla del reparto, y está aquí arriba —exportada— porque la tiene que
 * usar también la PANTALLA que asigna sitio. Teniéndola solo dentro del
 * reparto, la pantalla ofrecía gente a la que el reparto luego descartaba, y
 * eso no da error: da una papeleta cobrada que no aparece en ningún tramo ni
 * en el orden impreso.
 *
 * Con los de baja ya se había caído en ello y se arregló. Con los CIVILES no:
 * el administrativo contratado seguía saliendo en la lista de «asignar a un
 * tramo», y no está en el censo para hacer estación de penitencia. Se le
 * emitía su papeleta, se le cobraba, y el día del reparto no estaba.
 */
export function puedeSalirEnElCortejo(h: { estado: string; civil?: boolean } | undefined | null): boolean {
  return Boolean(h) && h!.estado !== 'Baja' && !h!.civil
}

/**
 * EL NÚMERO A EFECTOS DE ORDEN, CON EL 0 EN SU SITIO.
 *
 * El 0 no es «el número más bajo»: es «todavía no tiene número». Lo dice
 * `censo.ts`, cuyo `enElEscalafon()` deja fuera de la numeración a quien lleva
 * 0, y pasa de verdad —«una ficha recién importada puede llegar con 0 mientras
 * se termina de numerar».
 *
 * Ordenando por el número a secas, ese hermano salía EN CABEZA de un tramo por
 * solicitud, por delante del nº 1 que lleva cuarenta años esperando ese sitio.
 * Sin error: solo un orden impreso que nadie cuadra hasta el día de la salida.
 *
 * Puesto al final de la escala, las dos ordenaciones dicen lo mismo desde sus
 * dos lados: por solicitud manda la antigüedad y sin número no hay antigüedad
 * que alegar, así que va detrás; por número los modernos van delante y el que
 * no tiene número es el más nuevo de todos, así que va primero.
 *
 * Un número grande y FINITO, no `Infinity`: dos hermanos sin número darían
 * `Infinity - Infinity`, que es `NaN`, y una comparación que devuelve `NaN`
 * deja la lista en cualquier orden. `Papeletas.tsx` usa `|| Infinity` para
 * imprimir, donde nunca coinciden dos.
 */
const SIN_NUMERO = Number.MAX_SAFE_INTEGER
function paraOrdenar(numero: number): number {
  return numero > 0 ? numero : SIN_NUMERO
}

function candidatosDe(
  papeletas: Papeleta[],
  predicado: (p: Papeleta) => boolean,
  hermanoDe: (id: string) => Hermano | undefined,
): Candidato[] {
  const candidatos = papeletas
    .filter((p) => predicado(p) && p.estado !== 'Anulada' && p.estado !== 'Renuncia')
    .map((p) => ({ papeleta: p, hermano: hermanoDe(p.hermanoId) }))
    // Los hermanos de baja no salen en el cortejo: si se quedaran, además, su
    // número 0 los pondría los primeros del reparto y quitarían sitio a los
    // activos. Y los civiles tampoco: están en el censo para trabajar en la
    // hermandad, no para hacer la estación de penitencia, y llevan número 0
    // por lo mismo — se colarían en cabeza del reparto.
    .filter((x): x is Candidato => puedeSalirEnElCortejo(x.hermano))
  // Un hermano cuenta una sola vez aunque, por un error de datos o una
  // resincronización, tenga dos papeletas activas: si no, ocuparía dos
  // puestos y desplazaría al resto (o dispararía un falso "Excede aforo").
  const vistos = new Set<string>()
  return candidatos.filter((c) => {
    if (vistos.has(c.hermano.id)) return false
    vistos.add(c.hermano.id)
    return true
  })
}

/**
 * Reparto de un cuerpo del cortejo. La hermandad define los tramos y elige
 * cómo se llena cada uno:
 *
 *  - Reparto por número ('numero', el comportamiento clásico de los cirios):
 *    automático. Los tramos del mismo tipo dentro del cuerpo forman un grupo
 *    (Cirio 1º/2º cascadan entre sí; unos «Penitente 1º/2º» irían aparte);
 *    los hermanos del grupo se ordenan de mayor a menor número (los modernos
 *    delante, tras la cruz de guía) y se llenan en orden; al llenarse un
 *    tramo empieza el siguiente. Si un número entra en un tramo lleno, el
 *    más bajo de ese tramo baja al siguiente (efecto cascada).
 *  - Reparto por solicitud ('solicitud'): cada hermano pide el tramo
 *    concreto y, entre quienes lo piden, se lo queda el de menor número
 *    (más antigüedad) hasta llenar el aforo.
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

  // 1) Tramos por solicitud: cada uno con sus solicitantes, por menor número.
  tramosCuerpo
    .filter((t) => !esAutomatico(t))
    .forEach((tramo) => {
      const solicitantes = candidatosDe(papeletas, (p) => p.tramoId === tramo.id, hermanoDe).sort(
        (a, b) => paraOrdenar(a.hermano.numero) - paraOrdenar(b.hermano.numero)
          || a.papeleta.id.localeCompare(b.papeleta.id),
      )
      solicitantes.forEach(({ papeleta, hermano }, i) => {
        const estado: EstadoAsignacion = i >= tramo.capacidad ? 'Excede aforo' : estadoDe(papeleta, incidenciasAbiertas)
        out.push({ papeleta, hermano, tramo, puesto: i + 1, estado })
      })
    })

  // 2) Tramos por número: un pool por grupo (mayor a menor número), en cascada.
  gruposAutomaticos(tramosCuerpo).forEach(({ tramos: grupo }) => {
    const idsGrupo = new Set(grupo.map((t) => t.id))
    const pool = candidatosDe(papeletas, (p) => p.tramoId !== null && idsGrupo.has(p.tramoId), hermanoDe).sort(
      (a, b) => paraOrdenar(b.hermano.numero) - paraOrdenar(a.hermano.numero)
        || a.papeleta.id.localeCompare(b.papeleta.id),
    )

    let idx = 0
    for (const tramo of grupo) {
      for (let i = 0; i < tramo.capacidad && idx < pool.length; i += 1, idx += 1) {
        const { papeleta, hermano } = pool[idx]
        out.push({ papeleta, hermano, tramo, puesto: i + 1, estado: estadoDe(papeleta, incidenciasAbiertas) })
      }
    }
    const ultimoTramo = grupo[grupo.length - 1] ?? null
    // Los que exceden aforo se numeran a continuación de los puestos reales
    // del último tramo (no desde 1), para que no aparezcan dos "puesto 1" en
    // el mismo tramo en el listado.
    let sobra = (ultimoTramo?.capacidad ?? 0) + 1
    while (idx < pool.length) {
      const { papeleta, hermano } = pool[idx]
      out.push({ papeleta, hermano, tramo: ultimoTramo, puesto: sobra, estado: 'Excede aforo' })
      idx += 1
      sobra += 1
    }
  })
  return out
}

/**
 * Reparto de todo el cortejo. El orden de los cuerpos es el de desfile: el
 * orden en que aparecen en la lista de tramos que configuró la hermandad.
 */
export function repartoCompleto(
  tramos: Tramo[],
  papeletas: Papeleta[],
  hermanoDe: (id: string) => Hermano | undefined,
  incidenciasAbiertas: Set<string>,
): Asignacion[] {
  return cuerposPresentes(tramos).flatMap((c) => repartoDeCuerpo(c, tramos, papeletas, hermanoDe, incidenciasAbiertas))
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
