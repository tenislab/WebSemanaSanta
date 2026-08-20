import type { MetodoPago } from './papeletas'
/**
 * Estados de una cuota. «En mora» NO salta solo al vencer la fecha: lo pone a
 * mano el tesorero o el secretario cuando decide reclamar el impago.
 */
export type EstadoCuota = 'Pagada' | 'Pendiente' | 'Devuelta' | 'En mora'
/** Nombre del concepto de cuota; los conceptos y sus importes los define cada hermandad (ver lib/conceptosCuota.ts). */
export type ConceptoCuota = string

/** Cómo se cobra la cuota. */
export type MetodoCobro = 'Domiciliación' | 'Transferencia' | 'Efectivo' | 'Bizum'

export const METODOS_COBRO: MetodoCobro[] = ['Domiciliación', 'Transferencia', 'Efectivo', 'Bizum']

export interface Cuota {
  id: string
  numero: number
  hermanoId: string
  concepto: ConceptoCuota
  importe: number
  estado: EstadoCuota
  /** Ejercicio (año) al que pertenece la cuota. Si falta (datos antiguos), se deduce de `fechaEmision`. */
  ejercicio?: number
  fechaEmision: string
  /** Fecha en la que está previsto pasar el cobro (domiciliado o manual). */
  fechaCobro: string
  /** Si se cobra por domiciliación bancaria (cargo en la cuenta del hermano) o de forma manual. */
  domiciliada: boolean
  /** Método de cobro. Si falta (datos antiguos), se deduce de `domiciliada`. */
  metodoCobro?: MetodoCobro
  fechaPago?: string
  /**
   * Cuándo se descargó este recibo dentro de un fichero de remesa SEPA
   * (aaaa-mm-dd). Vacío = todavía no se ha remesado.
   *
   * Sin esto, descargar el XML no dejaba ningún rastro: el recibo seguía
   * «Pendiente» y «domiciliada», así que a la semana siguiente entraba otra vez
   * en la remesa. Dos ficheros al banco con los mismos recibos son dos cargos
   * al mismo hermano, y el segundo se devuelve con comisión.
   */
  remesadaEl?: string
  /** Correo del cargo que ha PROPUESTO la mora (cuando hace falta confirmación de dos cargos). */
  moraPropuestaPor?: string
  /** Nombre visible de quien propuso la mora. */
  moraPropuestaNombre?: string
  /**
   * El hermano ha avisado desde su área de que ya ha pagado (Bizum o
   * transferencia). La tesorería lo confirma al ver el ingreso: hasta
   * entonces el recibo sigue pendiente, pero deja de ser una incógnita.
   */
  pagoComunicado?: { metodo: MetodoPago; fecha: string } | null
}

/** Método de cobro de una cuota, tolerando datos antiguos que solo tienen `domiciliada`. */
export function metodoDeCuota(c: Cuota): MetodoCobro {
  return c.metodoCobro ?? (c.domiciliada ? 'Domiciliación' : 'Transferencia')
}

/**
 * El hermano ha avisado desde su área de que ya ha pagado (Bizum o
 * transferencia) y a la tesorería el recibo aún le consta sin cobrar. En
 * cuanto se da por pagado deja de estar «avisado»: ya está resuelto.
 */
export function esAvisado(c: Cuota): boolean {
  return !!c.pagoComunicado && c.estado !== 'Pagada'
}

/**
 * El método de pago escrito dentro de una frase. «Bizum» es una marca y va con
 * mayúscula siempre; «transferencia» es una palabra corriente y en mitad de una
 * frase iría en minúscula.
 */
export function metodoEnFrase(metodo: string): string {
  return metodo === 'Bizum' ? 'Bizum' : metodo.toLowerCase()
}

export const CONCEPTOS: ConceptoCuota[] = ['Cuota anual', 'Cuota trimestral', 'Cuota extraordinaria']

export const IMPORTE_POR_CONCEPTO: Record<ConceptoCuota, number> = {
  'Cuota anual': 60,
  'Cuota trimestral': 18,
  'Cuota extraordinaria': 25,
}

/** Cuotas de ejemplo, emitidas a hermanos del censo (ver data/hermanos.ts). */
export const CUOTAS_INICIALES: Cuota[] = [
  { id: 'c1', numero: 1042, hermanoId: 'h2', concepto: 'Cuota anual', importe: 60, estado: 'Pagada', fechaEmision: '03 feb 2026', fechaCobro: '18 feb 2026', fechaPago: '05 feb 2026', domiciliada: true },
  { id: 'c2', numero: 1043, hermanoId: 'h3', concepto: 'Cuota trimestral', importe: 18, estado: 'Pendiente', fechaEmision: '03 feb 2026', fechaCobro: '18 feb 2026', domiciliada: true },
  { id: 'c3', numero: 1044, hermanoId: 'h1', concepto: 'Cuota anual', importe: 60, estado: 'Pagada', fechaEmision: '02 feb 2026', fechaCobro: '17 feb 2026', fechaPago: '02 feb 2026', domiciliada: true },
  { id: 'c4', numero: 1045, hermanoId: 'h4', concepto: 'Cuota trimestral', importe: 18, estado: 'Devuelta', fechaEmision: '01 feb 2026', fechaCobro: '16 feb 2026', domiciliada: true },
  { id: 'c5', numero: 1046, hermanoId: 'h5', concepto: 'Cuota anual', importe: 60, estado: 'Pendiente', fechaEmision: '31 ene 2026', fechaCobro: '15 feb 2026', domiciliada: true },
  { id: 'c6', numero: 1047, hermanoId: 'h8', concepto: 'Cuota anual', importe: 60, estado: 'Pagada', fechaEmision: '28 ene 2026', fechaCobro: '12 feb 2026', fechaPago: '30 ene 2026', domiciliada: true },
  { id: 'c7', numero: 1048, hermanoId: 'h9', concepto: 'Cuota trimestral', importe: 18, estado: 'Pagada', fechaEmision: '28 ene 2026', fechaCobro: '12 feb 2026', fechaPago: '28 ene 2026', domiciliada: true },
  { id: 'c8', numero: 1049, hermanoId: 'h10', concepto: 'Cuota anual', importe: 60, estado: 'Pendiente', fechaEmision: '26 ene 2026', fechaCobro: '10 feb 2026', domiciliada: true },
  { id: 'c9', numero: 1050, hermanoId: 'h12', concepto: 'Cuota extraordinaria', importe: 25, estado: 'Pagada', fechaEmision: '20 ene 2026', fechaCobro: '04 feb 2026', fechaPago: '22 ene 2026', domiciliada: true },
  { id: 'c10', numero: 1051, hermanoId: 'h7', concepto: 'Cuota extraordinaria', importe: 25, estado: 'Pendiente', fechaEmision: '18 ene 2026', fechaCobro: '02 feb 2026', domiciliada: false },
]
