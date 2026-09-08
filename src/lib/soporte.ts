/**
 * EL LADO DEL NAVEGADOR DEL ACCESO DE SOPORTE.
 *
 * Todo lo que importa está en `supabase/soporte.sql`: quién puede, cuánto dura,
 * qué queda escrito y por qué `hermandad_actual()` se toca ahí y no aquí. Esto
 * son doce líneas para pintar la banda de aviso y para poder salir sin ir al
 * SQL Editor.
 *
 * ----------------------------------------------------------------------------
 * LA BANDA NO ES UN ADORNO
 * ----------------------------------------------------------------------------
 *
 * Mientras se está suplantando a una hermandad, la aplicación es INDISTINGUIBLE
 * de la de esa hermandad: mismo censo, mismas cuentas, mismos botones de
 * borrar. Sin un aviso permanente en pantalla, lo que pasa —y pasa— es que se
 * abre una pestaña para ayudar a alguien, se deja abierta, y al día siguiente
 * se toca algo creyendo que es la hermandad propia.
 *
 * Por eso la banda no se puede cerrar. No hay botón de «entendido». La única
 * forma de que desaparezca es salir de verdad.
 *
 * ----------------------------------------------------------------------------
 * PARA UNA CUENTA NORMAL ESTO NO HACE ABSOLUTAMENTE NADA
 * ----------------------------------------------------------------------------
 *
 * `soporte_donde_estoy()` devuelve `null` para todo el que no sea una cuenta de
 * soporte con una sesión abierta, o sea, para todo el mundo. Es una llamada al
 * arrancar que contesta `null` y ya está.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { modoDemoActivo } from './demo'

/**
 * ¿Estoy viendo la hermandad de otro? Devuelve su nombre, o `null`.
 *
 * NO LANZA. En una base que todavía no tiene `soporte.sql` la llamada da error
 * y aquí se traduce a «no» — que es la respuesta correcta: sin la pieza puesta
 * no hay suplantación posible.
 */
export async function dondeEstoyDeSoporte(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase || modoDemoActivo()) return null
  try {
    const { data, error } = await supabase.rpc('soporte_donde_estoy')
    if (error || typeof data !== 'string' || !data) return null
    return data
  } catch {
    return null
  }
}

/** Termina la suplantación. Deja constancia en el registro de esa hermandad. */
export async function salirDeSoporte(): Promise<void> {
  if (!supabase) return
  try {
    await supabase.rpc('soporte_salir')
  } catch {
    // Si no se puede, caduca sola en dos horas. Ver `soporte_sesion.hasta`.
  }
}
