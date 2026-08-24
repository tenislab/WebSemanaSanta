/**
 * «HE OLVIDADO MI CONTRASEÑA», DEL HERMANO.
 *
 * POR QUÉ NO LO HACE SUPABASE. Lo hacía: `resetPasswordForEmail` mandaba el
 * correo a la dirección de la cuenta. Pero desde que la cuenta de un hermano se
 * llama por dentro «DNI + hermandad» —para que quien es hermano de dos
 * hermandades pueda entrar en las dos, ver `accesos.ts`— esa dirección NO
 * RECIBE NADA. Su correo está en su ficha, que es otra cosa.
 *
 * Así que el enlace lo manda la función `enviar-correo`, que lee ahí el correo
 * de verdad. Ni el token ni la dirección pasan por este navegador.
 *
 * Y de paso el aviso deja de salir por el servidor de Supabase para salir por
 * el de la hermandad, firmado con su nombre.
 */
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Paso 1: pedirlo. **Devuelve siempre lo mismo**, exista ese DNI o no.
 *
 * Si dijera «ese DNI no está», cualquiera podría ir probando documentos para
 * averiguar quién es hermano de qué hermandad — y eso revela convicciones
 * religiosas, que es categoría especial del RGPD. Una pantalla de contraseña
 * olvidada no puede ser una forma de comprobar la fe de nadie.
 */
export async function pedirRecuperacion(hermandadId: string, dni: string): Promise<void> {
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente) return
  try {
    await cliente.functions.invoke('enviar-correo', {
      body: {
        recuperar: {
          hermandadId,
          dni,
          origen: typeof window === 'undefined' ? undefined : window.location.origin,
        },
      },
    })
  } catch {
    // Un fallo de red tampoco puede delatar nada: quien llama no distingue.
  }
}

export type ResultadoClaveNueva = { ok: true } | { ok: false; error: string }

/**
 * Paso 2: llega con el token del enlace y la contraseña nueva.
 *
 * Aquí SÍ se dice qué ha pasado: quien llega con un enlace ya no tiene nada que
 * averiguar sobre nadie, y lo que necesita saber es si tiene que pedir otro.
 */
export async function ponerClaveConToken(token: string, clave: string): Promise<ResultadoClaveNueva> {
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente) {
    return { ok: false, error: 'No hay conexión con la base de datos.' }
  }
  try {
    const { data, error } = await cliente.functions.invoke('enviar-correo', {
      body: { recuperar: { token, clave } },
    })
    if (error) {
      /*
       * El motivo de verdad viene en el cuerpo, no en el mensaje. Sin leerlo,
       * un enlace caducado se contaba como «error desconocido» y quien lo tenía
       * delante no sabía que lo que hay que hacer es pedir otro.
       */
      const detalle = await leerMotivo(error)
      return { ok: false, error: detalle ?? 'No se ha podido cambiar la contraseña. Inténtalo otra vez.' }
    }
    if (data?.error) return { ok: false, error: String(data.error) }
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se ha podido cambiar la contraseña. Revisa la conexión.' }
  }
}

/** El cuerpo del error que devuelve la función, que es donde está el motivo. */
async function leerMotivo(error: unknown): Promise<string | null> {
  try {
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
    const cuerpo = await ctx?.json?.()
    return cuerpo?.error ?? null
  } catch {
    return null
  }
}
