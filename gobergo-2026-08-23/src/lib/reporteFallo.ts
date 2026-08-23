/**
 * CONTAR UN FALLO SIN QUE SE PIERDA POR EL CAMINO.
 *
 * El correo va a quien mantiene Gobergo, no a la hermandad: es un canal de
 * soporte, no un comunicado.
 *
 * LO QUE HACE ÚTIL UN REPORTE. No es lo que escribe quien lo manda —eso suele
 * ser «no funciona»—, es lo que se adjunta solo:
 *
 *   · En qué pantalla estaba.
 *   · Qué hermandad y con qué cargo, porque casi todo lo que falla depende de
 *     los permisos.
 *   · Y EL ÚLTIMO ERROR DE LA BASE DE DATOS, que es el que de verdad dice qué
 *     ha pasado. Ese dato ha costado tres conversaciones más de una vez.
 *
 * POR QUÉ NO USA `enviarCorreo`. Esa función exige que la hermandad tenga el
 * correo configurado y encendido. Un reporte de fallos no puede depender de
 * eso: precisamente el fallo puede SER el correo, o la hermandad puede no
 * haberlo configurado todavía. Así que llama a la función del servidor
 * directamente, y si tampoco puede, devuelve un enlace `mailto:` con todo
 * escrito para que quien lo manda solo tenga que darle a enviar.
 *
 * Un canal de fallos que falla no sirve de nada.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { explicarFalloDeEnvio } from './correo'

/** A dónde van los fallos de Gobergo. */
export const CORREO_SOPORTE = 'jaimerivasgranada@gmail.com'

export interface ContextoDelFallo {
  /** La dirección donde estaba, tal cual. */
  ruta: string
  /** Cómo se llama la hermandad, para saber a quién le pasa. */
  hermandad?: string
  /** Su cargo: casi todo lo que falla depende de los permisos. */
  cargo?: string | null
  /** El último error de la base de datos, si lo hubo. Es lo más valioso. */
  ultimoErrorBd?: string | null
  /** Navegador y pantalla: un fallo de móvil no se reproduce en un portátil. */
  navegador?: string
  tamanoPantalla?: string
}

export interface Reporte {
  /** Qué estaba haciendo. */
  queHacia: string
  /** Qué esperaba que pasara y qué pasó. */
  queFallo: string
  /** Para poder responderle. Opcional: mejor un reporte sin correo que ninguno. */
  correoDeQuienLoManda?: string
}

/**
 * El texto del reporte. Se saca aparte para poder probarlo y, sobre todo, para
 * poder reutilizarlo tal cual en el enlace `mailto:` de reserva.
 */
export function textoDelReporte(r: Reporte, ctx: ContextoDelFallo): string {
  const lineas: string[] = []
  lineas.push('QUÉ ESTABA HACIENDO')
  lineas.push(r.queHacia.trim() || '(no lo ha dicho)')
  lineas.push('')
  lineas.push('QUÉ HA PASADO')
  lineas.push(r.queFallo.trim() || '(no lo ha dicho)')
  lineas.push('')
  lineas.push('---')
  lineas.push(`Pantalla: ${ctx.ruta}`)
  if (ctx.hermandad) lineas.push(`Hermandad: ${ctx.hermandad}`)
  // «(titular)» y no vacío: que no tenga cargo ES un dato, no un hueco.
  lineas.push(`Cargo: ${ctx.cargo ?? '(titular, sin cargo)'}`)
  if (r.correoDeQuienLoManda?.trim()) lineas.push(`Responder a: ${r.correoDeQuienLoManda.trim()}`)
  if (ctx.navegador) lineas.push(`Navegador: ${ctx.navegador}`)
  if (ctx.tamanoPantalla) lineas.push(`Tamaño de pantalla: ${ctx.tamanoPantalla}`)
  if (ctx.ultimoErrorBd) {
    lineas.push('')
    lineas.push('ÚLTIMO ERROR DE LA BASE DE DATOS')
    lineas.push(ctx.ultimoErrorBd)
  }
  return lineas.join('\n')
}

/** El asunto: se ve en la bandeja sin abrir, así que lleva la pantalla. */
export function asuntoDelReporte(ctx: ContextoDelFallo): string {
  const donde = ctx.ruta.replace(/^\/app\/?/, '') || 'inicio'
  return `[Gobergo] Fallo en ${donde}${ctx.hermandad ? ` · ${ctx.hermandad}` : ''}`
}

