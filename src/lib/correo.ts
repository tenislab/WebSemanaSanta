import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { leerPersistido, useEscuchaOtrasPestanas } from './persistencia'
import { hermandadActualId } from './multiHermandad'

/**
 * Mandar correo de verdad (P7).
 *
 * El navegador **no** manda nada: le pide a una función del servidor
 * (`supabase/functions/enviar-correo`) que lo haga. La clave del proveedor vive
 * allí, porque permite escribir EN NOMBRE DE LA HERMANDAD: si estuviera aquí,
 * cualquiera la sacaría del código y podría suplantarla ante sus mil hermanos.
 *
 * Mientras no esté configurada, todo sigue funcionando: los avisos van al buzón
 * que cada hermano tiene en su área, y la aplicación lo dice en rojo en vez de
 * fingir que ha mandado algo.
 */

export interface AjustesCorreo {
  /** La hermandad ha activado el envío. Se apaga sin desconfigurar nada. */
  activo: boolean
  /** A dónde contestan los hermanos si le dan a «responder». */
  responderA: string
  /** Qué tipos de aviso salen por correo, además de al buzón. */
  avisaDe: { comunicados: boolean; cuotas: boolean; papeletas: boolean; ficha: boolean }
}

export const CLAVE_CORREO = 'cabildo-correo'

export const CORREO_INICIAL: AjustesCorreo = {
  activo: false,
  responderA: '',
  // Los comunicados sí por defecto (es para lo que se contrata); los cambios de
  // ficha no, que son muchos y menores.
  avisaDe: { comunicados: true, cuotas: true, papeletas: true, ficha: false },
}

export function getAjustesCorreo(): AjustesCorreo {
  const g = leerPersistido<Partial<AjustesCorreo>>(CLAVE_CORREO, {})
  return { ...CORREO_INICIAL, ...g, avisaDe: { ...CORREO_INICIAL.avisaDe, ...(g.avisaDe ?? {}) } }
}

export function saveAjustesCorreo(a: AjustesCorreo) {
  localStorage.setItem(CLAVE_CORREO, JSON.stringify(a))
}

/**
 * Trae la configuración de correo de la HERMANDAD y la deja en la copia local.
 *
 * EL FALLO QUE ARREGLA. Esto vivía solo en el navegador de quien lo activó. El
 * secretario lo encendía en su portátil; al día siguiente la tesorera, desde
 * el ordenador de la casa de hermandad, marcaba cuotas como pagadas y no salía
 * ni un aviso: en ESE navegador la configuración no existe, así que se leía la
 * de fábrica —apagado— y la lista de destinatarios salía vacía. Sin error y
 * sin mensaje. Y en su pantalla tampoco aparecía activado, con lo que no había
 * forma de sospechar que lo estaba en otro sitio.
 */
export async function cargarAjustesCorreoDeLaBase(): Promise<AjustesCorreo | null> {
  if (!isSupabaseConfigured || !supabase) return null
  try {
    const { data, error } = await supabase.from('hermandad_settings').select('correo').maybeSingle()
    const guardado = (data as { correo: Partial<AjustesCorreo> | null } | null)?.correo
    if (error || !guardado) return null
    const completo: AjustesCorreo = {
      ...CORREO_INICIAL,
      ...guardado,
      avisaDe: { ...CORREO_INICIAL.avisaDe, ...(guardado.avisaDe ?? {}) },
    }
    localStorage.setItem(CLAVE_CORREO, JSON.stringify(completo))
    return completo
  } catch {
    return null
  }
}

/** Guarda la configuración donde la vea toda la junta, no solo este navegador. */
export async function guardarAjustesCorreoEnLaBase(a: AjustesCorreo): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return true
  const hermandadId = await hermandadActualId()
  if (!hermandadId) return false
  const { error } = await supabase
    .from('hermandad_settings')
    .upsert({ hermandad_id: hermandadId, correo: a }, { onConflict: 'hermandad_id' })
  return !error
}

export function useAjustesCorreo(): [AjustesCorreo, (a: AjustesCorreo) => void] {
  const [ajustes, setAjustes] = useState<AjustesCorreo>(() => getAjustesCorreo())
  useEscuchaOtrasPestanas(CLAVE_CORREO, () => setAjustes(getAjustesCorreo()))
  useEffect(() => {
    setAjustes(getAjustesCorreo())
    // Y lo que diga la hermandad, que manda sobre lo que hubiera aquí.
    void cargarAjustesCorreoDeLaBase().then((r) => {
      if (r) setAjustes(r)
    })
  }, [])
  function guardar(a: AjustesCorreo) {
    setAjustes(a)
    saveAjustesCorreo(a)
    void guardarAjustesCorreoEnLaBase(a)
  }
  return [ajustes, guardar]
}

/** ¿Se puede mandar correo ahora mismo? */
export function correoDisponible(a: AjustesCorreo = getAjustesCorreo()): boolean {
  return isSupabaseConfigured && a.activo
}

export interface ResultadoEnvio {
  ok: boolean
  enviados?: number
  /** Qué ha fallado, en cristiano y sin adornos. */
  error?: string
}

/**
 * Manda un correo. Devuelve qué ha pasado; **nunca lanza**, porque quien lo
 * llama casi siempre está haciendo otra cosa más importante (emitir cuotas,
 * mandar un comunicado) y un fallo de correo no puede tumbar eso.
 */
/**
 * Cuántas direcciones acepta el servidor de una vez.
 *
 * Tiene que ser el mismo número que `MAXIMO_DESTINATARIOS` en
 * `supabase/functions/enviar-correo/index.ts`. Es a propósito y no un capricho:
 * un envío gigante que falla a medias es imposible de rehacer sin escribir dos
 * veces a media hermandad.
 */
