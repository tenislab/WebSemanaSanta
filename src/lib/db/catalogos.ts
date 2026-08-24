import { supabase } from '../supabase'
import { traerTodasLasFilas } from '../paginado'

/** Sustituye por completo el contenido de una tabla pequeña de catálogo (listas cortas, editadas en bloque desde Configuración). */
/**
 * Sustituye el contenido entero de una tabla pequeña: borra y vuelve a
 * insertar. Se usa con `conceptos_cuota` y `opciones_papeleta`, o sea con la
 * LISTA DE PRECIOS de la hermandad.
 *
 * BORRA ANTES DE INSERTAR, y por eso hay que mirar los dos errores. Si el
 * borrado sale bien y el alta falla —una política que no deja escribir, una
 * columna que no cuadra— la tabla se queda VACÍA: no es que no se guarde lo
 * nuevo, es que además desaparece lo que había. Y como no se miraba ningún
 * error, la hermandad se quedaba sin sus conceptos de cuota ni sus tipos de
 * papeleta, en silencio y con el visto bueno verde en pantalla.
 *
 * El borrado solo alcanza a las filas de esta hermandad: de eso se encarga la
 * política `solo_mi_hermandad`, no este código.
 */
export async function reemplazarTablaCompleta(
  tabla: string,
  filas: Record<string, unknown>[],
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: true }
  try {
    const { error: borrando } = await supabase.from(tabla).delete().not('id', 'is', null)
    if (borrando) {
      avisarDelFallo(tabla, `borrar: ${borrando.message}`)
      return { ok: false, error: borrando.message }
    }
    if (filas.length > 0) {
      const { error } = await supabase.from(tabla).insert(filas)
      if (error) {
        avisarDelFallo(tabla, `crear: ${error.message}`)
        return { ok: false, error: error.message }
      }
    }
    return { ok: true }
  } catch (err) {
    avisarDelFallo(tabla, String(err))
    return { ok: false, error: String(err) }
  }
}

/**
 * Igual, pero para la tabla genérica `catalogos` (clave, valor, orden),
 * sustituyendo solo las filas de una clave.
 *
 * BORRA Y LUEGO INSERTA, y por eso hay que mirar los dos errores. Si el
 * borrado sale bien y el alta falla —una columna que no cuadra, una política
 * que no deja escribir— el catálogo se queda VACÍO: no es que no se guarde lo
 * nuevo, es que además desaparece lo que había. Y como no se miraba ningún
 * error, eso pasaba en silencio.
 *
 * Si el alta falla, se dice y se avisa por la banda de la aplicación, que es
 * donde quien está delante puede verlo.
 */
export async function reemplazarCatalogo(clave: string, valores: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: true }
  try {
    const { error: borrando } = await supabase.from('catalogos').delete().eq('clave', clave)
    if (borrando) {
      avisarDelFallo(clave, `borrar: ${borrando.message}`)
      return { ok: false, error: borrando.message }
    }
    if (valores.length > 0) {
      const { error } = await supabase
        .from('catalogos').insert(valores.map((valor, orden) => ({ clave, valor, orden })))
      if (error) {
        avisarDelFallo(clave, `crear: ${error.message}`)
        return { ok: false, error: error.message }
      }
    }
    return { ok: true }
  } catch (err) {
    avisarDelFallo(clave, String(err))
    return { ok: false, error: String(err) }
  }
}

function avisarDelFallo(clave: string, fallo: string) {
  console.error(`No se pudo guardar el catálogo "${clave}" en Supabase:`, fallo)
  window.dispatchEvent(new CustomEvent('cabildo-sync-error', {
    detail: { tabla: `catálogo «${clave}»`, fallos: [fallo] },
  }))
}

export async function leerCatalogoRemoto(clave: string): Promise<string[] | null> {
  if (!supabase) return null
  /*
   * También por páginas. Un catálogo de etiquetas no llega a mil valores casi
   * nunca —pero «casi nunca» es la razón por la que el corte pasa
   * desapercibido el día que ocurre—, y aquí sale gratis: si cabe en una
   * página, es una sola petición, igual que antes.
   */
  const { data, error } = await traerTodasLasFilas<{ valor: string }>((desde, hasta) =>
    supabase!.from('catalogos').select('*').eq('clave', clave).order('orden').range(desde, hasta))
  if (error || !data || data.length === 0) return null
  return data.map((r) => r.valor)
}

export async function leerTablaRemota<T>(
  tabla: string,
  fromRow: (row: Record<string, unknown>) => T,
  orderBy?: string,
): Promise<T[] | null> {
  if (!supabase) return null
  /*
   * Por páginas: `select('*')` trae mil filas y calla. Ver `lib/paginado.ts`.
   *
   * Y ordenado siempre, porque sin `order` dos páginas pueden traer filas
   * repetidas y saltarse otras. Por `id` cuando no se pide otra cosa: las dos
   * tablas que llegan aquí —`conceptos_cuota` y `opciones_papeleta`— lo
   * tienen. Las que NO tienen `id` (`permisos_cargo`, `catalogos`) no pasan
   * por aquí; en la copia de seguridad, que sí las trae, hay una lista con la
   * columna de cada una.
   */
  const { data, error } = await traerTodasLasFilas<Record<string, unknown>>((desde, hasta) => {
    const q = supabase!.from(tabla).select('*')
    return (orderBy ? q.order(orderBy) : q.order('id')).range(desde, hasta)
  })
  if (error || !data || data.length === 0) return null
  return data.map(fromRow)
}
