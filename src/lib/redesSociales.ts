import type { CuentaSocial, RedSocial } from '../data/comunicados'

/**
 * LAS REDES SOCIALES DE LA HERMANDAD.
 *
 * Dos cosas que conviene tener claras antes de tocar esto, porque son las que
 * explican por qué está montado así y no de la forma «obvia».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 1. LAS CINCO REDES SON UN CATÁLOGO, NO DATOS
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La pantalla decía **«0 de 0»** y no salía ni una tarjeta. Ni conectadas ni
 * sin conectar: ninguna. Con datos de ejemplo salían las cinco, así que se
 * leía como «esto solo funciona en la demostración».
 *
 * Pasaba porque la lista de redes se sacaba de la tabla `cuentas_sociales`, y
 * esa tabla estaba vacía para la hermandad (ver `supabase/redes-sociales.sql`
 * para el porqué exacto: las filas de la semilla se quedaron sin dueño). Pero
 * es que aunque estuviera bien, sacar la lista de ahí es un error de fondo:
 * **Facebook existe aunque la hermandad no lo haya conectado**. La tarjeta
 * «Facebook · no conectada» es información útil; que no aparezca Facebook es
 * un fallo.
 *
 * Así que las cinco salen SIEMPRE de aquí, y de la base de datos solo viene el
 * estado de cada una. Es lo mismo que se hace con los cargos o los estados de
 * una papeleta: el catálogo lo pone el programa, los datos la hermandad.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 2. QUÉ SE PUEDE PUBLICAR HOY Y QUÉ NO
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Publicar **solo** desde aquí, sin abrir la red, no se puede todavía, y no es
 * cuestión de programarlo un rato. Cada red pide lo suyo:
 *
 *   · Facebook e Instagram — una aplicación de Meta con la empresa verificada
 *     y revisión manual de Meta para los permisos de publicar. Instagram
 *     además exige cuenta profesional enlazada a una página de Facebook.
 *   · X — la API de publicar es de pago.
 *   · YouTube y TikTok — auditoría de la aplicación antes de dejarte subir.
 *
 * Y todas necesitan una clave secreta que NO puede vivir en el navegador: si
 * está en la web, cualquiera la lee y publica en nombre de la hermandad.
 *
 * Mientras tanto, lo que sí funciona hoy y es lo que hace casi todo el mundo:
 * el comunicado deja el texto preparado y un botón que abre la red con el
 * mensaje ya copiado. Se pega y se publica. Dos clics en vez de uno, pero es
 * de verdad — no una simulación que dice «publicado» sin publicar nada.
 */

/** Las cinco, en el orden en que se enseñan. */
export const REDES: RedSocial[] = ['Facebook', 'Instagram', 'X', 'YouTube', 'TikTok']

export const COLOR_RED: Record<RedSocial, string> = {
  Facebook: '#3b5998',
  Instagram: '#c1387c',
  X: '#14171a',
  YouTube: '#c4302b',
  TikTok: '#25b0a4',
}

export const INICIAL_RED: Record<RedSocial, string> = {
  Facebook: 'f',
  Instagram: 'IG',
  X: 'X',
  YouTube: '▶',
  TikTok: '♪',
}

/**
 * Cómo se publica en cada una hoy, con lo que hay.
 *
 * `componer` es la dirección que abre el cuadro de publicar con el texto ya
 * puesto, cuando la red lo permite. Las que no lo permiten se abren a secas y
 * el texto va en el portapapeles — que es exactamente lo que se hace a mano.
 */
export interface ComoPublicar {
  /** Se puede abrir el cuadro de publicar con el texto ya escrito. */
  admiteTextoEnElEnlace: boolean
  /** Qué hay que hacer, dicho para quien no es informático. */
  comoVa: string
}

export const COMO_PUBLICAR: Record<RedSocial, ComoPublicar> = {
  Facebook: {
    admiteTextoEnElEnlace: true,
    comoVa: 'Se abre la página de la hermandad en Facebook con el texto ya copiado: solo hay que pegarlo.',
  },
  X: {
    admiteTextoEnElEnlace: true,
    comoVa: 'Se abre X con el mensaje escrito. Solo hay que darle a publicar.',
  },
  Instagram: {
    admiteTextoEnElEnlace: false,
    // Instagram no deja publicar desde un enlace: es a propósito suyo, no una
    // limitación nuestra. Se copia el texto y se pega en la aplicación.
    comoVa: 'Instagram no deja abrir una publicación desde fuera. El texto se copia y se pega en la aplicación, que es como se hace ahora.',
  },
  YouTube: {
    admiteTextoEnElEnlace: false,
    comoVa: 'YouTube es para vídeo: el texto se copia para la descripción o para la pestaña de la comunidad.',
  },
  TikTok: {
    admiteTextoEnElEnlace: false,
    comoVa: 'TikTok se publica desde el móvil. El texto se copia para pegarlo allí.',
  },
}

