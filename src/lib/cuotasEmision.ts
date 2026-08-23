import type { Cuota, MetodoCobro } from '../data/cuotas'
import type { Hermano } from '../data/hermanos'

/**
 * Emisión anual de cuotas por ejercicio (salto de año) y simulación de cobro
 * bancario. Todo son funciones PURAS: reciben los datos y devuelven cuotas
 * nuevas o modificadas, sin tocar estado ni almacenamiento. La página de
 * Cuotas las usa para el «nuevo ejercicio» y el «auto-pagado simulado».
 */

/** Extrae el año (4 dígitos) de una fecha en texto español («03 feb 2026») o ISO. */
export function anioDeTexto(fecha: string | undefined): number | null {
  if (!fecha) return null
  const m = fecha.match(/(\d{4})/)
  return m ? Number(m[1]) : null
}

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Convierte una fecha escrita en español («18 feb 2026») o en ISO
 * («2026-02-18») a Date. Devuelve null si no se reconoce.
 */
export function parseFechaEs(texto: string | undefined): Date | null {
  if (!texto) return null
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const m = texto.toLowerCase().match(/(\d{1,2})\s+([a-záéíóú]{3,})\.?\s+(\d{4})/)
  if (!m) return null
  const mes = MESES_ES.findIndex((x) => m[2].startsWith(x))
  if (mes < 0) return null
  return new Date(Number(m[3]), mes, Number(m[1]))
}

/** Ejercicio de una cuota: el explícito o, si falta, el año de su fecha de emisión. */
export function ejercicioDe(c: Cuota): number | null {
  return c.ejercicio ?? anioDeTexto(c.fechaEmision)
}

/** El ejercicio más reciente con cuotas emitidas (o null si no hay ninguna). */
export function ultimoEjercicio(cuotas: Cuota[]): number | null {
  const anios = cuotas.map(ejercicioDe).filter((a): a is number => a != null)
  return anios.length ? Math.max(...anios) : null
}

/**
 * EL EJERCICIO DEL QUE SE HABLA CUANDO SE HABLA DE CUOTAS.
 *
 * Es el último con recibos emitidos y, si no hay ninguno, el año natural.
 *
 * Existe porque tiene que ser UNO. La situación de cuota de un hermano se
 * pinta en cinco sitios —el censo, su ficha, Cuotas, Informes y su propia
 * área—, y cada uno elegía el año por su cuenta: unos el último emitido y
 * otros el año natural. Con la hermandad al día coinciden, así que no se nota;
 * el día que no —en enero, con la cuota del año anterior emitida y la de este
 * no— Cuotas diría «al corriente» y el censo «sin cuota emitida» DEL MISMO
 * HERMANO. Dos pantallas contestando cosas distintas a la misma pregunta, y
 * sobre dinero, es peor que contestar mal las dos: no se sabe cuál creer.
 *
 * OJO, no confundir con el año de la CAMPAÑA (`getCampana().anio`), que es la
 * Semana Santa que viene y va por delante del ejercicio contable. Mezclarlos
 * es lo que dejaba la pantalla de Cuotas diciendo «0 recibos» con la tesorería
 * llena.
 */
export function ejercicioDeCuotas(cuotas: Cuota[]): number {
  return ultimoEjercicio(cuotas) ?? new Date().getFullYear()
}

/**
 * Hermanos ACTIVOS (o nuevos) que aún no tienen una cuota de ese concepto en
 * ese ejercicio. Son los candidatos a la emisión anual.
 *
 * Quedan fuera dos grupos:
 *   · los de baja, que ya no pagan cuota;
 *   · los hermanos CIVILES, a los que no se les emite ninguna — es lo que
 *     significa ser civil.
 *
 * Este filtro es el embudo de toda la emisión: de aquí salen los candidatos de
 * `emitirCuotasAnuales`, el contador del cajón de emisión y el aviso de nuevo
 * ejercicio. Cerrarlo aquí los cierra todos. Si un civil se colara, con IBAN
 * puesto acabaría en la siguiente remesa SEPA y se le cobraría en el banco una
 * cuota que no debe.
 */
