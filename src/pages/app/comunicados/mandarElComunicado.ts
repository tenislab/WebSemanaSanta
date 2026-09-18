/**
 * MANDAR UN COMUNICADO, AHORA.
 *
 * Al buzón del área de cada hermano SIEMPRE —eso no depende de que la
 * hermandad tenga proveedor de correo contratado— y por correo si lo tiene
 * conectado y encendido para los comunicados, respetando lo que cada hermano
 * haya apagado en su área.
 *
 * Son tres caminos distintos y no uno, que es de dónde salen las 176 líneas:
 *
 *   · A LOS DE FUERA, uno a uno. Cada suscriptor lleva SU enlace de baja, con
 *     su llave: metidos todos en el mismo envío no cabe más que un enlace, así
 *     que o no se pone —correo sin salida, que es lo que multa la AEPD— o se
 *     pone uno que daría de baja a otra persona.
 *   · CON MARCAS («Hola {nombre}»), uno por persona, apuntando el avance.
 *   · SIN MARCAS, de una vez y en tandas. Es la mayoría, y no paga el precio
 *     de la fila quien no lo necesita.
 *
 * Y en los tres se dice a cuántos NO les ha llegado. Un «Enviado» a secas
 * encima de un envío que se paró en el número doce es la peor manera de acabar
 * esto.
 *
 * Es una función libre y no un hook: no tiene estado propio: lo que necesita
 * se le pasa en `ctx` de una vez, y así la llaman igual el botón de la ficha y
 * el formulario de nuevo —que es lo que evita que vuelvan a separarse, porque
 * ya pasó: las dos se llamaban «Enviar ahora» y hacían cosas distintas—.
 */
import type { Comunicado } from '../../../data/comunicados'
import type { Suscriptor } from '../../../lib/suscriptoresWeb'
import { avisarASuscriptores } from '../../../lib/suscriptoresWeb'
import { agregarAvisoAVarios, getPreferenciasAvisos, quiereAviso } from '../../../lib/avisosHermano'
import { correoDisponible, enviarCorreo, enviarCorreoUnoAUno, getAjustesCorreo } from '../../../lib/correo'
import { cuerpoCorreo } from '../../../lib/avisosCorreo'
import { llevaMarcas, personalizar, sePuedePersonalizar } from '../../../lib/personalizar'
import { getHermandadSettings } from '../../../lib/hermandadSettings'
import { hoyIso } from '../../../lib/hoy'
import type { Alcance } from './alcance'

/** El estado del último envío por correo, para no dejarlo en silencio. */
export type EstadoEnvio = { estado: 'enviando' | 'hecho' | 'error'; texto?: string } | null

/** Lo que hace falta de la pantalla para poder mandar. */
export interface ParaMandar {
  resolverDestinatario: (c: Pick<Comunicado, 'destinatarios' | 'criterios'>) => Alcance
  cuantosSon: (a: Alcance) => number
  setComunicados: React.Dispatch<React.SetStateAction<Comunicado[]>>
  setSelected: (c: Comunicado | null) => void
  setEnvioCorreo: (e: EstadoEnvio) => void
  listaSuscriptores: Suscriptor[]
  /** `true` = no se pudo preguntar. NO es lo mismo que «no hay ninguno». */
  noSeSupoDeLosSuscriptores: boolean
}