/**
 * El enlace de reserva, con todo escrito. Es lo que hace que un reporte no se
 * pierda aunque no haya forma de mandarlo desde la aplicación.
 */
export function enlaceDeReserva(r: Reporte, ctx: ContextoDelFallo): string {
  const asunto = encodeURIComponent(asuntoDelReporte(ctx))
  const cuerpo = encodeURIComponent(textoDelReporte(r, ctx))
  return `mailto:${CORREO_SOPORTE}?subject=${asunto}&body=${cuerpo}`
}

export interface ResultadoReporte {
  ok: boolean
  /** Si no se pudo mandar: el enlace para hacerlo desde su propio correo. */
  reserva?: string
  error?: string
}

export async function mandarReporte(r: Reporte, ctx: ContextoDelFallo): Promise<ResultadoReporte> {
  return mandarASoporte(asuntoDelReporte(ctx), textoDelReporte(r, ctx), r.correoDeQuienLoManda)
}

/**
 * Manda cualquier cosa al soporte de Gobergo, con la misma red de seguridad:
 * si no se puede desde la aplicación, devuelve un `mailto:` con todo escrito.
 *
 * Se saca aparte porque hay más de un motivo para escribir a soporte —un
 * fallo, o pedir que se active un dominio— y los dos necesitan exactamente lo
 * mismo: llegar, y no perderse si no llegan.
 */
export async function mandarASoporte(
  asunto: string,
  texto: string,
  responderA?: string,
): Promise<ResultadoReporte> {
  const reserva = `mailto:${CORREO_SOPORTE}?subject=${encodeURIComponent(asunto)}`
    + `&body=${encodeURIComponent(texto)}`
  const r = { correoDeQuienLoManda: responderA }

  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, reserva, error: 'Sin conexión con el servidor.' }
  }
  try {
    const { data, error } = await supabase.functions.invoke('enviar-correo', {
      body: {
        para: [CORREO_SOPORTE],
        asunto,
        texto,
        // Para poder responderle directamente desde la bandeja.
        responderA: r.correoDeQuienLoManda?.trim() || undefined,
      },
    })
    /*
     * Traducido, no en crudo. Aquí salía «Edge Function returned a non-2xx
     * status code», que suena a avería del servidor y significa lo contrario:
     * la función está y responde, pero le falta un secreto o el dominio del
     * remitente sin verificar. Y esto lo lee alguien que ya está intentando
     * contar un fallo — darle otro mensaje indescifrable es cerrarle la
     * última puerta.
     */
    if (error) return { ok: false, reserva, error: explicarFalloDeEnvio(error) }
    if (data?.error) return { ok: false, reserva, error: String(data.error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, reserva, error: e instanceof Error ? e.message : 'No se pudo mandar.' }
  }
}

/* -------------------------------------------------------------------------
   Pedir que se active un dominio propio
   ------------------------------------------------------------------------- */

/**
 * EL PASO QUE NO PUEDE DAR LA HERMANDAD.
 *
 * Poner un dominio propio son tres pasos y solo dos son suyos: comprarlo, y
 * apuntar los DNS donde se le diga. El de en medio —darlo de alta en el
 * servidor— solo lo puede hacer quien lleva Gobergo, y hasta ahora la pantalla
 * decía «avísanos» sin dar forma de avisar. Así que o no se avisaba, o se
 * avisaba por otro sitio y se perdía.
 */
export function textoDelAvisoDeDominio(datos: {
  dominio: string
  hermandad: string
  slug: string
  quienLoPide?: string
}): string {
  return [
    'ACTIVAR UN DOMINIO PROPIO',
    '',
    `Dominio: ${datos.dominio}`,
    `Hermandad: ${datos.hermandad}`,
    `Su web ahora: /w/${datos.slug}`,
    datos.quienLoPide?.trim() ? `Lo pide: ${datos.quienLoPide.trim()}` : '',
    '',
    'PARA HACER',
    `1. Añadir ${datos.dominio} y www.${datos.dominio} en el servidor.`,
    '2. Mandarles los DNS que tienen que poner en su registrador.',
    '3. Que uno de los dos redirija al otro, o quien escriba el www no llega.',
  ].filter(Boolean).join('\n')
}

export async function pedirActivarDominio(datos: {
  dominio: string
  hermandad: string
  slug: string
  quienLoPide?: string
}): Promise<ResultadoReporte> {
  return mandarASoporte(
    `[Gobergo] Activar dominio ${datos.dominio} · ${datos.hermandad}`,
    textoDelAvisoDeDominio(datos),
    datos.quienLoPide,
  )
}
