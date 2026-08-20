/**
 * Renovar el sitio del cortejo: UNA sola forma de hacerlo.
 *
 * EL PROBLEMA QUE RESUELVE. La renovación estaba escrita dos veces, una en
 * secretaría (Papeletas) y otra en el área del hermano, y las dos se habían
 * ido separando sin que nadie lo notara. Con el precio del «Cirio 1º tramo»
 * subido de 18 € a 20 €:
 *
 *   - El hermano que renovaba desde su móvil pagaba 18 €, porque el área
 *     cogía `sitioAnterior.importe` —el importe del AÑO PASADO— y solo usaba
 *     el precio actual si aquel valía cero.
 *   - El hermano que llamaba a secretaría pagaba 20 €.
 *
 * Los dos en el mismo tramo, pagando distinto, y la hermandad sin manera de
 * enterarse hasta cuadrar la caja. Con la renovación en un solo sitio, las dos
 * vías no pueden volver a separarse: es el mismo código.
 *
 * LA REGLA DEL PRECIO: manda SIEMPRE el precio de hoy. Una renovación no es
 * una prórroga del recibo del año pasado, es una papeleta nueva del mismo
 * sitio. Si la hermandad ha subido el tramo, se cobra lo que vale ahora.
 */
import type { Papeleta } from '../data/papeletas'
import { precioDeTramo, type Tramo } from './tramos'

export interface DatosRenovacion {
  hermanoId: string
  /** El tramo en el que sale, el mismo del año pasado. */
  tramoId: string
  anio: number
  tramos: Tramo[]
  precioBase: number
  /** Para la papeleta nueva, si no había ninguna de este año. */
  nuevoId: () => string
  hoy: () => string
}

/** Lo que vale ese tramo HOY. Nunca lo que costó el año pasado. */
export function importeDeRenovacion(tramoId: string, tramos: Tramo[], precioBase: number): number {
  return precioDeTramo(tramos.find((t) => t.id === tramoId), precioBase)
}

/**
 * Devuelve la lista de papeletas con la renovación aplicada.
 *
 * Reutiliza la papeleta del año si ya existe, para no dejar dos filas del
 * mismo hermano en la misma campaña.
 *
 * `opcion: null` es importante: si tenía una papeleta personalizada (mantilla,
 * simbólica) y ahora sale en un tramo, dejar la opción puesta la haría salir a
 * la vez en el cortejo Y como mantilla, con el documento impreso diciendo las
 * dos cosas.
 */
export function conRenovacion(papeletas: Papeleta[], datos: DatosRenovacion): Papeleta[] {
  const { hermanoId, tramoId, anio, tramos, precioBase, nuevoId, hoy } = datos
  const importe = importeDeRenovacion(tramoId, tramos, precioBase)

  const actual = papeletas.find(
    (p) => p.hermanoId === hermanoId && p.anio === anio && p.estado !== 'Anulada',
  )
  if (actual) {
    return papeletas.map((p) =>
      p.id === actual.id
        ? { ...p, tramoId, opcion: null, estado: 'Asignada' as const, importe, pagoComunicado: null }
        : p,
    )
  }

  const nueva: Papeleta = {
    id: nuevoId(),
    numero: Math.max(0, ...papeletas.map((p) => p.numero)) + 1,
    hermanoId,
    anio,
    tramoId,
    importe,
    estado: 'Asignada',
    fechaSolicitud: hoy(),
  }
  return [nueva, ...papeletas]
}
