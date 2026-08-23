import { hermandadActualId } from './multiHermandad'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Lo que se guardaba SOLO en el navegador y se perdía al cerrar sesión.
 *
 * El modelo de papeleta, el de recibo y la hoja de asistencia del cortejo son
 * datos de la hermandad, pero no tenían tabla. Y al cerrar sesión se limpia
 * todo lo que empieza por `cabildo-` —correcto, si no la siguiente persona que
 * entrara en ese ordenador vería lo de otra hermandad— así que desaparecían.
 *
 * La hermandad dedicaba una tarde a dejar su papeleta con su escudo y sus
 * textos, cerraba sesión, y al día siguiente estaba la de fábrica. Sin
 * explicación posible.
 *
 * Y la asistencia no se puede rehacer: se marca la madrugada del Viernes
 * Santo, tramo por tramo, desde el móvil del diputado.
 *
 * Aquí van todas, contra las columnas de `hermandad_settings`.
 *
 * Se sumaron después otras dos del mismo tipo: los ajustes de cuotas y el
 * catálogo de etiquetas. Las dos son decisiones DE LA HERMANDAD y estaban en
 * el navegador de quien las tocó — el bloqueo de papeleta a los morosos no
 * valía desde otro ordenador, y el control de la mora por dos cargos se
 * saltaba abriendo otro navegador.
 */
export type PlantillaGuardable =
  | 'modelo_papeleta'
  | 'modelo_recibo'
  | 'asistencia'
  | 'ajustes_cuotas'
  | 'etiquetas'

/** Trae una de ellas, o null si no hay base de datos o no está guardada. */
export async function traerPlantilla<T>(cual: PlantillaGuardable): Promise<T | null> {
  if (!isSupabaseConfigured || !supabase) return null
  try {
    const { data, error } = await supabase.from('hermandad_settings').select(cual).maybeSingle()
    if (error || !data) return null
    const valor = (data as Record<string, unknown>)[cual]
    return (valor as T) ?? null
  } catch {
    return null
  }
}

/** La guarda. Devuelve si se ha podido, para que la pantalla no mienta. */
export async function guardarPlantilla(cual: PlantillaGuardable, valor: unknown): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return true
  try {
    const hermandadId = await hermandadActualId()
    if (!hermandadId) return false
    const { error } = await supabase
      .from('hermandad_settings')
      .upsert({ hermandad_id: hermandadId, [cual]: valor }, { onConflict: 'hermandad_id' })
    return !error
  } catch {
    return false
  }
}
