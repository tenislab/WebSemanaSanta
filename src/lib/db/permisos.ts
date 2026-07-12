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
export async function guardarPermisosPorCargoRemoto(permisos: Record<Cargo, string[]>) {
  if (!supabase) return
  const filas = CARGOS.flatMap((cargo) => (permisos[cargo] ?? []).map((moduloId) => ({ cargo, modulo_id: moduloId })))
  await supabase.from('permisos_cargo').delete().in('cargo', CARGOS)
  if (filas.length > 0) await supabase.from('permisos_cargo').insert(filas)
}
