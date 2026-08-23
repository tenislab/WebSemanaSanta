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

/**
 * ¿ESTÁ COBRADA? Una sola respuesta para toda la aplicación.
 *
 * Esta regla estaba copiada SEIS veces —en el área del hermano, en «Mi
 * familia», en el historial de la ficha, en Papeletas, en Cuotas y en el
 * cálculo de la deuda—, siempre como `estado === 'Pendiente' || 'En mora' ||
 * 'Devuelta'`. Copiada funciona; el problema es el día que se añada un estado
 * nuevo (una cuota condonada, una fraccionada, una exenta): habría que
 * acordarse de los seis sitios, y de los que se olviden saldría dinero mal
 * contado sin ningún aviso. Es de las cosas que no se notan hasta que un
 * hermano reclama.
 *
 * Va como `Record` de TODOS los estados y no como lista: así, al añadir uno,
 * TypeScript no compila hasta que se diga si esa cuota está cobrada o no. El
 * compilador hace de recordatorio, que es más fiable que acordarse.
 */
const COBRADA: Record<EstadoCuota, boolean> = {
  Pagada: true,
  Pendiente: false,
  'En mora': false,
  // Devuelta es dinero que ENTRÓ y volvió: se sigue debiendo.
  Devuelta: false,
}

/** La cuota sigue sin cobrar: pendiente, en mora o devuelta por el banco. */
export function estaSinCobrar(c: Cuota): boolean {
  return !COBRADA[c.estado]
}

/**
 * Lo que se debe de un puñado de recibos, en euros.
 *
 * Dos cosas, y las dos por lo mismo —que esta cifra se le enseña a la gente—:
 *
 *   · Sin deshilachar los céntimos. Sumar decimales en coma flotante deja
 *     59,999999999, que en el recibo de una hermandad parece que el programa
 *     no sabe sumar.
 *
 *   · UN RECIBO ROTO NO SE LLEVA POR DELANTE LA CUENTA ENTERA. Basta con un
 *     importe que no sea un número —la celda vacía de un Excel, un valor nulo
 *     de la base— para que la suma dé NaN, y entonces la deuda de TODA la
 *     hermandad se lee «NaN €»: en Cuotas, en la ficha de cada hermano, en su
 *     propia área y en el estado de cuentas que se lleva al cabildo. Un dato
 *     malo entre seiscientos buenos no puede borrar los seiscientos.
 *
 *     El recibo roto sigue enseñando su propio importe en su fila, así que el
 *     problema no se esconde: se acota.
 */
export function deudaDe(cuotas: Cuota[]): number {
  const cent = cuotas.filter(estaSinCobrar).reduce((n, c) => {
    /* `Number(...)` primero, y no solo `isFinite`: Postgres devuelve las
       columnas `numeric` como TEXTO («60.00»), y aunque los conversores de
       `lib/db` ya lo pasan a número, una copia guardada en el navegador de una
       versión anterior puede traerlo como cadena. Convertir antes de sumar
       cuesta nada y evita que un espejo antiguo deje la deuda en cero. */
    const importe = Number(c.importe)
    return n + (Number.isFinite(importe) ? Math.round(importe * 100) : 0)
  }, 0)
  return cent / 100
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
