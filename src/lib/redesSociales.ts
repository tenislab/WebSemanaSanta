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
    // `x.com/intent/post` es la dirección de ahora. La vieja
    // (`twitter.com/intent/tweet`) todavía redirige, pero una redirección más
    // en el móvil es medio segundo de pantalla en blanco por nada.
    return `https://x.com/intent/post?text=${t}${url}`
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

/**
 * LA ACCIÓN QUE TOCA EN CADA RED, que es UNA sola.
 *
 * Llegó dicho así: «hay que ponerlo fácil; si es copiar el texto, que le salte
 * ya en Twitter». Y tenía razón en lo de fácil: había dos botones —«Copiar
 * texto» y «Abrir X»— y quien llega no sabe cuál de los dos es el que publica.
 * Son dos porque por dentro son dos cosas, pero por fuera es UNA: publicar
 * esto en esta red.
 *
 * Así que cada red devuelve su acción, y el botón se llama por lo que va a
 * pasar de verdad. «Publicar en X» abre X con el mensaje escrito; «Copiar y
 * abrir Instagram» hace eso, ni más ni menos. Un botón que promete más de lo
 * que hace se paga la primera vez.
 */
export type ModoDePublicar =
  /** Se abre la red con el texto ya escrito: solo hay que darle a publicar. */
  | 'componer'
  /** No deja escribir desde fuera: se copia el texto y se abre la red. */
  | 'copiarYAbrir'
  /** Ni una cosa ni la otra —falta conectar la cuenta—: solo se copia. */
  | 'soloCopiar'

export interface AccionDePublicar {
  modo: ModoDePublicar
  /** A dónde lleva el botón. `null` en `soloCopiar`. */
  url: string | null
  /** Lo que pone el botón. Dice lo que va a pasar, no «Ir». */
  boton: string
  /**
   * Y la explicación de al lado, que sale de AQUÍ y no de una frase fija por
   * red. Con la frase fija, Facebook decía «se abre la página con el texto
   * copiado: solo hay que pegarlo» mientras el botón ponía «Publicar en
   * Facebook» y abría el cuadro de publicar. Lo que hace el botón y lo que
   * dice el texto tienen que decidirse en el mismo sitio o se separan al
   * primer cambio.
   */
  explica: string
}

export function accionDePublicar(
  red: RedSocial,
  texto: string,
  cuenta: CuentaSocial | undefined,
  enlaceDeLaWeb?: string | null,
): AccionDePublicar {
  const componer = enlaceParaPublicar(red, texto, enlaceDeLaWeb)
  if (componer) {
    return {
      modo: 'componer',
      url: componer,
      boton: `Publicar en ${red}`,
      explica: red === 'X'
        ? 'Se abre X con el mensaje escrito y el enlace de la web. Solo hay que darle a publicar.'
        : 'Se abre el cuadro de publicar de Facebook con el texto y el enlace de la web puestos.',
    }
  }

  const suyo = cuenta ? enlaceDeLaCuenta(cuenta) : null
  if (suyo) {
    return {
      modo: 'copiarYAbrir',
      url: suyo,
      boton: `Copiar y abrir ${red}`,
      /*
       * Facebook aquí es un caso aparte: no es que no pueda, es que le falta
       * la web publicada. Decirlo evita que se lea como «Facebook va peor».
       */
      explica: red === 'Facebook'
        ? 'Facebook necesita una dirección que compartir y la web no está publicada todavía. '
          + 'Se abre la página de la hermandad con el texto copiado.'
        : COMO_PUBLICAR[red].comoVa,
    }
  }

  /*
   * Sin cuenta conectada no hay a dónde ir. Antes el botón se pintaba igual y
   * al pulsarlo salía un aviso de «conecta la red primero», que es enterarse
   * tarde: mejor que el botón diga desde el principio lo único que puede hacer.
   */
  return {
    modo: 'soloCopiar',
    url: null,
    boton: 'Copiar el texto',
    explica: `Conecta ${red} arriba y desde aquí se abrirá su cuenta directamente.`,
  }
}

/**
 * ¿Se puede usar el «compartir» del propio teléfono?
 *
 * Es lo que de verdad arregla Instagram y TikTok. Ninguna de las dos deja
 * abrir una publicación desde un enlace, así que por ordenador no hay más
 * remedio que copiar y pegar. Pero en el móvil —que es desde donde se publica
 * en Instagram— el sistema tiene su propio menú de compartir: se pulsa, se
 * elige Instagram y el texto entra solo. Un toque, sin pegar nada.
 *
 * Se comprueba en el momento, no al cargar: el mismo usuario abre la
 * aplicación en el ordenador y en el móvil.
 */
export function sePuedeCompartirConElMovil(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}
