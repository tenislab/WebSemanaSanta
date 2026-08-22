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
 * LA CONTRASEÑA NO VA EN EL CORREO, y es a propósito.
 *
 * Mandarla escrita la deja para siempre en un buzón que se sincroniza con el
 * móvil, el ordenador de casa y el del trabajo. Y no hace falta: la clave con
 * la que entra la primera vez es SU PROPIO DNI, que ya se sabe. Así que el
 * correo dice cómo entrar, no con qué — y le pide que la cambie nada más
 * entrar, que es lo que hay que hacer de todas formas.
 *
 * Si la hermandad le puso otra clave distinta del DNI, el correo lo dice sin
 * escribirla: «la que te haya dado la hermandad».
 */
export interface DatosBienvenida {
  id: string
  nombre: string
  email: string
  dni: string
  /** Su número en el censo, si ya lo tiene. 0 mientras se le asigna. */
  numero?: number
  /** Si su clave inicial es su propio DNI, se le puede decir cuál es. */
  claveEsElDni: boolean
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
  parrafos.push(
    h.claveEsElDni
      ? `Para entrar, busca tu hermandad y usa tu DNI (${h.dni}) como usuario. La primera vez, `
        + 'la contraseña es también tu DNI: cámbiala nada más entrar.'
      : `Para entrar, busca tu hermandad y usa tu DNI (${h.dni}) como usuario, con la contraseña `
        + 'que te haya dado la hermandad. Cámbiala nada más entrar.',
  )
  parrafos.push(
    'Si no recuerdas la contraseña, desde la misma pantalla puedes pedir una nueva a tu correo.',
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
