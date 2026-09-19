import type { HermandadSettings } from '../../../lib/hermandadSettings'
import { hoy } from './fechas'
import { agregarAvisoHermano } from '../../../lib/avisosHermano'
import { avisarPorCorreo } from '../../../lib/avisosCorreo'
import { conRenovacion } from '../../../lib/renovarPapeleta'
import { nuevoId } from '../../../lib/supabaseSync'
import { precioDeTramo, type Tramo } from '../../../lib/tramos'
import { puedeSalirEnElCortejo } from '../../../lib/cortejo'
import { type Campana } from '../../../lib/campana'
import { type Hermano } from '../../../data/hermanos'
import { type Papeleta } from '../../../data/papeletas'
import { useState } from 'react'

/**
 * DARLE SITIO A UN HERMANO EN EL CORTEJO, Y AVISARLE.
 *
 * Los cuatro caminos por los que sale una papeleta —renovar el sitio del año
 * pasado, no renovarlo, sacar en un tramo nuevo y la simbólica— más el aviso
 * al hermano y el envío de su papeleta por correo.
 *
 * LOS TRES QUE EMITEN VUELVEN A PREGUNTAR si el hermano puede salir en el
 * cortejo, y no solo el botón que se ve: un hermano de baja, o que no cumple
 * la antigüedad, no puede llevar papeleta, y hay tres puertas para dársela.
 * Ver `pruebas/cortejo.prueba.mjs`.
 *
 * Y EL PRECIO LO PONE ESTA CASA, no quien llama. Antes recibía el importe, y
 * eso es justo lo que dejaba que las cuatro vías cobraran distinto por el
 * mismo sitio.
 *
 * OCHO ENTRADAS para 244 líneas, y ninguna de sobra.
 */
