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

/**
 * EL DIBUJO DE CADA MARCA, en un lienzo de 24×24.
 *
 * Aquí había iniciales: una «f», un «IG», una nota musical para TikTok y un
 * triangulito para YouTube. Se entendían, pero en una pantalla que la junta
 * enseña a otras hermandades parecían un apaño —y la mitad del trabajo de que
 * Gobergo se vea serio es justo que no lo parezca—. Un logotipo se reconoce sin
 * leer nada; una inicial hay que descifrarla.
 *
 * Se guardan como datos y no como JSX para que se puedan comprobar: una prueba
 * verifica que las cinco redes tienen su marca, y el día que se añada una
 * sexta, esa prueba lo dice antes de que salga un hueco en la pantalla.
 *
 * `hueco` es el contorno (la cámara de Instagram se dibuja con líneas, no
 * rellena); el resto va macizo del color de la red.
 */
export type TrazoDeMarca =
  | { forma: 'path'; d: string; hueco?: true }
  | { forma: 'rect'; x: number; y: number; w: number; h: number; r: number; hueco?: true }
  | { forma: 'circulo'; cx: number; cy: number; r: number; hueco?: true }

export const MARCA_RED: Record<RedSocial, TrazoDeMarca[]> = {
  Facebook: [{
    forma: 'path',
    d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854'
      + 'v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235'
      + 'v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385'
      + 'C19.612 23.027 24 18.062 24 12.073z',
  }],
  // La cámara: marco redondeado, objetivo y el punto del flash.
  Instagram: [
    { forma: 'rect', x: 2.5, y: 2.5, w: 19, h: 19, r: 5.5, hueco: true },
    { forma: 'circulo', cx: 12, cy: 12, r: 4.6, hueco: true },
    { forma: 'circulo', cx: 17.7, cy: 6.3, r: 1.4 },
  ],
  X: [{
    forma: 'path',
    d: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154'
      + 'h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  }],
  YouTube: [{
    forma: 'path',
    d: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505'
      + 'A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136'
      + 'c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12'
      + 's0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  }],
  TikTok: [{
    forma: 'path',
    d: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79'
      + 'v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75'
      + '-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03'
      + '-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96'
      + '1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37'
      + '-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87'
      + '1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  }],
}

/**
 * Un enlace del pie de la web que NO es una red social —la web de la parroquia,
 * la del consejo— también necesita su icono, o queda un hueco en una fila de
 * logotipos. Un globo terráqueo, que es lo que significa «una página» en
 * cualquier sitio.
 */
export const MARCA_WEB: TrazoDeMarca[] = [
  { forma: 'circulo', cx: 12, cy: 12, r: 9, hueco: true },
  { forma: 'path', d: 'M3 12h18', hueco: true },
  { forma: 'path', d: 'M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z', hueco: true },
]

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
