import type { Cuota } from '../data/cuotas'
import { esAvisado } from '../data/cuotas'
import type { Hermano } from '../data/hermanos'
import { ejercicioDe } from './cuotasEmision'

/**
 * ¿ESTE HERMANO TIENE LA CUOTA EN ORDEN?
 *
 * Llegó dicho así: «las cuotas no se ponen en condiciones, no puedes ver si
 * alguien tiene la cuota en orden».
 *
 * Y es cierto: Cuotas enseña RECIBOS. Un recibo por fila, con su número y su
 * estado. Eso vale para cuadrar el banco y no vale para nada más, porque la
 * pregunta que se hace en una hermandad no es «¿cómo está el recibo 1048?»
 * sino «¿está Fulano al corriente?» —al repartir papeletas, al montar el
 * cortejo, al atender el mostrador—. Y esa no se podía contestar:
 *
 *   · un hermano con TRES recibos aparecía tres veces, sin sumar;
 *   · un hermano SIN NINGÚN recibo emitido no aparecía en absoluto, así que
 *     el que peor está —el que no se le ha cobrado nunca— era invisible;
 *   · y con cero recibos emitidos, la pantalla entera se quedaba vacía, que
 *     es exactamente la captura que llegó: «0 recibos», tabla en blanco, y
 *     cinco hermanos en el censo.
 *
 * Esto le da la vuelta: una fila por HERMANO, con lo que debe y desde cuándo.
 * Es puro para poder probar aparte el único sitio donde se puede mentir con
 * dinero: quién sale como al día y quién no.
 */

/** Las cuatro situaciones en las que puede estar un hermano. */
export type SituacionCuota =
  /** Se le ha emitido y no debe nada. */
  | 'alDia'
  /** Tiene recibos sin cobrar (pendientes, en mora o devueltos). */
  | 'debe'
  /** No se le ha emitido NINGÚN recibo del ejercicio. No es que esté al día: es que no se le ha cobrado. */
  | 'sinEmitir'
  /** No le toca pagar: de baja, o hermano civil. */
  | 'noAplica'

export interface SituacionDeHermano {
  hermano: Hermano
  situacion: SituacionCuota
  /** Recibos del ejercicio que se mira. */
  recibosDelEjercicio: number
  /** Lo que debe del ejercicio en curso. */
  deudaDelEjercicio: number
  /** Lo que debe en total, de este año y de los anteriores. */
  deudaTotal: number
  /** Cuánto de esa deuda viene de ejercicios pasados. */
  deudaAtrasada: number
  /** Ha avisado de que ya ha pagado y falta confirmarlo en el banco. */
  avisa: boolean
  /** El recibo más viejo sin cobrar, para saber desde cuándo arrastra. */
  desde: number | null
}

const SIN_COBRAR = new Set(['Pendiente', 'En mora', 'Devuelta'])

/** Los que no pagan cuota: los de baja y los civiles. Es lo que significa ser civil. */
export function leTocaPagar(h: Hermano): boolean {
  return h.estado !== 'Baja' && !h.civil
}

/**
 * La situación de UN hermano en un ejercicio.
 *
 * La deuda se mira de TODOS los años, no solo del ejercicio: una cuota de 2025
 * sin cobrar se sigue debiendo en 2027, y un hermano con dos años atrasados y
 * el de este año pagado no está al corriente por mucho que el recibo de este
 * año esté en verde.
 */
