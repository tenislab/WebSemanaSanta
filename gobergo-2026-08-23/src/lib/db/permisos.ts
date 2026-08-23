import { supabase } from '../supabase'
import { CARGOS, type Cargo } from '../../data/documentos'

/** Trae los permisos por cargo desde la tabla `permisos_cargo`, combinados con los de fábrica (recibidos por parámetro para no crear un import circular con lib/permisos.ts). */
export async function fetchPermisosPorCargoRemoto(
  porDefecto: Record<Cargo, string[]>,
): Promise<Record<Cargo, string[]> | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('permisos_cargo').select('*')
  if (error || !data || data.length === 0) return null
  const combinado: Record<Cargo, string[]> = { ...porDefecto }
  for (const cargo of CARGOS) combinado[cargo] = []
  data.forEach((fila) => {
    const cargo = fila.cargo as Cargo
    const moduloId = fila.modulo_id as string
    if (!combinado[cargo]) combinado[cargo] = []
    combinado[cargo].push(moduloId)
  })
  return combinado
}

/** Reemplaza por completo los permisos por cargo en Supabase (tabla pequeña, ~30 filas: más simple que diferenciar). */
/**
 * Reemplaza los permisos por cargo de ESTA hermandad.
 *
 * Devuelve el error si lo hubo, en vez de tragárselo. Antes solo lo escribía
 * en la consola y la pantalla ponía «Permisos guardados» en verde pasara lo
 * que pasara: se cambiaban los permisos del tesorero, salía el visto bueno, y
 * al volver estaban como antes.
 *
 * El `delete` no necesita filtrar por hermandad: la frontera de la base de
 * datos ya impide tocar filas de otra. Pero se deja el `in(CARGOS)` porque
 * acota lo que se borra a los cargos conocidos, no a la tabla entera.
 */
export async function guardarPermisosPorCargoRemoto(
  permisos: Record<Cargo, string[]>,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: true }
  const filas = CARGOS.flatMap((cargo) => (permisos[cargo] ?? []).map((moduloId) => ({ cargo, modulo_id: moduloId })))
  try {
    const { error: borrado } = await supabase.from('permisos_cargo').delete().in('cargo', CARGOS)
    if (borrado) return { ok: false, error: borrado.message }
    if (filas.length > 0) {
      const { error: alta } = await supabase.from('permisos_cargo').insert(filas)
      if (alta) return { ok: false, error: alta.message }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'no se pudo guardar' }
  }
}
