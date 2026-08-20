import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { leerPersistido, useEscuchaOtrasPestanas } from './persistencia'

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

export function useAjustesCorreo(): [AjustesCorreo, (a: AjustesCorreo) => void] {
  const [ajustes, setAjustes] = useState<AjustesCorreo>(() => getAjustesCorreo())
  useEscuchaOtrasPestanas(CLAVE_CORREO, () => setAjustes(getAjustesCorreo()))
  useEffect(() => {
    setAjustes(getAjustesCorreo())
  }, [])
  function guardar(a: AjustesCorreo) {
    setAjustes(a)
    saveAjustesCorreo(a)
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

  try {
    const { data, error } = await supabase.functions.invoke('enviar-correo', {
      body: { ...mensaje, para, responderA: ajustes.responderA || undefined },
    })
    if (error) {
      // El cuerpo del error trae el motivo de verdad (dominio sin verificar,
      // clave ausente…). Sin él, todo se leía como «error desconocido».
      const detalle = await leerDetalle(error)
      return { ok: false, error: detalle ?? error.message }
    }
    if (data?.error) return { ok: false, error: data.error }
    return { ok: true, enviados: data?.enviados ?? para.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo contactar con el servidor de correo.' }
  }
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
  const asunto = `Prueba de correo · ${nombreHermandad || 'Cabildo'}`
  const texto =
    `Si estás leyendo esto, el envío de correo funciona.\n\n` +
    `Este mensaje lo ha mandado Cabildo para comprobar la configuración de ` +
    `${nombreHermandad || 'la hermandad'}. No hay que hacer nada.`
  const html =
    `<div style="font-family:system-ui,sans-serif;line-height:1.6;max-width:34rem">` +
    `<p><b>Si estás leyendo esto, el envío de correo funciona.</b></p>` +
    `<p>Este mensaje lo ha mandado Cabildo para comprobar la configuración de ` +
    `${escapar(nombreHermandad || 'la hermandad')}. No hay que hacer nada.</p>` +
    `</div>`
  return { asunto, texto, html }
}

function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
