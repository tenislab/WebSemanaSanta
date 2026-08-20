/**
 * El puente entre los avisos del área del hermano y el correo.
 *
 * Hasta ahora solo los comunicados salían por correo. Los interruptores de
 * «avisar de cuotas / papeletas / cambios en la ficha» estaban en Configuración
 * y no encendían nada: el aviso llegaba al buzón del área del hermano y ahí se
 * quedaba, esperando a que entrase a mirar. Un recibo devuelto del que nadie se
 * entera hasta la próxima vez que abre la aplicación no sirve de mucho.
 *
 * Aquí está todo junto para que la decisión de a quién se le manda se tome en
 * UN sitio y no en cinco pantallas distintas. Se manda solo si:
 *
 *   1. La hermandad tiene el correo conectado (`activo` en Configuración).
 *   2. La hermandad ha encendido ese tipo de aviso.
 *   3. Ese hermano en concreto no lo ha apagado en su área.
 *   4. Tiene un correo que parezca un correo.
 *
 * El punto 3 importa: que la hermandad encienda los avisos no le quita a nadie
 * su decisión. Y el orden importa también, porque es el mismo que ya usaban
 * los comunicados: así los cuatro tipos se comportan igual.
 *
 * Ninguna de estas funciones lanza excepciones. Un correo que no sale no puede
 * tumbar el guardado de una cuota: el dato es lo importante, el aviso es un
 * extra.
 */
import { enviarCorreo, getAjustesCorreo } from './correo'
import { getPreferenciasAvisos, quiereAviso, type TipoAviso } from './avisosHermano'
import { getHermandadSettings } from './hermandadSettings'

/** Quien recibe: lo mínimo que hace falta saber de un hermano para escribirle. */
export interface DestinatarioAviso {
  id: string
  nombre: string
  email: string
}

function correoValido(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())
}

/** El interruptor de Configuración que manda sobre cada tipo de aviso. */
const INTERRUPTOR: Record<TipoAviso, 'comunicados' | 'cuotas' | 'papeletas' | 'ficha'> = {
  comunicado: 'comunicados',
  cuota: 'cuotas',
  papeleta: 'papeletas',
  ficha: 'ficha',
}

/**
 * Los hermanos que SÍ quieren recibir esto por correo: la hermandad lo tiene
 * encendido, ellos no lo han apagado, y su correo parece un correo.
 *
 * Aquí NO se mira si hay base de datos conectada, aunque sin ella no se pueda
 * mandar nada. Esto responde a «quién querría enterarse», que es una decisión
 * de la hermandad y de cada hermano; si el canal está levantado o no lo dice
 * `enviarCorreo`, que es quien lo usa. Separarlo así deja esta parte —la que
 * decide a quién se le escribe, que es la delicada— probada de verdad.
 */
export function destinatariosDe(
  gente: DestinatarioAviso[],
  tipo: TipoAviso,
  ajustes = getAjustesCorreo(),
): DestinatarioAviso[] {
  if (!ajustes.activo) return []
  if (!ajustes.avisaDe[INTERRUPTOR[tipo]]) return []
  return gente.filter(
    (h) => correoValido(h.email ?? '') && quiereAviso(getPreferenciasAvisos(h.id), tipo),
  )
}

function escapar(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * El cuerpo del correo, con el membrete de la hermandad.
 *
 * Se escribe a mano y sin imágenes externas a propósito: un correo con el logo
 * enlazado desde fuera lo bloquean casi todos los clientes y se ve roto. El
 * nombre de la hermandad en texto se ve siempre y en todas partes.
 */
export function cuerpoCorreo(titulo: string, parrafos: string[], pie?: string): { texto: string; html: string } {
  const hermandad = getHermandadSettings().nombreLegal || 'Tu hermandad'
  const texto = [titulo, '', ...parrafos, '', pie ?? '', `— ${hermandad}`].filter((l) => l !== undefined).join('\n')
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;max-width:34rem;color:#1c1917">` +
    `<h2 style="margin:0 0 0.8rem;font-size:1.2rem">${escapar(titulo)}</h2>` +
    parrafos.map((p) => `<p style="margin:0 0 0.7rem">${escapar(p).replace(/\n/g, '<br>')}</p>`).join('') +
    (pie ? `<p style="margin:1rem 0 0;font-size:0.9rem;color:#57534e">${escapar(pie)}</p>` : '') +
    `<hr style="border:0;border-top:1px solid #e7e5e4;margin:1.2rem 0 0.6rem">` +
    `<p style="margin:0;font-size:0.85rem;color:#78716c">${escapar(hermandad)}</p>` +
    `</div>`
  return { texto, html }
}

/**
 * Manda un aviso por correo a quien corresponda. Devuelve a cuántos ha salido.
 *
 * Se llama DESPUÉS de guardar y de dejar el aviso en el buzón del área, nunca
 * antes: si el correo falla, el hermano se entera igual la próxima vez que
 * entre. Al revés —mandar el correo y que falle el guardado— sería avisar de
 * algo que no ha pasado.
 */
export async function avisarPorCorreo(
  gente: DestinatarioAviso[],
  tipo: TipoAviso,
  titulo: string,
  parrafos: string[],
  pie?: string,
): Promise<{ enviados: number; error?: string }> {
  try {
    const destinos = destinatariosDe(gente, tipo)
    if (destinos.length === 0) return { enviados: 0 }
    const { texto, html } = cuerpoCorreo(titulo, parrafos, pie)
    const r = await enviarCorreo({ para: destinos.map((d) => d.email), asunto: titulo, texto, html })
    return r.ok ? { enviados: r.enviados ?? destinos.length } : { enviados: 0, error: r.error }
  } catch (e) {
    // Un aviso que no sale no puede tumbar lo que se acaba de guardar.
    console.warn('No se pudo mandar el aviso por correo:', e)
    return { enviados: 0, error: 'No se pudo mandar el aviso por correo.' }
  }
}
