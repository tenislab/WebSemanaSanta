import { avisarPorCorreo } from './avisosCorreo'

/**
 * EL CORREO DE BIENVENIDA, el que se manda al dar de alta a un hermano.
 *
 * Hasta ahora, al dar de alta a alguien había que decirle a mano —por teléfono,
 * por WhatsApp, o en el mostrador— cómo entrar en su área. En una hermandad que
 * da de alta a treinta personas después de un cabildo, eso son treinta
 * llamadas, y las que no se hacen se convierten en treinta personas que no
 * saben que tienen un área.
 *
 * LA CONTRASEÑA, Y POR QUÉ AHORA SÍ VA EN EL CORREO.
 *
 * Antes la contraseña inicial era SU PROPIO DNI, así que no hacía falta
 * mandarla: ya se la sabía. El problema es que también se la sabía cualquiera
 * que pudiera leer el censo, porque el DNI está en la ficha.
 *
 * Ahora es aleatoria y no se guarda en ninguna parte —ni en la ficha ni en la
 * base—, así que este correo es la ÚNICA vez que se escribe. Va marcada como
 * de un solo uso y con la petición de cambiarla al entrar, que es lo primero
 * que se le ofrece en su área.
 *
 * Si la eligió ella misma al pedir el alta, no se le repite: ya la sabe y
 * escribirla otra vez solo añade un sitio más donde queda.
 */
export interface DatosBienvenida {
  id: string
  nombre: string
  email: string
  dni: string
  /** Su número en el censo, si ya lo tiene. 0 mientras se le asigna. */
  numero?: number
  /**
   * La contraseña de un solo uso con la que se ha creado su cuenta, si se la
   * hemos puesto nosotros. `null` si la eligió ella al pedir el alta, o si no
   * hay cuenta que crear (un menor a cargo de su tutor).
   */
  claveProvisional?: string | null
  hermandad?: string
}

export function textoBienvenida(h: DatosBienvenida): { asunto: string; parrafos: string[]; pie: string } {
  const casa = h.hermandad?.trim()
  const nombreCorto = h.nombre.trim().split(/\s+/)[0]
  /*
   * «Ya formas parte de» y no «ya estás dado de alta»: lo segundo hay que
   * concordarlo en género —«dada» para ella— y la ficha no guarda el género de
   * nadie ni tiene por qué. Una fórmula que vale para cualquiera evita el
   * ridículo de escribirle «ya estás dado de alta» a María.
   */
  const parrafos: string[] = [
    casa
      ? `${nombreCorto}, ya formas parte de ${casa}.`
      : `${nombreCorto}, ya formas parte de la hermandad.`,
  ]
  if (h.numero && h.numero > 0) {
    parrafos.push(`Tu número de hermano es el ${h.numero}.`)
  }
  parrafos.push(
    'Tienes un área propia donde puedes ver tus cuotas, sacar tu papeleta de sitio, consultar '
    + 'tu sitio en el cortejo y cambiar tus datos de contacto.',
  )
  parrafos.push(`Para entrar, busca tu hermandad y usa tu DNI (${h.dni}) como usuario.`)
  if (h.claveProvisional) {
    parrafos.push(
      `Tu contraseña es ${h.claveProvisional}, y es de un solo uso: cámbiala nada más entrar, `
      + 'desde «Mi cuenta» en tu área. Este es el único correo donde aparece.',
    )
  } else {
    parrafos.push('La contraseña es la que elegiste al pedir el alta.')
  }
  parrafos.push(
    'Si no la recuerdas, desde la misma pantalla puedes pedir una nueva a tu correo.',
  )
  return {
    asunto: casa ? `Ya eres hermano/a de ${casa}` : 'Ya eres hermano/a de la hermandad',
    parrafos,
    pie: casa
      ? `${casa} · Este aviso lo puedes apagar desde tu área de hermano.`
      : 'Este aviso lo puedes apagar desde tu área de hermano.',
  }
}

/**
 * Manda la bienvenida. No corta nada si falla: el hermano ya está dado de alta
 * y eso es lo que importa; el correo se puede repetir desde su ficha.
 */
export async function darLaBienvenida(h: DatosBienvenida): Promise<{ enviados: number; error?: string }> {
  if (!h.email || !h.email.includes('@')) return { enviados: 0 }
  const { asunto, parrafos, pie } = textoBienvenida(h)
  return avisarPorCorreo([{ id: h.id, nombre: h.nombre, email: h.email }], 'ficha', asunto, parrafos, pie)
}