export async function mandarElComunicado(c: Comunicado, ctx: ParaMandar) {
  const {
    resolverDestinatario, cuantosSon, setComunicados, setSelected, setEnvioCorreo,
    listaSuscriptores, noSeSupoDeLosSuscriptores,
  } = ctx
  const hoy = hoyIso()
  // Al buzón de cada hermano en su área, SIEMPRE. Es lo que no depende de que
  // haya proveedor de correo contratado.
  const alcance = resolverDestinatario(c)
  const reciben = alcance.hermanos

  // El alcance sale de a quién se le ha escrito DE VERDAD. Antes se calculaba
  // aparte con `hermanosDeDestinatario`, que no sabe resolver un segmento, así
  // que un comunicado que no había llegado a nadie podía quedar registrado
  // con 84 personas alcanzadas.
  const actualizado: Comunicado = { ...c, estado: 'Enviado', fechaEnvio: hoy, alcance: cuantosSon(alcance) }
  setComunicados((prev) => prev.map((x) => (x.id === c.id ? actualizado : x)))
  setSelected(actualizado)

  agregarAvisoAVarios(reciben.map((h) => h.id), c.cuerpo, 'comunicado', c.titulo)

  // Y por correo, si la hermandad lo tiene conectado y encendido para los
  // comunicados. Se respeta lo que cada hermano haya apagado en su área: que
  // la hermandad active el correo no le quita a nadie su decisión.
  const ajustes = getAjustesCorreo()
  if (!correoDisponible(ajustes) || !ajustes.avisaDe.comunicados) return
  /*
   * SE GUARDA QUIÉN ES CADA UNO, NO SOLO SU DIRECCIÓN.
   *
   * Antes esto era una lista de correos y punto, porque el cuerpo era el
   * mismo para todos. En cuanto el texto dice «Hola {nombre}» hay que saber
   * de quién es cada dirección, así que se lleva la persona al lado.
   *
   * A los de `soloCorreo` —la junta con cuenta pero sin ficha— NO se les pone
   * número de hermano: no lo son. `{numero}` se les queda vacío, que es la
   * verdad, en vez de un cero impreso en un correo.
   */
  const destinos: { email: string; nombre: string; numero?: number | null }[] = [
    ...reciben
      .filter((h) => quiereAviso(getPreferenciasAvisos(h.id), 'comunicado'))
      .map((h) => ({ email: h.email, nombre: h.nombre, numero: h.numero })),
    // La junta con cuenta pero sin ficha en el censo. No tiene área donde
    // apagar los avisos, así que no hay preferencia que respetar: se le manda.
    ...alcance.soloCorreo.map((p) => ({ email: p.email, nombre: p.nombre, numero: null })),
  ].filter((d) => d.email && d.email.includes('@'))
  const direcciones = destinos.map((d) => d.email)
  if (direcciones.length === 0) return
  setEnvioCorreo({ estado: 'enviando' })
  // El mismo membrete que los demás avisos: la banda con el color y el
  // nombre de la hermandad. Antes esta pantalla se montaba su propio HTML a
  // mano, así que el comunicado —que es el correo que MÁS se manda— era el
  // único que llegaba sin identificar de quién era.
  /*
   * A LOS DE FUERA SE LES ESCRIBE UNO A UNO.
   *
   * No es un descuido: cada suscriptor lleva SU enlace de baja, con su llave.
   * Metidos todos en el mismo envío no cabe más que un enlace, así que o no
   * se pone —y entonces la hermandad está mandando correo sin salida, que es
   * lo que multa la AEPD— o se pone uno que daría de baja a otra persona.
   *
   * Al censo se le sigue mandando de una vez: el hermano tiene su área para
   * apagar los avisos, no le hace falta enlace de baja.
   */
  if (alcance.aSuscriptores) {
    /*
     * SI NO SE SUPO QUIÉNES SON, NO SE MANDA Y SE DICE.
     *
     * `getSuscriptores()` devuelve `null` cuando la consulta no se pudo
     * hacer. Dando eso por «no hay ninguno», el envío se hacía igual, no
     * escribía a nadie, y la pantalla decía «Enviado por correo a 0
     * suscriptores» — con lo que la hermandad se quedaba convencida de que su
     * boletín había salido. Un envío a cero no es un envío.
     */
    if (noSeSupoDeLosSuscriptores) {
      setEnvioCorreo({
        estado: 'error',
        texto: 'No se ha podido leer la lista de suscriptores, así que no se ha mandado nada. '
          + 'Vuelve a abrir la pantalla y prueba otra vez: mandarlo ahora sería no mandárselo a nadie.',
      })
      return
    }
    const origen = window.location.origin
    const { enviados, fallidos } = await avisarASuscriptores(
      listaSuscriptores,
      c.titulo,
      (baja) => {
        const { texto, html } = cuerpoCorreo(c.titulo, c.cuerpo.split('\n\n'))
        return {
          texto: `${texto}\n\n—\nSi no quieres recibir más avisos: ${baja}`,
          html: `${html}<p style="font-size:12px;color:#777;margin-top:24px">`
            + `Recibes esto porque te apuntaste en la web de la hermandad. `
            + `<a href="${baja}">Darme de baja</a>.</p>`,
        }
      },
      (m) => enviarCorreo(m),
      origen,
    )
    setEnvioCorreo(
      fallidos === 0
        ? { estado: 'hecho', texto: `Enviado por correo a ${enviados} suscriptores de la web.` }
        : {
          estado: 'error',
          texto: `Enviado a ${enviados}. A ${fallidos} no se ha podido: revisa Configuración → Correo.`,
        },
    )
    return
  }

  /*
   * ¿LLEVA MARCAS? Entonces no hay UN correo: hay uno por persona.
   *
   * Y por eso se pregunta primero, en vez de mandar siempre uno a uno: un
   * comunicado sin marcas —que son la mayoría— sigue saliendo de una vez, en
   * tandas de cincuenta. Solo paga el precio de la fila quien lo necesita.
   */
  if (llevaMarcas(c.cuerpo) || llevaMarcas(c.titulo)) {
    /*
     * EL FRENO, OTRA VEZ AQUÍ. Ya está en el formulario, pero un comunicado
     * guardado ayer con `{nombe}` dentro llega hasta aquí sin volver a pasar
     * por él. Lo que no se puede deshacer es el correo.
     */
    const revision = sePuedePersonalizar(`${c.titulo}\n${c.cuerpo}`)
    if (!revision.puede) {
      setEnvioCorreo({ estado: 'error', texto: `${revision.motivo} No se ha mandado nada.` })
      return
    }
    const ctx = {
      hermandad: getHermandadSettings().nombreLegal,
      ejercicio: new Date().getFullYear(),
    }
    const mensajes = destinos.map((d) => {
      const asunto = personalizar(c.titulo, d, ctx)
      const cuerpo = personalizar(c.cuerpo, d, ctx)
      const { texto, html } = cuerpoCorreo(asunto, cuerpo.split('\n\n'))
      return { para: d.email, asunto, texto, html }
    })
    const u = await enviarCorreoUnoAUno(mensajes, (hechos, total) => {
      setEnvioCorreo({ estado: 'enviando', texto: `Enviando, uno por uno: ${hechos} de ${total}…` })
    })
    /*
     * Y SE CUENTA LO QUE HA PASADO DE VERDAD, incluidos los que se quedaron
     * sin intentar cuando se cortó. «Enviado» a secas encima de un envío que
     * se paró en el número doce es la peor manera de acabar esto.
     */
    setEnvioCorreo(
      u.cortado
        ? { estado: 'error', texto: u.error ?? 'Se cortó el envío.' }
        : u.fallidos > 0
          ? {
            estado: 'error',
            texto: `Enviado a ${u.enviados} de ${mensajes.length}. A ${u.fallidos} no se ha podido: `
              + `revisa sus correos en Hermanos, porque a esas personas no les ha llegado nada.`
              + (u.error ? ` (${u.error})` : ''),
          }
          : { estado: 'hecho', texto: `Enviado por correo a ${u.enviados} personas, cada una con su nombre.` },
    )
    return
  }

  const { texto, html } = cuerpoCorreo(c.titulo, c.cuerpo.split('\n\n'))
  const r = await enviarCorreo({ para: direcciones, asunto: c.titulo, texto, html })
  /*
   * Y SE DICE A CUÁNTOS NO LES HA LLEGADO. Las direcciones mal escritas se
   * descartaban en silencio: la hermandad marcaba 612 destinatarios, la
   * pantalla decía «enviado a 572» y nadie caía en la diferencia. Esos
   * cuarenta no se enteran de nada —ni de los cabildos, ni de los cultos, ni
   * de que se les ha emitido la cuota—, y como el comunicado queda en
   * «Enviado», no vuelve a intentarse nunca.
   */
  const fuera = r.sinCorreoValido ?? 0
  const aviso = fuera > 0
    ? ` ${fuera} ${fuera === 1 ? 'no tenía' : 'no tenían'} un correo válido en el censo: `
      + `${fuera === 1 ? 'revísalo' : 'revísalos'} en Hermanos, porque a ${fuera === 1 ? 'esa persona' : 'esas personas'} no les llega nada.`
    : ''
  setEnvioCorreo(
    r.ok
      ? { estado: fuera > 0 ? 'error' : 'hecho', texto: `Enviado por correo a ${r.enviados} hermanos.${aviso}` }
      : { estado: 'error', texto: `${r.error ?? 'No se pudo mandar el correo.'}${aviso}` },
  )
}
