/**
 * El puente entre cobrar y anotarlo en el libro de cuentas.
 *
 * EL PROBLEMA QUE RESUELVE. Marcar una cuota o una papeleta como pagada no
 * dejaba rastro en Tesorería. El dinero entraba en la hermandad y el libro no
 * se enteraba: el saldo, el balance y el Estado de Cuentas anual solo
 * reflejaban lo que alguien hubiera escrito a mano, así que no cuadraban
 * nunca. Y el que peor sale parado es el tesorero, que cierra el año a mano
 * cotejando dos listas que deberían ser la misma.
 *
 * CÓMO QUEDA. Cada cobro genera un apunte de ingreso, y el apunte recuerda de
 * dónde vino (`origen`). Eso evita apuntar dos veces lo mismo, permite
 * retirarlo si el cobro se deshace, y deja ver qué línea del libro corresponde
 * a qué recibo.
 *
 * UNA DECISIÓN QUE NO ES OBVIA: el apunte nace **Pendiente**, no conciliado.
 * Que la secretaría marque un recibo como pagado significa «me consta que han
 * pagado», no «lo he visto en el extracto del banco». Conciliar es justamente
 * comprobar lo segundo, y lo hace el tesorero cuando le llega el extracto.
 * Nacer conciliado sería dar por bueno un cotejo que nadie ha hecho, que es
 * como se cuelan los descuadres que luego no hay quien encuentre.
 */
import type { Movimiento } from '../data/movimientos'
import { nuevoId } from './supabaseSync'

/** De dónde salió un apunte. Vacío = lo escribió alguien a mano. */
export function origenDeCuota(cuotaId: string): string {
  return `cuota:${cuotaId}`
}
export function origenDePapeleta(papeletaId: string): string {
  return `papeleta:${papeletaId}`
}

/**
 * A qué cuenta entra el dinero, según cómo hayan pagado.
 *
 * El efectivo va a Caja y todo lo demás al banco. Importa para conciliar: lo
 * de Caja se cuenta a mano y lo del banco se coteja con el extracto, y
 * mezclarlos deja al tesorero buscando en el extracto un pago que fue en mano.
 */
export function cuentaSegunMetodo(metodo?: string | null): string {
  const m = (metodo ?? '').toLowerCase()
  if (m.includes('efectivo') || m.includes('metálico') || m.includes('metalico') || m.includes('caja')) {
    return 'Caja'
  }
  return 'Cuenta bancaria'
}

/** El siguiente número de asiento. Los movimientos van numerados por orden. */
export function siguienteNumero(movimientos: Movimiento[]): number {
  return Math.max(0, ...movimientos.map((m) => m.numero)) + 1
}

/** ¿Está ya apuntado este cobro? Marcar pagado dos veces no puede duplicarlo. */
export function yaApuntado(movimientos: Movimiento[], origen: string): boolean {
  return movimientos.some((m) => m.origen === origen)
}

export interface DatosCobro {
  origen: string
  concepto: string
  categoria: string
  importe: number
  fecha: string
  metodo?: string | null
}

/**
 * Añade el apunte de un cobro, si no estaba ya. Devuelve la lista nueva.
 *
 * Se le pasa la lista y devuelve otra —en vez de escribir por su cuenta—
 * porque quien llama la tiene en su estado y es quien sabe guardarla. Así esto
 * se puede probar sin navegador y sin base de datos.
 */
export function conApunteDeCobro(movimientos: Movimiento[], cobro: DatosCobro): Movimiento[] {
  if (yaApuntado(movimientos, cobro.origen)) return movimientos
  // Un cobro de cero o negativo no es un ingreso: no se apunta nada.
  if (!(cobro.importe > 0)) return movimientos

  const apunte: Movimiento = {
    id: nuevoId(),
    numero: siguienteNumero(movimientos),
    fecha: cobro.fecha,
    concepto: cobro.concepto,
    categoria: cobro.categoria,
    tipo: 'Ingreso',
    importe: cobro.importe,
    cuenta: cuentaSegunMetodo(cobro.metodo),
    estado: 'Pendiente',
    origen: cobro.origen,
  }
  return [apunte, ...movimientos]
}

/**
 * Retira el apunte de un cobro que se ha deshecho: un recibo que se devuelve,
 * una papeleta que se anula.
 *
 * Se BORRA en vez de dejar un apunte en negativo a propósito. Un cobro que se
 * deshace el mismo día no llegó a existir, y dejar dos líneas que se anulan
 * entre sí ensucia el libro sin aportar nada. Si el dinero llegó a entrar y
 * salir de verdad, eso es una devolución y el tesorero la registra como tal.
 */
export function sinApunteDeCobro(movimientos: Movimiento[], origen: string): Movimiento[] {
  return movimientos.filter((m) => m.origen !== origen)
}