export function useRenovarYSacar({
  campana, hermandad, hermanos, tramos, precioBase, setPapeletas, setPendingCuerpo, siguienteNumero,
}: {
  campana: Campana
  hermandad: HermandadSettings
  hermanos: Hermano[]
  tramos: Tramo[]
  /** El precio de HOY. No se recibe el importe: se calcula aquí. */
  precioBase: number
  setPapeletas: React.Dispatch<React.SetStateAction<Papeleta[]>>
  setPendingCuerpo: (v: string) => void
  siguienteNumero: (lista: Papeleta[], anio?: number) => number
}) {
  /**
   * Renueva el sitio del año anterior con el mismo tramo. Si ya hay papeleta
   * de esta campaña (doble clic, o una renuncia previa que se rectifica), la
   * actualiza en vez de crear una segunda fila duplicada.
   */
  /**
   * Renovar el sitio de un hermano. La cuenta la lleva `conRenovacion`, la
   * misma que usa el área del hermano: escrito dos veces, se separaba.
   *
   * Ya no recibe el importe: lo calcula ella con el precio de HOY. Que quien
   * llama pudiera pasar el que quisiera es justo lo que dejaba que las dos
   * vías cobraran distinto.
   */
  function renovar(hermanoId: string, tramoId: string) {
    if (!saleEnElCortejo(hermanoId)) return
    setPapeletas((prev) =>
      conRenovacion(prev, {
        hermanoId,
        tramoId,
        anio: campana.anio,
        tramos,
        precioBase,
        nuevoId,
        hoy,
      }),
    )
    avisarDeSitio(hermanoId, tramos.find((t) => t.id === tramoId)?.nombre ?? null, null, tramoId)
  }

  /** El hermano renuncia a salir este año: pierde su sitio, que queda libre. */
  function noRenovar(hermanoId: string) {
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id ? { ...p, tramoId: null, opcion: null, estado: 'Renuncia', importe: 0 } : p,
        )
      }
      const renuncia: Papeleta = {
        id: nuevoId(),
        numero: siguienteNumero(prev),
        hermanoId,
        anio: campana.anio,
        tramoId: null,
        importe: 0,
        estado: 'Renuncia',
        fechaSolicitud: hoy(),
      }
      return [renuncia, ...prev]
    })
  }

  /**
   * Saca (o rectifica) la papeleta de un hermano en un tramo concreto. Si ya
   * tenía una papeleta este año (una renuncia o una solicitud sin tramo), la
   * reutiliza; si no, crea una nueva.
   */
  /**
   * ¿Se le puede emitir papeleta a esta persona?
   *
   * Lo que esconde una pantalla no protege nada: entre que se pinta la fila y
   * se pulsa el botón, una ficha puede haber pasado a baja desde otro
   * ordenador. Y hay tres caminos que emiten —renovar, sacar en tramo y la
   * simbólica—, así que la comprobación va donde se emite, no solo donde se
   * pinta.
   */
  function saleEnElCortejo(hermanoId: string): boolean {
    return puedeSalirEnElCortejo(hermanos.find((h) => h.id === hermanoId))
  }

  function sacarEnTramo(hermanoId: string, tramoId: string) {
    if (!saleEnElCortejo(hermanoId)) return
    const importe = precioDeTramo(tramos.find((t) => t.id === tramoId), precioBase)
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id
            ? { ...p, tramoId, opcion: null, estado: 'Asignada', importe, pagoComunicado: null }
            : p,
        )
      }
      const nueva: Papeleta = {
        id: nuevoId(),
        numero: siguienteNumero(prev),
        hermanoId,
        anio: campana.anio,
        tramoId,
        importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    avisarDeSitio(hermanoId, tramos.find((t) => t.id === tramoId)?.nombre ?? null, null, tramoId)
    setPendingCuerpo('')
  }

  /**
   * Emite la PAPELETA SIMBÓLICA: la de quien tiene su sitio y este año no sale.
   *
   * No ocupa puesto en el cortejo, y ese es todo su sentido. Si el hermano
   * quisiera salir, sitio hay: se le emite en un tramo como a cualquiera.
   *
   * El nombre se guarda en la papeleta —no una referencia a una lista— para que
   * las papeletas de años pasados sigan diciendo lo que eran aunque la
   * hermandad cambie el precio o el texto.
   */
  const NOMBRE_SIMBOLICA = 'Papeleta simbólica'

  function sacarSimbolica(hermanoId: string) {
    if (!saleEnElCortejo(hermanoId)) return
    const importe = hermandad.precioSimbolica
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id
            ? { ...p, tramoId: null, opcion: NOMBRE_SIMBOLICA, estado: 'Asignada', importe, pagoComunicado: null }
            : p,
        )
      }
      const nueva: Papeleta = {
        id: nuevoId(),
        numero: siguienteNumero(prev),
        hermanoId,
        anio: campana.anio,
        tramoId: null,
        opcion: NOMBRE_SIMBOLICA,
        importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    avisarDeSitio(hermanoId, null, NOMBRE_SIMBOLICA)
    setPendingCuerpo('')
  }

  /*
   * QUÉ LLEVA ESTE CORREO, y por qué cada cosa.
   *
   * Antes decía «Ya tienes sitio: Cirio 1º tramo» y poco más. Eso está bien
   * como aviso, pero deja fuera lo único que el hermano va a necesitar
   * buscar después: A QUÉ HORA TIENE QUE ESTAR. Es literalmente la pregunta
   * de la semana antes de la salida, la que satura el teléfono de secretaría
   * y el grupo de WhatsApp.
   *
   * La hora de citación es de cada tramo —no salen todos a la vez— y hasta
   * ahora no se podía ni guardar, porque a la tabla le faltaba la columna.
   * Ya se guarda, así que ya se puede decir aquí.
   */
  function parrafosDePapeleta(texto: string, tramoId?: string | null): string[] {
    const t = tramoId ? tramos.find((x) => x.id === tramoId) : null
    const parrafos = [texto]
    if (t?.horaCitacion?.trim()) {
      parrafos.push(`Tu hora de citación es a las ${t.horaCitacion.trim()}.`)
    }
    if (campana.fechaSalida) {
      const f = new Date(`${campana.fechaSalida}T12:00:00`)
      if (!Number.isNaN(f.getTime())) {
        parrafos.push(`La salida es el ${f.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`)
      }
    }
    parrafos.push('Puedes ver tu papeleta y descargarla desde tu área de hermano.')
    return parrafos
  }

  /**
   * Le dice al hermano que ya tiene sitio. Es lo que espera desde que manda la
   * solicitud, y hasta ahora se enteraba al entrar en su área por su cuenta.
   */
  function avisarDeSitio(hermanoId: string, tramo: string | null, opcion: string | null, tramoId?: string | null) {
    const que = tramo ?? opcion
    const texto = que
      ? `Ya tienes sitio para la estación de penitencia de ${campana.anio}: ${que}.`
      : `Ya tienes papeleta para la estación de penitencia de ${campana.anio}.`
    agregarAvisoHermano(hermanoId, texto, 'papeleta', 'Tu papeleta de sitio')
    // Y por correo. Esta es de las que más se agradecen: hasta ahora el
    // hermano se enteraba de su sitio solo si entraba a mirarlo por su cuenta.
    const h = hermanos.find((x) => x.id === hermanoId)
    if (!h) return

    void avisarPorCorreo(
      [{ id: h.id, nombre: h.nombre, email: h.email }],
      'papeleta',
      'Tu papeleta de sitio',
      parrafosDePapeleta(texto, tramoId),
      'Este aviso lo puedes apagar desde tu área de hermano.',
    ).then((r) => {
      // No corta el guardado —la papeleta ya está emitida y eso es lo que
      // importa— pero deja rastro de que el aviso no salió.
      if (r.error) console.warn(`El aviso de papeleta a ${h.nombre} no salió: ${r.error}`)
    })
  }

  /**
   * EL BOTÓN «DESCARGAR / ENVIAR» SOLO IMPRIMÍA.
   *
   * La versión de móvil llevaba escrito «es la que se envía al hermano por
   * correo», pero el botón hacía `window.print()` y nada más: en ningún caso
   * —ni en local, ni con la base de datos conectada— salía un correo de
   * verdad. Quien lo pulsaba pensando que eso avisaba al hermano se quedaba
   * sin saberlo, porque no fallaba con un error: simplemente no hacía lo que
   * decía.
   *
   * Esto sí manda el correo, con el mismo aviso que se le manda solo al
   * asignar el sitio (para cuando el hermano dice que no le llegó, o hay que
   * reenviárselo).
   */
  const [enviandoPapeleta, setEnviandoPapeleta] = useState(false)
  async function enviarPapeletaPorCorreo(hermanoId: string, tramo: string | null, opcion: string | null, tramoId?: string | null) {
    if (enviandoPapeleta) return
    const h = hermanos.find((x) => x.id === hermanoId)
    if (!h) return
    if (!h.email || !h.email.includes('@')) {
      window.alert(`${h.nombre.split(' ')[0]} no tiene correo en su ficha. Añádeselo desde Hermanos y vuelve a intentarlo.`)
      return
    }
    const que = tramo ?? opcion
    const texto = que
      ? `Aquí tienes tu papeleta de sitio para la estación de penitencia de ${campana.anio}: ${que}.`
      : `Aquí tienes tu papeleta para la estación de penitencia de ${campana.anio}.`
    setEnviandoPapeleta(true)
    try {
      const r = await avisarPorCorreo(
        [{ id: h.id, nombre: h.nombre, email: h.email }],
        'papeleta',
        'Tu papeleta de sitio',
        parrafosDePapeleta(texto, tramoId),
        'Este aviso lo puedes apagar desde tu área de hermano.',
      )
      if (r.enviados > 0) {
        window.alert(`Correo enviado a ${h.nombre}.`)
      } else {
        window.alert(
          `No ha salido el correo${r.error ? `: ${r.error}` : '.'}\n\n`
          + 'Comprueba en Configuración → Correo que el envío está encendido.',
        )
      }
    } finally {
      setEnviandoPapeleta(false)
    }
  }
  return {
    renovar, noRenovar, sacarEnTramo, sacarSimbolica, saleEnElCortejo,
    avisarDeSitio, enviandoPapeleta, enviarPapeletaPorCorreo,
  }
}