export const POR_TANDA = 50

export async function enviarCorreo(mensaje: {
  para: string[]
  asunto: string
  texto?: string
  html?: string
}): Promise<ResultadoEnvio> {
  const ajustes = getAjustesCorreo()
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Sin base de datos conectada no se puede mandar correo.' }
  }
  if (!ajustes.activo) {
    return { ok: false, error: 'El envío de correo está apagado en Configuración → Correo.' }
  }
  const para = mensaje.para.map((d) => d.trim()).filter((d) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d))
  if (para.length === 0) return { ok: false, error: 'Ninguno de los destinatarios tiene un correo válido.' }

  /**
   * MÁS DE 50: se trocea aquí.
   *
   * El servidor corta en 50 y devuelve un 400. Como una hermandad de 612
   * hermanos manda a los 612 de una vez, el comunicado NO LE LLEGABA A NADIE
   * —ni al primero— y encima el comunicado ya se había guardado como
   * «Enviado», así que el botón de mandarlo desaparecía. Un envío fallido que
   * la pantalla daba por hecho.
   *
   * Las tandas van una detrás de otra a propósito, no todas a la vez: mandar
   * doce peticiones en paralelo es la forma más rápida de que el proveedor te
   * tome por spam el primer día.
   */
  if (para.length > POR_TANDA) {
    let enviados = 0
    const fallos: string[] = []
    for (let i = 0; i < para.length; i += POR_TANDA) {
      const tanda = para.slice(i, i + POR_TANDA)
      const r = await enviarCorreo({ ...mensaje, para: tanda })
      if (r.ok) enviados += r.enviados ?? tanda.length
      else fallos.push(r.error ?? 'error desconocido')
    }
    if (enviados === 0) {
      return { ok: false, error: fallos[0] ?? 'No se pudo mandar ninguna tanda.' }
    }
    // Si algunas salieron y otras no, se dice: «se ha enviado» a secas sería
    // mentira y nadie sabría a quién hay que volver a escribirle.
    if (fallos.length > 0) {
      return {
        ok: true,
        enviados,
        error: `Salieron ${enviados} de ${para.length}. El resto falló: ${fallos[0]}`,
      }
    }
    return { ok: true, enviados }
  }

  try {
    const { data, error } = await supabase.functions.invoke('enviar-correo', {
      body: { ...mensaje, para, responderA: ajustes.responderA || undefined },
    })
    if (error) {
      // El cuerpo del error trae el motivo de verdad (dominio sin verificar,
      // clave ausente…). Sin él, todo se leía como «error desconocido».
      const detalle = await leerDetalle(error)
      return { ok: false, error: detalle ?? explicarFalloDeEnvio(error) }
    }
    if (data?.error) return { ok: false, error: data.error }
    return { ok: true, enviados: data?.enviados ?? para.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo contactar con el servidor de correo.' }
  }
}

/**
 * Traduce el fallo de `functions.invoke` a algo que se pueda arreglar.
 *
 * EL CASO REAL: la función `enviar-correo` no está desplegada todavía.
 * Supabase devuelve entonces un «Failed to send a request to the Edge
 * Function» o un 404 pelado, que no le dice nada a nadie. La hermandad manda
 * un comunicado, ve un error incomprensible, y da por hecho que la aplicación
 * está rota — cuando lo que falta es un paso de instalación de diez minutos.
 */
function explicarFalloDeEnvio(error: unknown): string {
  const crudo = (error as { message?: string })?.message ?? ''
  const estado = (error as { context?: { status?: number } })?.context?.status
  const noExiste =
    estado === 404 ||
    /not found|failed to send a request|failed to fetch|function not found/i.test(crudo)
  if (noExiste) {
    return (
      'La función de envío no está instalada en Supabase todavía. ' +
      'Hay que desplegar «enviar-correo» y poner sus dos secretos (RESEND_API_KEY y ' +
      'CORREO_REMITENTE). Está explicado en docs/CUANDO-TENGA-DOMINIO.md, apartado 6.'
    )
  }
  if (estado === 401 || estado === 403) {
    return 'La función de envío ha rechazado la petición. Suele ser que falta la clave RESEND_API_KEY en los secretos de Supabase.'
  }
  return crudo || 'No se pudo contactar con el servidor de correo.'
}

/** El mensaje de error que devuelve la función, que es el que de verdad explica qué pasa. */
async function leerDetalle(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response })?.context
  if (!ctx || typeof ctx.json !== 'function') return null
  try {
    const cuerpo = await ctx.json()
    return typeof cuerpo?.error === 'string' ? cuerpo.error : null
  } catch {
    return null
  }
}

/**
 * El correo de prueba. Es lo primero que hay que poder hacer al conectar el
 * proveedor: sin esto, se descubre que algo falla el día que se manda la
 * convocatoria de cabildo a mil personas.
 */
export function correoDePrueba(nombreHermandad: string): { asunto: string; texto: string; html: string } {
  const asunto = `Prueba de correo · ${nombreHermandad || 'Gobergo'}`
  const texto =
    `Si estás leyendo esto, el envío de correo funciona.\n\n` +
    `Este mensaje lo ha mandado Gobergo para comprobar la configuración de ` +
    `${nombreHermandad || 'la hermandad'}. No hay que hacer nada.`
  const html =
    `<div style="font-family:system-ui,sans-serif;line-height:1.6;max-width:34rem">` +
    `<p><b>Si estás leyendo esto, el envío de correo funciona.</b></p>` +
    `<p>Este mensaje lo ha mandado Gobergo para comprobar la configuración de ` +
    `${escapar(nombreHermandad || 'la hermandad')}. No hay que hacer nada.</p>` +
    `</div>`
  return { asunto, texto, html }
}

function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
