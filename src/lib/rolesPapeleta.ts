import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'
import type { Tramo } from './tramos'
import type { OpcionPapeleta } from './opcionesPapeleta'

/**
 * Los roles que salen SOLOS de la papeleta que cada uno saca: quien va en el
 * tramo «Costaleros del paso de misterio» es costalero, y quien saca la opción
 * «Acólito ciriales» es acólito. Hasta ahora esas etiquetas se ponían a mano,
 * una por una, y en un censo de mil hermanos eso no lo mantiene nadie.
 *
 * **Se calculan, no se guardan.** Escribir la etiqueta al asignar la papeleta
 * obligaría a enganchar los diez sitios donde una papeleta cambia de estado
 * (asignar, reasignar, anular, renunciar, cambiar de opción…), y en cuanto se
 * escapara uno el censo quedaría diciendo que alguien es costalero de un año en
 * el que no salió. Derivándolas, no pueden descuadrarse nunca.
 *
 * Ojo con lo que NO son: **un rol de papeleta no da permisos en el panel**. Los
 * permisos siguen siendo de `personal`, por cargo. Mezclar las dos cosas sería
 * un agujero: un costalero acabaría viendo la tesorería porque sacó su
 * papeleta.
 */

/** Los estados en los que la papeleta cuenta: hay sitio de verdad. */
const CUENTA = new Set<Papeleta['estado']>(['Asignada', 'Pagada', 'Entregada'])

/**
 * Las etiquetas que le tocan a un hermano por sus papeletas de ese año.
 *
 * Se mira solo el año pedido: ser costalero en 2024 no te hace costalero en
 * 2027, y para el comunicado de este año lo que importa es quién sale ahora.
 */
export function etiquetasAutomaticas(
  hermanoId: string,
  papeletas: Papeleta[],
  tramos: Pick<Tramo, 'id' | 'etiqueta'>[],
  opciones: Pick<OpcionPapeleta, 'nombre' | 'etiqueta'>[],
  anio: number,
): string[] {
  const porTramo = new Map(tramos.filter((t) => t.etiqueta?.trim()).map((t) => [t.id, t.etiqueta as string]))
  const porOpcion = new Map(opciones.filter((o) => o.etiqueta?.trim()).map((o) => [o.nombre, o.etiqueta as string]))
  const salida = new Set<string>()
  for (const p of papeletas) {
    if (p.hermanoId !== hermanoId || p.anio !== anio || !CUENTA.has(p.estado)) continue
    const porT = p.tramoId ? porTramo.get(p.tramoId) : undefined
    if (porT) salida.add(porT)
    const porO = p.opcion ? porOpcion.get(p.opcion) : undefined
    if (porO) salida.add(porO)
  }
  return [...salida].sort((a, b) => a.localeCompare(b, 'es'))
}

/**
 * Las etiquetas de un hermano: las que le puso la hermandad a mano, más las
 * que le tocan por su papeleta. Sin repetir, y en orden.
 *
 * Esto es lo que hay que usar en todas partes (segmentar, filtrar, listar): si
 * un sitio lee `hermano.etiquetas` a pelo, ese sitio se queda sin los roles
 * automáticos y empieza a dar resultados distintos que los demás.
 */
export function etiquetasDe(hermano: Pick<Hermano, 'etiquetas'>, automaticas: string[]): string[] {
  const todas = new Set([...(hermano.etiquetas ?? []), ...automaticas])
  return [...todas].sort((a, b) => a.localeCompare(b, 'es'))
}

/**
 * Un índice hermano → etiquetas automáticas, para no recalcularlo en cada fila
 * de una tabla de mil. Se hace una pasada por las papeletas y ya.
 */
export function indiceRoles(
  papeletas: Papeleta[],
  tramos: Pick<Tramo, 'id' | 'etiqueta'>[],
  opciones: Pick<OpcionPapeleta, 'nombre' | 'etiqueta'>[],
  anio: number,
): Map<string, string[]> {
  const porTramo = new Map(tramos.filter((t) => t.etiqueta?.trim()).map((t) => [t.id, t.etiqueta as string]))
  const porOpcion = new Map(opciones.filter((o) => o.etiqueta?.trim()).map((o) => [o.nombre, o.etiqueta as string]))
  const acumulado = new Map<string, Set<string>>()
  for (const p of papeletas) {
    if (p.anio !== anio || !CUENTA.has(p.estado)) continue
    const etiquetas: string[] = []
    const porT = p.tramoId ? porTramo.get(p.tramoId) : undefined
    if (porT) etiquetas.push(porT)
    const porO = p.opcion ? porOpcion.get(p.opcion) : undefined
    if (porO) etiquetas.push(porO)
    if (etiquetas.length === 0) continue
    const set = acumulado.get(p.hermanoId) ?? new Set<string>()
    etiquetas.forEach((e) => set.add(e))
    acumulado.set(p.hermanoId, set)
  }
  const salida = new Map<string, string[]>()
  acumulado.forEach((set, id) => salida.set(id, [...set].sort((a, b) => a.localeCompare(b, 'es'))))
  return salida
}

/** Las etiquetas que alguna vez se ponen solas, para poder distinguirlas en la interfaz. */
export function etiquetasQueSonAutomaticas(
  tramos: Pick<Tramo, 'etiqueta'>[],
  opciones: Pick<OpcionPapeleta, 'etiqueta'>[],
): string[] {
  const todas = new Set(
    [...tramos, ...opciones].map((x) => x.etiqueta?.trim()).filter((x): x is string => !!x),
  )
  return [...todas].sort((a, b) => a.localeCompare(b, 'es'))
}
