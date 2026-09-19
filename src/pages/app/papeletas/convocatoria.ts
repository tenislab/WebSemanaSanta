import type { HermandadSettings } from '../../../lib/hermandadSettings'
import { fmtIso } from './fechas'


import { enviarConvocatoria } from '../../../lib/convocatoria'
import { sePuedeConvocar, type Campana } from '../../../lib/campana'
import { type Hermano } from '../../../data/hermanos'
import { useState } from 'react'

/**
 * ABRIR EL PLAZO: EL CORREO MÁS IMPORTANTE DEL AÑO.
 *
 * De él depende que la gente saque su papeleta a tiempo, y quien no la saca en
 * plazo pierde el sitio que llevaba años ocupando. Por eso el resultado se
 * cuenta de verdad —cuántos han salido de cuántos— en vez del «(simulada)» de
 * antes, que decía que se había avisado a ochocientos hermanos sin haber
 * avisado a ninguno.
 *
 * Y NO SE MANDA FUERA DE PLAZO. Antes de abrir, este correo manda a
 * ochocientas personas a sacar una papeleta que no van a poder sacar; después
 * de cerrar, les anuncia como fecha límite un día que ya pasó. La comprobación
 * está dentro de `convocar()` además de en el botón, porque el botón no es la
 * única puerta. Ver `pruebas/convocatoria.prueba.mjs`.
 *
 * CINCO ENTRADAS.
 */
export function useConvocar({
  campana, estadoCampana, hermandad, hermanos, refrescarConvocatoria,
}: {
  campana: Campana
  estadoCampana: 'creada' | 'sin-crear' | 'sin-saber'
  hermandad: HermandadSettings
  hermanos: Hermano[]
  refrescarConvocatoria: () => void
}) {
  /**
   * Abre el plazo avisando por correo a todos los hermanos que pueden sacar
   * papeleta, y lo deja registrado en Comunicados.
   *
   * Es el correo más importante del año: de él depende que la gente saque su
   * papeleta a tiempo, y quien no la saca en plazo pierde el sitio que llevaba
   * años ocupando. Por eso el resultado se cuenta de verdad —cuántos han
   * salido de cuántos— en vez del «(simulada)» de antes, que decía que se
   * había avisado a ochocientos hermanos sin haber avisado a ninguno.
   */
  const [convocando, setConvocando] = useState(false)
  /*
   * EL FRENO DE LA FECHA. Fuera de plazo este correo miente: antes de abrir
   * manda a ochocientas personas a sacar una papeleta que no van a poder sacar,
   * y después de cerrar les anuncia como fecha límite un día que ya pasó. El
   * porqué entero está en `sePuedeConvocar()`.
   */
  /*
   * Y SE LE DICE SI LA CAMPAÑA EXISTE DE VERDAD.
   *
   * `getCampana()` nunca devuelve vacío: sin campaña creada devuelve la de
   * fábrica, con fechas inventadas. Hoy caen dentro de ese plazo inventado, así
   * que sin esto se ofrecía «Convocar papeletas» a una hermandad que no ha
   * fijado ninguna fecha — anunciándole a ochocientas personas un plazo que
   * nadie ha decidido y un año que a lo mejor no es el suyo.
   */
  const puedeConvocar = estadoCampana === 'sin-saber'
    /*
     * MIENTRAS NO CONSTA, NI SE OFRECE NI SE ACUSA.
     *
     * Con `sePuedeConvocar(..., false)` se decía «primero hay que crear la
     * campaña» a la vez que la banda de arriba decía «comprobando la campaña
     * de la hermandad…». Dos avisos seguidos que se contradicen: uno afirma que
     * no existe y el otro que todavía no se sabe.
     */
    ? { puede: false, motivo: 'Comprobando la campaña…' }
    : sePuedeConvocar(campana, undefined, estadoCampana === 'creada')

  async function convocar() {
    if (convocando) return
    /*
     * SE COMPRUEBA AQUÍ TAMBIÉN, y no solo en el botón. Un botón desactivado es
     * un estado de la pantalla: sobrevive a un `Enter`, a una pestaña abierta
     * desde ayer y a cualquiera que lo llame desde otro sitio mañana. Lo que no
     * se puede deshacer es el correo.
     */
    if (!puedeConvocar.puede) {
      window.alert(puedeConvocar.motivo)
      return
    }
    setConvocando(true)
    try {
      const r = await enviarConvocatoria(
        campana.anio,
        hermanos,
        fmtIso(campana.fechaLimiteRenovacion),
        { hermandad: hermandad.nombreLegal, fechaSalidaIso: campana.fechaSalida },
      )
      refrescarConvocatoria()
      if (r.enviados > 0) {
        window.alert(
          `Convocatoria enviada a ${r.enviados} hermano${r.enviados === 1 ? '' : 's'}`
          + `${r.total !== r.enviados ? ` (de ${r.total} con correo)` : ''}. Queda registrada en Comunicados.`,
        )
      } else if (r.total === 0) {
        window.alert(
          'No hay a quién avisar: ningún hermano activo tiene correo en su ficha. '
          + 'Añádeselo desde Hermanos y vuelve a intentarlo.',
        )
      } else {
        window.alert(
          `No ha salido ningún correo${r.error ? `: ${r.error}` : '.'}\n\n`
          + 'Comprueba en Configuración → Correo que el envío está encendido. '
          + 'La convocatoria NO se ha dado por hecha: puedes volver a intentarlo.',
        )
      }
    } finally {
      setConvocando(false)
    }
  }
  return { convocando, convocar, puedeConvocar }
}
