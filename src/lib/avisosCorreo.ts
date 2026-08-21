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
import { cargarAjustesCorreoDeLaBase, enviarCorreo, getAjustesCorreo } from './correo'
import { cargarPreferenciasDeLaBase, getPreferenciasAvisos, quiereAviso, type TipoAviso } from './avisosHermano'
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

/**
 * El interruptor de Configuración que manda sobre cada tipo de aviso.
 *
 * `importante` no está aquí a propósito: no tiene interruptor. Ver el comentario
 * de `TipoAviso`.
 */
const INTERRUPTOR: Record<Exclude<TipoAviso, 'importante'>, 'comunicados' | 'cuotas' | 'papeletas' | 'ficha'> = {
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
/**
 * Deja al día, en este navegador, lo que hace falta para decidir a quién se
 * escribe: la configuración de correo de la hermandad y lo que cada hermano
 * haya apagado.
 *
 * Lo llaman al montar las pantallas que mandan avisos (Cuotas, Papeletas,
 * Comunicados, Hermanos). Sin esto, quien entra desde otro ordenador trabaja
 * con la configuración de fábrica: correo apagado y preferencias vacías. En un
 * caso no sale ningún aviso; en el otro se le escribe a quien había pedido que
 * no. Los dos en silencio.
 */
export async function prepararAvisos(): Promise<void> {
  await Promise.all([cargarAjustesCorreoDeLaBase(), cargarPreferenciasDeLaBase()])
}

export function destinatariosDe(
  gente: DestinatarioAviso[],
  tipo: TipoAviso,
  ajustes = getAjustesCorreo(),
): DestinatarioAviso[] {
  if (!ajustes.activo) return []
  // Los importantes solo dependen de que el correo esté encendido: no hay
  // interruptor que los pueda dejar fuera.
  if (tipo !== 'importante' && !ajustes.avisaDe[INTERRUPTOR[tipo]]) return []
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
 * El color de la hermandad, solo si de verdad es un color.
 *
 * Sale de lo que hayan escrito en Configuración y acaba dentro de un atributo
 * `style` del correo. Si se metiera tal cual, cualquiera que pueda editar los
 * ajustes podría escribir ahí lo que quisiera y colarlo en el correo que
 * reciben mil hermanos. Se comprueba que sea un color de seis o tres cifras y,
 * si no lo es, se usa el de siempre.
 */
function colorSeguro(valor: string | undefined): string {
  const v = (valor ?? '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v) ? v : '#6A1A23'
}

/**
 * El cuerpo del correo, con el membrete de la hermandad.
 *
 * SIN IMÁGENES, y no por dejadez. El logo de la hermandad está guardado como
 * texto dentro de la base de datos, y Gmail —que es donde va a caer la mayoría
 * de esto— bloquea las imágenes en ese formato: se vería un hueco roto en la
 * cabecera de cada correo, que es peor que no poner nada. Para que se viera
 * habría que subirlo a una dirección pública y enlazarlo desde ahí, y eso es
 * otra historia y depende del dominio.
 *
 * Lo que sí se puede y se hace: **su color y su nombre**. Eso se ve en todos
 * los clientes de correo, incluidos los que bloquean todo lo demás, y es lo
 * que hace que el hermano reconozca de quién es el correo antes de leerlo.
 *
 * Todo va con estilos escritos a mano dentro de cada etiqueta porque en un
 * correo no hay hojas de estilo: la mitad de los clientes las tiran.
 */
export function cuerpoCorreo(titulo: string, parrafos: string[], pie?: string): { texto: string; html: string } {
  const ajustes = getHermandadSettings()
  const hermandad = ajustes.nombreLegal || 'Tu hermandad'
  const color = colorSeguro(ajustes.colorPrimario)

  const texto = [titulo, '', ...parrafos, '', pie ?? '', `— ${hermandad}`].filter((l) => l !== undefined).join('\n')

  const html =
    // `lang="es"` no es un adorno: sin él, Gmail adivina el idioma por el
    // texto y se equivoca a menudo con los mensajes cortos. Al hermano le
    // salía, encima de un comunicado de SU hermandad, un «parece que este
    // mensaje está en inglés · ¿traducir?». Eso resta credibilidad justo en el
    // correo que más se manda.
    `<div lang="es" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;max-width:34rem;color:#1c1917">` +
    // La banda de arriba con el nombre: es lo primero que se ve al abrirlo y
    // lo que dice de quién es sin tener que leer nada.
    `<div style="background:${color};color:#ffffff;padding:0.9rem 1.1rem;border-radius:8px 8px 0 0">` +
    `<span style="font-size:0.95rem;letter-spacing:0.02em">${escapar(hermandad)}</span>` +
    `</div>` +
    `<div style="border:1px solid #e7e5e4;border-top:0;border-radius:0 0 8px 8px;padding:1.1rem">` +
    `<h2 style="margin:0 0 0.8rem;font-size:1.2rem;color:${color}">${escapar(titulo)}</h2>` +
    parrafos.map((p) => `<p style="margin:0 0 0.7rem">${escapar(p).replace(/\n/g, '<br>')}</p>`).join('') +
    (pie ? `<p style="margin:1rem 0 0;font-size:0.9rem;color:#57534e">${escapar(pie)}</p>` : '') +
    `<hr style="border:0;border-top:1px solid #e7e5e4;margin:1.2rem 0 0.6rem">` +
    `<p style="margin:0;font-size:0.85rem;color:#78716c">${escapar(hermandad)}</p>` +
    `</div>` +
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
