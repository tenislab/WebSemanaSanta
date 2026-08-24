import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { vigilarRecuperacionDeClave } from './recuperacionClave'

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
 * ¿Se cae la aplicación al modo local cuando Supabase está configurado pero no
 * responde? **No, salvo que se pida a mano.**
 *
 * QUÉ ES EL MODO LOCAL DE RESERVA. Si el proyecto de Supabase está en pausa o
 * caído, la aplicación seguía funcionando con los datos del navegador. Mientras
 * se monta todo es cómodo: se puede enseñar sin depender de nada.
 *
 * POR QUÉ AHORA VA AL REVÉS. Con una hermandad de verdad detrás, eso mismo es
 * un desastre callado: la secretaria entra, ve un censo QUE NO ES EL SUYO —los
 * doce hermanos de ejemplo, con nombres inventados— y pasa la tarde dando
 * altas y cobrando recibos que no existen en ningún sitio. Nada avisa, porque
 * desde dentro se ve una aplicación que funciona. Es mucho mejor decir «esto
 * está caído, vuelve en un rato».
 *
 * Y ESTABA AL REVÉS, esperando que alguien se acordara de poner
 * `VITE_SIN_MODO_LOCAL=1` en el despliegue el día de abrir al público. Un
 * seguro que hay que acordarse de activar no es un seguro: el día que de
 * verdad hace falta es justo el día en que hay quince cosas que hacer.
 *
 * Así que ahora la protección viene puesta y lo que se pide a mano es
 * QUITARLA: `VITE_MODO_LOCAL=1`, solo para desarrollo. Se sigue leyendo la
 * variable de antes por si algún despliegue ya la tenía puesta — decía lo
 * mismo que ahora es el comportamiento normal, así que no cambia nada.
 *
 * OJO: esto solo entra en juego con Supabase CONFIGURADO. Sin credenciales,
 * `isSupabaseConfigured` es falso y la demostración funciona igual que
 * siempre; esto no la toca.
 */
export const sinModoLocal = import.meta.env.VITE_MODO_LOCAL !== '1'

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
 * A la escucha de «he olvidado mi contraseña» DESDE EL PRIMER INSTANTE.
 *
 * Supabase emite `PASSWORD_RECOVERY` mientras procesa el enlace del correo, y
 * eso ocurre al crear el cliente: antes de que React haya pintado nada. Si
 * este oyente se registrara dentro de una pantalla llegaría tarde y el aviso
 * se perdería, que es exactamente lo que pasaba.
 */
if (supabase) vigilarRecuperacionDeClave(supabase)

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
