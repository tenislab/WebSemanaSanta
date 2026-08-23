/**
 * «AVISADME DE LOS CULTOS» — quien sigue a la hermandad sin ser hermano.
 *
 * Alrededor de una hermandad hay mucha más gente que hermanos: vecinos del
 * barrio, devotos, gente que se crió allí y vive fuera, quien va todos los años
 * a ver la salida. Toda esa gente se entera de los cultos por casualidad, o no
 * se entera, porque los avisos van al censo y ellos no están en el censo.
 *
 * Y NO SE LES PUEDE METER EN EL CENSO: de ahí cuelgan las cuotas, las papeletas
 * y la antigüedad. Meter a un vecino ahí para poder avisarle rompe el censo y
 * le da una condición que no tiene. Esto es una lista aparte.
 *
 * PARA ENCENDERLO: ejecuta `supabase/suscriptores-web.sql` una vez.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { hermandadDestino } from './multiHermandad'

/**
 * Lo que se acepta al apuntarse, palabra por palabra.
 *
 * Se guarda junto con la fecha porque es LA PRUEBA del consentimiento: si algún
 * día alguien reclama, la hermandad tiene que poder enseñar qué aceptó y
 * cuándo. Un «marcó la casilla» sin el texto no demuestra nada, porque el texto
 * puede haber cambiado veinte veces desde entonces.
 */
export function textoDelConsentimiento(hermandad: string): string {
  return (
    `Acepto que ${hermandad || 'la hermandad'} guarde mi correo para avisarme de sus cultos y `
    + 'actividades. Puedo darme de baja cuando quiera desde el enlace que sale en cada aviso.'
  )
}

export interface Suscriptor {
  id: string
  email: string
  nombre: string
  confirmado: boolean
  altaEn: string
  origen: string
  /**
   * Su llave, para poder poner SU enlace de baja en el correo que se le manda.
   * Solo la lee el panel: la política de Supabase no deja leer esta tabla a
   * nadie más.
   */
  llave?: string
}

export type ResultadoAlta =
  | { ok: true; llave: string }
  | { ok: false; error: string }

/**
 * Apuntarse desde la web pública.
 *
 * DEVUELVE LO MISMO SI EL CORREO YA ESTABA. Contestar «ese correo ya está
 * apuntado» le diría a cualquiera quién está en la lista, y eso es filtrar los
 * datos de otro. Desde fuera no hay forma de distinguir los dos casos, que es
 * exactamente lo que se quiere.
 */
export async function suscribirse(
  email: string,
  nombre: string,
  nombreHermandad: string,
): Promise<ResultadoAlta> {
  /*
   * EL CORREO SE MIRA PRIMERO, antes que la conexión.
   *
   * Es lo que puede arreglar quien está delante. Diciéndole «ahora mismo no se
   * puede, inténtalo más tarde» a alguien que se ha comido la arroba, se va y
   * vuelve dentro de una hora a que le pase lo mismo.
   */
  if (!pareceUnCorreo(email)) {
    return { ok: false, error: 'Ese correo no parece correcto. Míralo y vuelve a intentarlo.' }
  }
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente) {
    return { ok: false, error: 'Ahora mismo no se pueden recoger avisos. Inténtalo más tarde.' }
  }

  const hermandadId = await hermandadDestino()
  if (!hermandadId) {
    return { ok: false, error: 'No se ha podido saber a qué hermandad avisar. Recarga la página e inténtalo otra vez.' }
  }

  try {
    const { data, error } = await cliente.rpc('suscribirse_a_la_web', {
      p_hermandad_id: hermandadId,
      p_email: email.trim(),
      p_nombre: nombre.trim(),
      p_texto: textoDelConsentimiento(nombreHermandad),
    })
    if (error) return { ok: false, error: 'No se ha podido apuntar el correo. Inténtalo otra vez.' }
    // La función devuelve null cuando el correo no le vale. No debería llegar
    // aquí —se comprueba antes— pero si llega, se dice y no se calla.
    if (!data) return { ok: false, error: 'Ese correo no parece correcto. Míralo y vuelve a intentarlo.' }
    return { ok: true, llave: String(data) }
  } catch {
    return { ok: false, error: 'No se ha podido apuntar el correo. Revisa la conexión.' }
  }
}

/** Confirmar con la llave del enlace del correo. */
export async function confirmar(llave: string): Promise<boolean> {
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente || !llave.trim()) return false
  try {
    const { data, error } = await cliente.rpc('confirmar_suscripcion', { p_llave: llave.trim() })
    return !error && data === true
  } catch {
    return false
  }
}

