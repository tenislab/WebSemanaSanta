/**
 * EL CERTIFICADO DE ANTIGÜEDAD, ya expedido.
 *
 * Todos los campos que se imprimen están COPIADOS del momento en que se firmó,
 * y no enlazados a la ficha. No es redundancia: un certificado dice lo que
 * decía el día que se expidió. Si mañana la secretaría corrige una antigüedad
 * mal importada, el papel que esa persona lleva en la mano no cambia — y el
 * registro tiene que seguir explicando qué se certificó exactamente.
 *
 * Lo mismo con los nombres de quien firma: la junta cambia cada pocos años, y
 * un certificado de 2027 lo firmó quien lo firmó.
 */
export interface Certificado {
  id: string
  /** El año del registro, que numera aparte cada ejercicio. */
  anio: number
  numero: number
  /** El enlace, solo para listar «los certificados de este hermano». */
  hermanoId?: string
  hermanoNombre: string
  hermanoDni: string
  hermanoNumero: number
  /** El AÑO desde el que es hermano, tal como estaba en su ficha. */
  antiguedad: number
  /** Y los años que llevaba ENTONCES. Se guarda hecho: dentro de tres años, la
   *  resta daría otro número y el papel dice el de aquel día. */
  aniosDeAntiguedad: number
  /** Para qué lo pidió. Es lo que la secretaría necesita para saber si el que
   *  le piden en marzo es el mismo que ya expidió en enero. */
  motivo: string
  firmaSecretario: string
  firmaHermanoMayor: string
  emitidoPor: string
  /** La fecha de expedición, en la forma en la que se lee. */
  fecha: string
  creadoEn: string
}

/** «14/2027», que es como se dice por teléfono cuando alguien pregunta por él. */
export function referenciaCertificado(c: Pick<Certificado, 'numero' | 'anio'>): string {
  return `${c.numero}/${c.anio}`
}