export function hermanosSinCuota(
  cuotas: Cuota[],
  hermanos: Hermano[],
  ejercicio: number,
  concepto: string,
): Hermano[] {
  const yaTienen = new Set(
    cuotas
      .filter((c) => ejercicioDe(c) === ejercicio && mismoConcepto(c.concepto, concepto))
      .map((c) => c.hermanoId),
  )
  return hermanos.filter((h) => h.estado !== 'Baja' && !h.civil && !yaTienen.has(h.id))
}

/**
 * ¿Es la misma cuota? Un fraccionamiento mensual guarda el concepto con el
 * sufijo « · mes 3/12»; sin quitarlo, la emisión anual no reconocía esos
 * recibos y volvía a cobrar el año entero a quien ya lo estaba pagando a plazos.
 */
export function mismoConcepto(conceptoCuota: string, concepto: string): boolean {
  return llano(conceptoBase(conceptoCuota)) === llano(conceptoBase(concepto))
}

/**
 * Sin mayúsculas ni tildes. El concepto se escribe a mano en los catálogos y
 * queda copiado dentro de cada recibo: si alguien lo cambiaba de «Cuota Anual»
 * a «Cuota anual», la emisión del año siguiente no reconocía los recibos ya
 * emitidos y volvía a cobrar a todo el censo.
 */
function llano(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Quita el sufijo de fraccionamiento (« · mes 3/12») de un concepto. */
export function conceptoBase(concepto: string): string {
  return concepto.replace(/\s*·\s*mes\s+\d+\/\d+\s*$/i, '').trim()
}

export interface OpcionesEmision {
  cuotas: Cuota[]
  hermanos: Hermano[]
  ejercicio: number
  concepto: string
  importe: number
  /** Fecha de cobro en texto español ya formateada. */
  fechaCobro: string
  /** Fecha de emisión en texto español ya formateada. */
  fechaEmision: string
  metodoPorDefecto: MetodoCobro
  /** Genera identificadores únicos para las cuotas nuevas. */
  nuevoId: () => string
}

/**
 * Emite la cuota anual del ejercicio a todos los hermanos que aún no la tienen.
 * Devuelve solo las cuotas NUEVAS (para anteponerlas a las existentes). El
 * método real de cada una respeta si el hermano tiene IBAN: sin IBAN no se
 * domicilia aunque se pida domiciliación.
 */
export function emitirCuotasAnuales(opts: OpcionesEmision): Cuota[] {
  const { cuotas, hermanos, ejercicio, concepto, importe, fechaCobro, fechaEmision, metodoPorDefecto, nuevoId } = opts
  const candidatos = hermanosSinCuota(cuotas, hermanos, ejercicio, concepto)
  let numero = Math.max(0, ...cuotas.map((c) => c.numero)) + 1
  return candidatos.map((h) => {
    const domiciliada = metodoPorDefecto === 'Domiciliación' && Boolean(h.iban)
    const metodoCobro: MetodoCobro =
      metodoPorDefecto === 'Domiciliación' && !h.iban ? 'Transferencia' : metodoPorDefecto
    return {
      id: nuevoId(),
      numero: numero++,
      hermanoId: h.id,
      concepto,
      importe,
      estado: 'Pendiente',
      ejercicio,
      fechaEmision,
      fechaCobro,
      domiciliada,
      metodoCobro,
    }
  })
}

/**
 * Simula el cobro bancario de una remesa: marca como Pagadas las cuotas cuyos
 * ids se pasan, salvo una fracción determinista que se devuelve (impago), para
 * que la demo enseñe también las devoluciones. Determinista (sin azar): se
 * devuelve 1 de cada 12 según el número de recibo. Devuelve TODAS las cuotas
 * con las afectadas ya modificadas.
 */
export function simularCobroRemesa(cuotas: Cuota[], ids: string[], fechaPago: string): Cuota[] {
  const enRemesa = new Set(ids)
  return cuotas.map((c) => {
    if (!enRemesa.has(c.id)) return c
    const devuelta = c.numero % 12 === 0
    return devuelta
      ? { ...c, estado: 'Devuelta' as const }
      : { ...c, estado: 'Pagada' as const, fechaPago }
  })
}