/**
 * La dirección que abre la red con el mensaje preparado.
 *
 * `null` cuando la red no lo admite: entonces se copia el texto y se abre la
 * red a secas. Devolver una dirección inventada sería peor que no devolver
 * ninguna — se abriría una página de error y parecería roto.
 */
export function enlaceParaPublicar(red: RedSocial, texto: string, enlaceDeLaWeb?: string | null): string | null {
  const t = encodeURIComponent(texto.trim())
  if (red === 'X') {
    const url = enlaceDeLaWeb ? `&url=${encodeURIComponent(enlaceDeLaWeb)}` : ''
    return `https://twitter.com/intent/tweet?text=${t}${url}`
  }
  if (red === 'Facebook') {
    /*
     * El cuadro de compartir de Facebook necesita una dirección pública que
     * compartir: sin ella no hay forma de abrirlo con el texto puesto.
     *
     * Devolver `https://www.facebook.com/` a secas, que es lo que hacía, es
     * peor que devolver `null`: el botón llevaba a la PORTADA de Facebook en
     * vez de a la página de la hermandad. Con `null`, quien llama se va a la
     * página de la hermandad y el texto va copiado, que es lo útil.
     */
    return enlaceDeLaWeb
      ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(enlaceDeLaWeb)}&quote=${t}`
      : null
  }
  return null
}

/** Dónde está la cuenta de la hermandad, para el botón «abrir». */
export function enlaceDeLaCuenta(c: CuentaSocial): string | null {
  if (c.enlace?.trim()) return c.enlace.trim()
  const u = (c.usuario ?? '').trim().replace(/^@/, '')
  if (!u) return null
  const base: Record<RedSocial, string> = {
    Facebook: 'https://www.facebook.com/',
    Instagram: 'https://www.instagram.com/',
    X: 'https://x.com/',
    YouTube: 'https://www.youtube.com/@',
    TikTok: 'https://www.tiktok.com/@',
  }
  return `${base[c.red]}${u}`
}

/**
 * Las cinco redes con su estado, juntando el catálogo con lo que haya guardado.
 *
 * Da igual que la base devuelva vacío, una sola red o las cinco: siempre salen
 * las cinco. Es lo que arregla el «0 de 0».
 */
export function cuentasCompletas(guardadas: CuentaSocial[]): CuentaSocial[] {
  const porRed = new Map(guardadas.map((c) => [c.red, c]))
  return REDES.map(
    (red) => porRed.get(red) ?? { red, conectada: false, usuario: null, enlace: null },
  )
}

/**
 * ¿Vale como nombre de cuenta? Se acepta tanto «@hermandad» como la dirección
 * entera pegada del navegador, porque es lo que la gente tiene a mano.
 */
export function normalizarUsuario(entrada: string): string {
  const t = entrada.trim()
  if (!t) return ''
  // Si han pegado la dirección, sacar el nombre de dentro.
  const comoUrl = t.match(/^https?:\/\/[^/]+\/@?([^/?#]+)/i)
  const nombre = comoUrl ? comoUrl[1] : t
  return `@${nombre.replace(/^@/, '').trim()}`
}

/**
 * El texto con el que sale un comunicado a las redes.
 *
 * No es el correo: en redes no se pone «Estimado hermano» ni la firma. Se pone
 * el titular, el cuerpo y ya. Y se avisa si se pasa del límite de X, que es el
 * único que corta de verdad.
 */
export const LIMITE_X = 280

export function textoParaRedes(titulo: string, cuerpo: string): string {
  const t = titulo.trim()
  const c = cuerpo.trim()
  if (!c) return t
  if (!t) return c
  return `${t}\n\n${c}`
}

export function sePasaDeLargo(red: RedSocial, texto: string): boolean {
  return red === 'X' && texto.length > LIMITE_X
}