export function situacionDeHermano(
  cuotas: Cuota[],
  hermano: Hermano,
  ejercicio: number,
): SituacionDeHermano {
  const suyas = cuotas.filter((c) => c.hermanoId === hermano.id)
  const sinCobrar = suyas.filter((c) => SIN_COBRAR.has(c.estado))
  const delEjercicio = suyas.filter((c) => ejercicioDe(c) === ejercicio)
  const deudaTotal = redondear(sinCobrar.reduce((n, c) => n + c.importe, 0))
  const deudaDelEjercicio = redondear(
    sinCobrar.filter((c) => ejercicioDe(c) === ejercicio).reduce((n, c) => n + c.importe, 0),
  )
  const anios = sinCobrar.map(ejercicioDe).filter((a): a is number => a != null)

  const situacion: SituacionCuota = !leTocaPagar(hermano)
    ? 'noAplica'
    : deudaTotal > 0
      ? 'debe'
      /*
       * Y OJO AQUÍ: sin recibos del ejercicio NO está al día, está «sin
       * emitir». Es la diferencia entre «ya ha pagado» y «no se le ha pedido
       * nada», y confundirlas es dar por bueno un censo entero al que no se le
       * ha cobrado. Es el caso de la captura: cero recibos y todo el mundo
       * saliendo en verde sería mentira.
       */
      : delEjercicio.length === 0
        ? 'sinEmitir'
        : 'alDia'

  return {
    hermano,
    situacion,
    recibosDelEjercicio: delEjercicio.length,
    deudaDelEjercicio,
    deudaTotal,
    deudaAtrasada: redondear(deudaTotal - deudaDelEjercicio),
    avisa: suyas.some(esAvisado),
    desde: anios.length ? Math.min(...anios) : null,
  }
}

/** Redondeo a céntimos: sumar decimales en coma flotante deja 59,999999999. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

/** La situación de todo el censo, con el que peor está primero. */
export function situacionDeTodos(
  cuotas: Cuota[],
  hermanos: Hermano[],
  ejercicio: number,
): SituacionDeHermano[] {
  const ORDEN: Record<SituacionCuota, number> = { debe: 0, sinEmitir: 1, alDia: 2, noAplica: 3 }
  return hermanos
    .map((h) => situacionDeHermano(cuotas, h, ejercicio))
    .sort((a, b) => (
      ORDEN[a.situacion] - ORDEN[b.situacion]
      || b.deudaTotal - a.deudaTotal
      || a.hermano.nombre.localeCompare(b.hermano.nombre, 'es')
    ))
}

/** El recuento para la cabecera: cuántos en cada situación y cuánto se debe. */
export function recuentoDeSituaciones(situaciones: SituacionDeHermano[]) {
  const cuantos = (s: SituacionCuota) => situaciones.filter((x) => x.situacion === s).length
  return {
    alDia: cuantos('alDia'),
    deben: cuantos('debe'),
    sinEmitir: cuantos('sinEmitir'),
    noAplica: cuantos('noAplica'),
    /** Sobre los que SÍ pagan cuota: meter a los civiles en el porcentaje lo hunde sin motivo. */
    conCuota: situaciones.filter((x) => x.situacion !== 'noAplica').length,
    deuda: redondear(situaciones.reduce((n, x) => n + x.deudaTotal, 0)),
  }
}

/** Cómo se dice cada situación, y de qué color va la etiqueta. */
export function etiquetaDeSituacion(s: SituacionCuota): { texto: string; clase: string } {
  if (s === 'alDia') return { texto: 'Al corriente', clase: 'pill--ok' }
  if (s === 'debe') return { texto: 'Debe', clase: 'pill--err' }
  if (s === 'sinEmitir') return { texto: 'Sin cuota emitida', clase: 'pill--warn' }
  return { texto: 'No paga cuota', clase: 'pill--off' }
}

/**
 * La situación dicha en una frase, para la ficha del hermano.
 *
 * Se dice el importe y desde cuándo, porque «debe» a secas no sirve para
 * decidir nada: no es lo mismo un recibo de este mes que tres años arrastrados.
 */
export function situacionEnUnaFrase(s: SituacionDeHermano, ejercicio: number): string {
  if (s.situacion === 'noAplica') {
    return s.hermano.civil
      ? 'Hermano civil: no se le emiten cuotas.'
      : 'De baja en la hermandad: no se le emiten cuotas.'
  }
  if (s.situacion === 'sinEmitir') {
    return `No tiene ningún recibo del ejercicio ${ejercicio}. Todavía no se le ha emitido la cuota.`
  }
  if (s.situacion === 'alDia') {
    return `Al corriente de pago. ${s.recibosDelEjercicio} recibo${s.recibosDelEjercicio === 1 ? '' : 's'} de ${ejercicio}, todo cobrado.`
  }
  const desde = s.desde != null && s.desde < ejercicio ? ` Arrastra desde ${s.desde}.` : ''
  return `Debe ${euros(s.deudaTotal)}.${desde}`
}

function euros(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`
}
