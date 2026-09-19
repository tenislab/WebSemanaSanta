import { hoy } from './fechas'


import { apuntar } from '../../../lib/registroActividad'
import { conApunteDeCobro, origenDePapeleta, sinApunteDeCobro } from '../../../lib/apuntes'
import { type Hermano } from '../../../data/hermanos'
import { type MetodoPagoPapeleta, type Papeleta } from '../../../data/papeletas'
import { type Movimiento } from '../../../data/movimientos'

/**
 * COBRAR UNA PAPELETA, ANULARLA, Y QUE EL LIBRO SE ENTERE.
 *
 * Registrar el pago deja su apunte en Tesorería y anularla se lo lleva: sin
 * las dos mitades, el libro de cuentas se queda diciendo que se cobró algo que
 * se devolvió. Ver `pruebas/cobrosallibro.prueba.mjs`.
 *
 * Y todo queda en el registro de actividad con quién lo hizo, porque una
 * papeleta anulada es un sitio que se le quita a alguien.
 */
export function useLosPagos({
  papeletas, setPapeletas, setMovimientos, hermanos, quienSoy,
}: {
  papeletas: Papeleta[]
  setPapeletas: React.Dispatch<React.SetStateAction<Papeleta[]>>
  setMovimientos: React.Dispatch<React.SetStateAction<Movimiento[]>>
  hermanos: Hermano[]
  /** Quién está cobrando o anulando, para el registro de actividad. */
  quienSoy: string
}) {
  function actualizarPapeleta(id: string, cambios: Partial<Papeleta>) {
    setPapeletas((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
  }

  /**
   * Registra el cobro de la papeleta con el método elegido (emitida → pagada).
   *
   * «EXENTO» NO ES UN COBRO. Es lo contrario: se le da su sitio a alguien sin
   * cobrarle —un hermano mayor, una situación difícil, un cargo—. Antes se
   * trataba como los demás métodos, así que apuntaba en Tesorería un ingreso
   * de 18 € en la cuenta bancaria que nadie había pagado, y el contador de
   * «Recaudado» de la campaña también lo sumaba. La hermandad cuadraba caja
   * contra un dinero que no existe.
   *
   * La papeleta queda «Pagada» —porque para el cortejo lo está: puede salir— a
   * importe cero, y no se apunta nada en el libro.
   */
  function registrarPago(id: string, metodo: MetodoPagoPapeleta) {
    const exento = metodo === 'Exento'
    actualizarPapeleta(id, {
      estado: 'Pagada',
      metodoPago: metodo,
      fechaPago: hoy(),
      ...(exento ? { importe: 0 } : {}),
    })
    if (exento) return
    // Y al libro de cuentas. Esto es lo que faltaba: se cobraba la papeleta y
    // Tesorería no lo veía, así que la recaudación de la campaña no aparecía
    // por ninguna parte en el balance.
    const p = papeletas.find((x) => x.id === id)
    if (p) {
      const h = hermanos.find((x) => x.id === p.hermanoId)
      setMovimientos((prev) =>
        conApunteDeCobro(prev, {
          origen: origenDePapeleta(p.id),
          concepto: `Papeleta de sitio ${p.anio} — ${h?.nombre ?? 'hermano/a'}`,
          // No hay partida propia para papeletas en el Estado de Cuentas que
          // piden las diócesis, y no se inventa una: iría en «Otros ingresos»
          // igualmente al presentarlo. El concepto dice de qué es.
          categoria: 'Otros ingresos',
          importe: p.importe,
          fecha: hoy(),
          metodo,
        }),
      )
    }
  }

  /** Anular ≠ borrar: la papeleta se conserva como «Anulada», con su motivo. */
  function anularPapeleta(id: string) {
    const motivo = window.prompt('Motivo de la anulación (queda registrado):', '')
    if (motivo === null) return
    actualizarPapeleta(id, { estado: 'Anulada', motivoAnulacion: motivo.trim() || 'Sin especificar' })
    // Anulada deja de ser un ingreso: fuera su apunte, o el saldo contaría un
    // dinero que se devolvió.
    setMovimientos((prev) => sinApunteDeCobro(prev, origenDePapeleta(id)))
    // Anular una papeleta es de lo primero que se pregunta en un cabildo
    // cuando alguien se queda sin sitio: quién la anuló, cuándo y por qué.
    const anulada = papeletas.find((x) => x.id === id)
    apuntar({
      autorNombre: quienSoy, accion: 'papeleta_anulada', sobreTipo: 'papeleta',
      sobreId: id,
      sobreNombre: hermanos.find((h) => h.id === anulada?.hermanoId)?.nombre ?? '',
      detalle: `Anuló la papeleta de ${hermanos.find((h) => h.id === anulada?.hermanoId)?.nombre ?? 'un hermano'}: ${motivo.trim() || 'sin motivo'}`,
    })
  }
  return { actualizarPapeleta, registrarPago, anularPapeleta }
}
