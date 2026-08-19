import type { Hermano } from '../data/hermanos'

/**
 * El escalafón: quién va delante de quién. Es lo más delicado de toda la
 * aplicación, porque un número mal puesto cambia el sitio de alguien en el
 * cortejo y no se nota hasta el día de la salida.
 *
 * Está aquí, aparte de la pantalla, para poder probarlo de verdad.
 *
 * Dos ideas que hay que tener claras:
 *
 * - El **número** es la posición en el escalafón, y se mueve: cuando alguien se
 *   da de baja, todos los de debajo suben uno.
 * - La **antigüedad** es el AÑO en que entró, y no se mueve nunca. No cambia
 *   porque se dé de baja otro.
 *
 * Quien está de baja queda con número 0: fuera de la numeración, pero con su
 * ficha y su historial intactos.
 */

/**
 * Da de baja y recoloca el escalafón. El número del que se va queda libre y
 * todos los de número mayor descienden uno.
 */
export function darDeBajaEnCenso<T extends Pick<Hermano, 'id' | 'estado' | 'numero'>>(
  censo: T[],
  hermanoId: string,
): T[] {
  const actual = censo.find((h) => h.id === hermanoId)
  if (!actual || actual.estado === 'Baja') return censo
  const numBaja = actual.numero
  return censo.map((h) => {
    if (h.id === hermanoId) return { ...h, estado: 'Baja' as const, numero: 0, bajaSolicitada: false }
    // Solo descienden los que están DENTRO de la numeración activa: los de
    // baja ya están fuera (número 0) y no se tocan.
    if (h.estado !== 'Baja' && h.numero > 0 && h.numero > numBaja) return { ...h, numero: h.numero - 1 }
    return h
  })
}

/**
 * Reactiva a quien estaba de baja. Hay dos formas y **no da igual cuál**:
 *
 * - `recuperarAntiguedad = false`: entra con el último número, como uno nuevo.
 *   Vale para quien se fue hace veinte años y vuelve.
 * - `recuperarAntiguedad = true`: vuelve al puesto que le toca por su año de
 *   entrada, y los de debajo descienden uno. Es lo normal en una hermandad
 *   cuando alguien se reincorpora.
 *
 * A igualdad de año se le pone DETRÁS de los que ya están: quien no ha faltado
 * en todos estos años no debe caer por debajo de quien vuelve.
 */
export function reactivarEnCenso<T extends Pick<Hermano, 'id' | 'estado' | 'numero' | 'antiguedad'>>(
  censo: T[],
  hermanoId: string,
  recuperarAntiguedad: boolean,
): T[] {
  const actual = censo.find((h) => h.id === hermanoId)
  if (!actual || actual.estado !== 'Baja') return censo

  if (!recuperarAntiguedad) {
    const siguiente = Math.max(0, ...censo.map((h) => h.numero)) + 1
    return censo.map((h) => (h.id === hermanoId ? { ...h, estado: 'Activo' as const, numero: siguiente } : h))
  }

  const activos = censo
    .filter((h) => h.estado !== 'Baja' && h.numero > 0)
    .sort((a, b) => a.numero - b.numero)
  // Su sitio es delante del primero que entró DESPUÉS que él.
  const detras = activos.find((h) => h.antiguedad > actual.antiguedad)
  const suNumero = detras ? detras.numero : activos.length + 1
  return censo.map((h) => {
    if (h.id === hermanoId) return { ...h, estado: 'Activo' as const, numero: suNumero }
    if (h.estado !== 'Baja' && h.numero >= suNumero) return { ...h, numero: h.numero + 1 }
    return h
  })
}

/**
 * ¿Está la numeración sana? Sirve para comprobarlo en las pruebas y, más
 * adelante, para avisar si una importación o una migración la dejó rota.
 */
export function numeracionSana<T extends Pick<Hermano, 'estado' | 'numero'>>(censo: T[]): boolean {
  const activos = censo.filter((h) => h.estado !== 'Baja').map((h) => h.numero)
  if (activos.some((n) => n <= 0)) return false
  if (new Set(activos).size !== activos.length) return false
  // Sin huecos: del 1 al total, sin saltarse ninguno.
  const ordenados = [...activos].sort((a, b) => a - b)
  return ordenados.every((n, i) => n === i + 1)
}
