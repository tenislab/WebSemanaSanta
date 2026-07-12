import { supabase } from '../supabase'

/** Sustituye por completo el contenido de una tabla pequeña de catálogo (listas cortas, editadas en bloque desde Configuración). */
export async function reemplazarTablaCompleta(tabla: string, filas: Record<string, unknown>[]) {
  if (!supabase) return
  try {
    await supabase.from(tabla).delete().not('id', 'is', null)
    if (filas.length > 0) await supabase.from(tabla).insert(filas)
  } catch (err) {
    console.error(`No se pudo guardar "${tabla}" en Supabase:`, err)
  }
}

/** Igual, pero para la tabla genérica `catalogos` (clave, valor, orden), sustituyendo solo las filas de una clave. */
export async function reemplazarCatalogo(clave: string, valores: string[]) {
  if (!supabase) return
  try {
    await supabase.from('catalogos').delete().eq('clave', clave)
    if (valores.length > 0) {
      await supabase.from('catalogos').insert(valores.map((valor, orden) => ({ clave, valor, orden })))
    }
  } catch (err) {
    console.error(`No se pudo guardar el catálogo "${clave}" en Supabase:`, err)
  }
}

export async function leerCatalogoRemoto(clave: string): Promise<string[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('catalogos').select('*').eq('clave', clave).order('orden')
  if (error || !data || data.length === 0) return null
  return data.map((r: { valor: string }) => r.valor)
}

export async function leerTablaRemota<T>(
  tabla: string,
  fromRow: (row: Record<string, unknown>) => T,
  orderBy?: string,
): Promise<T[] | null> {
  if (!supabase) return null
  let query = supabase.from(tabla).select('*')
  if (orderBy) query = query.order(orderBy)
  const { data, error } = await query
  if (error || !data || data.length === 0) return null
  return data.map(fromRow)
}