/**
 * Darse de baja con la llave. Borra la fila.
 *
 * Guardar «este pidió la baja» obligaría a seguir teniendo su correo para
 * acordarse de no escribirle, que es lo contrario de lo que ha pedido.
 */
export async function darseDeBaja(llave: string): Promise<boolean> {
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente || !llave.trim()) return false
  try {
    const { data, error } = await cliente.rpc('baja_de_la_web', { p_llave: llave.trim() })
    return !error && data === true
  } catch {
    return false
  }
}

/** La lista, para el panel. Vacía si no se puede leer: nunca inventada. */
export async function getSuscriptores(): Promise<Suscriptor[]> {
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente) return []
  try {
    const { data, error } = await cliente
      .from('suscriptores_web')
      .select('id, email, nombre, confirmado, alta_en, origen, llave')
      .order('alta_en', { ascending: false })
    if (error || !data) return []
    return (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      email: String(r.email ?? ''),
      nombre: String(r.nombre ?? ''),
      confirmado: r.confirmado === true,
      altaEn: String(r.alta_en ?? ''),
      origen: String(r.origen ?? 'web'),
      llave: r.llave ? String(r.llave) : undefined,
    }))
  } catch {
    return []
  }
}

/**
 * MANDAR UN COMUNICADO A LOS SUSCRIPTORES.
 *
 * UNO A UNO, y no todos en el mismo correo. No es un descuido: cada uno lleva
 * SU enlace de baja, con su llave. Metidos todos en un envío no cabe más que un
 * enlace, así que o no se pone —y entonces la hermandad está mandando correo
 * comercial sin salida, que es exactamente lo que multa la AEPD— o se pone uno
 * genérico que le daría de baja a otro.
 *
 * Y DE CINCO EN CINCO, no todos a la vez: con doscientos suscriptores,
 * doscientas peticiones simultáneas las corta el servidor de correo y lo lee
 * como un ataque. Tarda más y llega.
 *
 * Devuelve a cuántos ha llegado y a cuántos no, sin inventar: quien lo llama lo
 * enseña tal cual.
 */
export async function avisarASuscriptores(
  lista: Suscriptor[],
  asunto: string,
  cuerpo: (baja: string) => { texto: string; html: string },
  enviar: (m: { para: string[]; asunto: string; texto: string; html: string }) => Promise<{ ok: boolean }>,
  origen: string,
): Promise<{ enviados: number; fallidos: number }> {
  // Solo los confirmados. Escribir a quien no confirmó es lo que hace que los
  // envíos de la hermandad acaben marcados como spam.
  const destinatarios = losQueSePuedenAvisar(lista)
  let enviados = 0
  let fallidos = 0

  const DE_UNA_VEZ = 5
  for (let i = 0; i < destinatarios.length; i += DE_UNA_VEZ) {
    const tanda = destinatarios.slice(i, i + DE_UNA_VEZ)
    const idas = await Promise.all(tanda.map(async (s) => {
      try {
        const { texto, html } = cuerpo(enlaceDeBaja(origen, s.llave ?? ''))
        const r = await enviar({ para: [s.email], asunto, texto, html })
        return r.ok
      } catch {
        return false
      }
    }))
    for (const ok of idas) {
      if (ok) enviados += 1
      else fallidos += 1
    }
  }
  return { enviados, fallidos }
}

/** Quitar a alguien desde el panel (lo pide por teléfono, se equivocó al escribirlo…). */
export async function borrarSuscriptor(id: string): Promise<boolean> {
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente) return false
  try {
    const { error } = await cliente.from('suscriptores_web').delete().eq('id', id)
    return !error
  } catch {
    return false
  }
}

/**
 * A quién se le puede escribir de verdad: solo los confirmados.
 *
 * Escribir a los que no han confirmado es lo que hace que los envíos de la
 * hermandad acaben en spam — y en el peor caso, escribirle a alguien que nunca
 * pidió nada porque otro apuntó su correo.
 */
export function losQueSePuedenAvisar(lista: Suscriptor[]): Suscriptor[] {
  return lista.filter((s) => s.confirmado)
}

/** El enlace que se le manda para confirmar. */
export function enlaceDeConfirmacion(origen: string, llave: string): string {
  return `${origen}/avisos?c=${encodeURIComponent(llave)}`
}

/** El de darse de baja, que va al pie de CADA aviso. Es obligatorio. */
export function enlaceDeBaja(origen: string, llave: string): string {
  return `${origen}/avisos?baja=${encodeURIComponent(llave)}`
}

/**
 * Una comprobación mínima, no una validación de correos. La de verdad la hace
 * el correo de confirmación: si la dirección no existe, nunca se confirma.
 * Aquí solo se paran los despistes evidentes.
 */
export function pareceUnCorreo(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(email.trim())
}
