import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Indica si hay credenciales de Supabase configuradas (variables de entorno
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 *
 * - SIN configurar (modo local / demostración): toda la app funciona con
 *   localStorage, sin necesidad de base de datos. Se pueden crear personal y
 *   hermanos, y esas cuentas pueden iniciar sesión, todo en el navegador.
 *   Es el modo pensado para trabajar mientras no se conecta Supabase.
 * - CONFIGURADO (modo real): los datos viven en Supabase y el login usa
 *   Supabase Auth.
 *
 * Para forzar el modo local en producción (p. ej. mientras el proyecto de
 * Supabase esté en pausa), basta con NO definir esas variables de entorno en
 * Vercel.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Si está a `1`, la aplicación NO se cae al modo local cuando Supabase está
 * configurado pero no responde: enseña un error y punto.
 *
 * Por qué hace falta un interruptor. El modo local de reserva es muy útil
 * mientras se monta todo: si el proyecto de Supabase está en pausa, la
 * aplicación sigue funcionando con los datos del navegador y se puede
 * enseñar. En producción, con hermandades de verdad, eso mismo es un problema:
 * la secretaría entraría, vería un censo que no es el suyo y pasaría la tarde
 * dando altas que no existen en ningún sitio. Es mejor decir «esto está caído,
 * vuelve en un rato» que dejar trabajar en falso.
 *
 * Se pone `VITE_SIN_MODO_LOCAL=1` en las variables del despliegue el día que
 * se abra al público. Mientras tanto, sin definirla, todo sigue como está.
 */
export const sinModoLocal = import.meta.env.VITE_SIN_MODO_LOCAL === '1'

/**
 * Cliente principal de Supabase. Es `null` en modo local (sin credenciales).
 * El resto de la app comprueba `isSupabaseConfigured` antes de usarlo.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/**
 * Cliente SOLO para dar de alta cuentas de otras personas (personal,
 * hermanos) desde una sesión de administrador. No persiste sesión, así que
 * crear cuentas con signUp() no expulsa al administrador de la suya.
 */
export const supabaseAlta: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'cabildo-alta',
      },
    })
  : null

/**
 * Comprueba si el proyecto de Supabase responde. En el plan gratuito el
 * proyecto se PAUSA tras unos días de inactividad; mientras está pausado,
 * cualquier petición se cae y el login dejaría de funcionar. Con esta sonda,
 * la app detecta esa situación al arrancar y sigue funcionando en modo local
 * (mismos accesos de demostración, datos en el navegador) hasta que Supabase
 * vuelva a estar disponible.
 *
 * Devuelve `true` si Supabase está accesible; `false` si está pausado, caído
 * o inalcanzable. Si no hay Supabase configurado, devuelve `false` (ya se
 * está en modo local por diseño).
 */
export async function supabaseDisponible(timeoutMs = 4000): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  try {
    const control = new AbortController()
    const t = setTimeout(() => control.abort(), timeoutMs)
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      signal: control.signal,
    })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}
