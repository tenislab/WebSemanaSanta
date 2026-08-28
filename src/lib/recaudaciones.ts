/**
 * CAMPAÑAS DE RECAUDACIÓN: UN OBJETIVO Y UNA BARRA QUE SE LLENA.
 *
 * La hermandad abre una campaña —restaurar el paso, el reparto de Navidad, el
 * tejado de la casa hermandad—, dice cuánto hace falta, y a partir de ahí se
 * ve cuánto lleva recogido y cuánto queda. Pedido por la hermandad piloto:
 * «que las campañas sean recolecciones de dinero con una barra hasta que se
 * llegue al objetivo».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTO NO SE LLAMA «CAMPAÑA» EN EL CÓDIGO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Porque ya hay una `lib/campana.ts` y NO es esto: esa es la campaña de
 * PAPELETAS DE SITIO, la de la estación de penitencia de cada año, con sus
 * plazos de renovación. Dos cosas distintas con el mismo nombre en el mismo
 * proyecto es cómo se acaba tocando la que no era.
 *
 * En pantalla sí se llaman «Campañas», que es como las llama la hermandad.
 * Aquí se llaman recaudaciones, que es lo que son.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA DECISIÓN IMPORTANTE: LO RECAUDADO NO SE GUARDA, SE CUENTA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La campaña NO lleva un campo «recaudado» que se vaya sumando. Lo recaudado
 * se calcula cada vez sumando los APUNTES DE TESORERÍA que llevan su marca.
 *
 * Cuesta un poco más y es lo correcto, por tres razones:
 *
 *   1. UN CONTADOR APARTE SE DESCUADRA SIEMPRE. En cuanto alguien corrige un
 *      apunte en Tesorería —una cifra mal tecleada, un donativo que se anula—,
 *      el contador se queda con el número viejo. Y entonces hay dos verdades
 *      sobre el mismo dinero: la que enseña la barra y la que dice el libro.
 *      La que se publica en la web es siempre la equivocada.
 *
 *   2. ES LA MISMA QUEJA DE LAS CUOTAS. «El concepto de cuota no se pasa a
 *      tesorería»: dinero que entra y del que el libro no se entera. Contando
 *      desde el libro, un donativo que no está en Tesorería NO cuenta para la
 *      barra — así que si la barra sube, el tesorero lo tiene. No hay forma de
 *      que se separen.
 *
 *   3. EL TESORERO NO TIENE QUE APUNTAR NADA DOS VECES.
 *
 * La marca va en `origen`, igual que las cuotas y las papeletas: ver
 * `lib/apuntes.ts`.
 */
import { useSupabaseTable } from './supabaseSync'
import { CLAVES_DATOS } from './persistencia'
import { recaudacionToRow, rowToRecaudacion } from './db/recaudaciones'
import type { Movimiento } from '../data/movimientos'
import { RECAUDACIONES_INICIALES } from '../data/objetivos'

export type EstadoRecaudacion = 'abierta' | 'cerrada'

export interface Recaudacion {
  id: string
  nombre: string
  descripcion: string
  /**
   * Cuánto se quiere reunir, EN EUROS. Cero significa «sin objetivo»: hay
   * campañas que se abren sin cifra —el cepillo de caridad— y esas no tienen
   * barra, solo total. No se prohíbe: se enseña distinto.
   */
  objetivo: number
  fechaInicio: string
  /** Vacía = sigue abierta sin fecha de cierre. */
  fechaFin?: string
  estado: EstadoRecaudacion
  /** Si sale en la web pública con su barra, para que done gente de fuera. */
  enLaWeb: boolean
  creadaEn: string
}

/** La marca que llevan en Tesorería los ingresos de una campaña. */
export function origenDeRecaudacion(recaudacionId: string, aportacionId: string): string {
  return `campana:${recaudacionId}:${aportacionId}`
}

/** ¿Este apunte es de esta campaña? */
export function esDeLaRecaudacion(m: Pick<Movimiento, 'origen'>, recaudacionId: string): boolean {
  return (m.origen ?? '').startsWith(`campana:${recaudacionId}:`)
}

/**
 * CUÁNTO LLEVA RECOGIDO, en euros.
 *
 * En céntimos por dentro y dividido al final: sumar euros con decimales da
 * 1.999,9999999997 en cuanto hay treinta donativos, y eso sale en pantalla.
 *
 * Los GASTOS con la marca de la campaña se RESTAN. Una campaña tiene gastos
 * —la imprenta de las huchas, el transporte— y enseñar lo bruto como si fuera
 * lo disponible es mentir sobre cuánto falta: se compra el paso con el dinero
 * que queda, no con el que pasó por caja.
 */
export function loRecaudado(movimientos: readonly Movimiento[], recaudacionId: string): number {
  const cent = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) : 0)
  let total = 0
  for (const m of movimientos) {
    if (!esDeLaRecaudacion(m, recaudacionId)) continue
    total += m.tipo === 'Ingreso' ? cent(m.importe) : -cent(m.importe)
  }
  // `-0` se imprime «-0,00 €», que asusta al que lo ve. Y `-0 === 0`.
  return total === 0 ? 0 : total / 100
}

/** Cuántas aportaciones lleva. Sirve para decir «de 34 personas», que motiva más que el euro. */
export function cuantasAportaciones(movimientos: readonly Movimiento[], recaudacionId: string): number {
  return movimientos.filter((m) => esDeLaRecaudacion(m, recaudacionId) && m.tipo === 'Ingreso').length
}

/**
 * CÓMO VA LA BARRA, de 0 a 100.
 *
 * SE PASA DE 100 SIN RECORTARSE POR DENTRO, y quien pinta decide qué hacer con
 * eso. Recortarlo aquí escondería el mejor dato que puede dar una campaña:
 * que ha superado el objetivo. La barra se para en el 100 %, pero el número se
 * enseña entero — «124 % del objetivo» es lo que la hermandad quiere contar.
 *
 * Sin objetivo devuelve 0: no hay barra que llenar.
 */
export function comoVa(recaudado: number, objetivo: number): number {
  if (!(objetivo > 0)) return 0
  return (recaudado / objetivo) * 100
}

/** Lo que falta para el objetivo. Nunca negativo: pasado el objetivo, no falta nada. */
export function loQueFalta(recaudado: number, objetivo: number): number {
  if (!(objetivo > 0)) return 0
  return Math.max(0, Math.round((objetivo - recaudado) * 100) / 100)
}

/**
 * Cómo se lee el estado de una campaña en una frase.
 *
 * Se separa de la pantalla para poder comprobarlo, y porque la frase cambia
 * según tres cosas a la vez —si hay objetivo, si se llegó, si está cerrada— y
 * eso metido entre el JSX no hay quien lo lea ni quien lo pruebe.
 */
export function comoSeLee(r: Recaudacion, recaudado: number): string {
  if (!(r.objetivo > 0)) {
    return r.estado === 'cerrada' ? 'Cerrada' : 'Abierta, sin objetivo fijado'
  }
  const pct = Math.round(comoVa(recaudado, r.objetivo))
  if (recaudado >= r.objetivo) {
    return r.estado === 'cerrada'
      ? `Objetivo cumplido (${pct} %)`
      : `¡Objetivo alcanzado! Va por el ${pct} %`
  }
  if (r.estado === 'cerrada') return `Cerrada al ${pct} % del objetivo`
  return `${pct} % del objetivo`
}

/**
 * ¿SE LE PUEDE METER DINERO A ESTA CAMPAÑA?
 *
 * Una campaña cerrada no admite aportaciones. Importa porque el donativo que
 * llega tarde —el sobre que aparece dos semanas después— hay que apuntarlo en
 * algún sitio, y si se cuela en una campaña cerrada descuadra un total que ya
 * se dio por bueno y probablemente ya se publicó.
 */
export function admiteAportaciones(r: Recaudacion): boolean {
  return r.estado === 'abierta'
}

/** Las que se enseñan en la web: abiertas y marcadas para salir. */
export function lasQueSalenEnLaWeb(lista: readonly Recaudacion[]): Recaudacion[] {
  return lista.filter((r) => r.enLaWeb && r.estado === 'abierta')
}

export function useRecaudaciones() {
  return useSupabaseTable<Recaudacion>(
    'campanas_recaudacion',
    CLAVES_DATOS.recaudaciones,
    RECAUDACIONES_INICIALES,
    recaudacionToRow,
    rowToRecaudacion,
    'creada_en',
  )
}
