import { hermandadActualId } from './multiHermandad'
import { isSupabaseConfigured, supabase } from './supabase'
import { bloquePendiente, encolarSiEsDeRed } from './colaEscritura'

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
  /*
   * Y DOS MÁS, del mismo tipo y por el mismo motivo.
   *
   * `campana` es el año de la estación de penitencia y las fechas del plazo.
   * Es la que más daño hacía viviendo en un navegador, porque la lee también
   * el ÁREA DEL HERMANO: la secretaría abría la campaña de 2026 desde su
   * ordenador y el hermano, en el móvil, veía la de fábrica —otro año, otro
   * plazo, otra fecha de salida— y pedía sitio para una Semana Santa que no
   * tocaba, sin que ninguno de los dos viera nada raro.
   *
   * `campos_propios` son los campos a medida de la ficha. Aquí lo llamativo
   * es que el VALOR sí viajaba —va dentro de la ficha del hermano, que se
   * guarda en la base— y la definición no: desde otro ordenador, la talla de
   * túnica estaba guardada y no se veía por ninguna parte.
   */
  | 'campana'
  | 'campos_propios'

/** Trae una de ellas, o null si no hay base de datos o no está guardada. */
export async function traerPlantilla<T>(cual: PlantillaGuardable): Promise<T | null> {
  if (!isSupabaseConfigured || !supabase) return null
  /*
   * SI HAY ALGO DE ESTA CLAVE ESPERANDO EN LA COLA, NO SE TRAE.
   *
   * Es el guardia que salva la madrugada del Viernes Santo, y sin él la cola
   * no serviría de nada: el diputado marca trescientos hermanos sin cobertura,
   * la hoja se queda en la cola, y al arrancar la aplicación esto bajaba de la
   * base la hoja de ANTES de la madrugada y la escribía encima de la buena
   * —`cargarAsistenciaDeLaBase` hace exactamente eso—. La noche entera,
   * borrada por la propia copia de seguridad.
   *
   * Devolver `null` es «no hay nada que traer», y quien llama ya sabe qué
   * hacer con eso: dejar lo que tiene. Que es lo correcto, porque lo que tiene
   * es MÁS NUEVO que la base.
   */
  if (bloquePendiente(cual)) return null
  try {
    const { data, error } = await supabase.from('hermandad_settings').select(cual).maybeSingle()
    if (error || !data) return null
    const valor = (data as Record<string, unknown>)[cual]
    return (valor as T) ?? null
  } catch {
    return null
  }
}

/**
 * La guarda. Devuelve si se ha podido, para que la pantalla no mienta.
 *
 * Y SI NO SE HA PODIDO POR FALTA DE RED, SE APUNTA PARA DESPUÉS.
 *
 * Antes esto era un `catch { return false }` a secas, y quien llama usa `void`:
 * el valor devuelto se tiraba, así que el fallo no llegaba a ninguna parte. En
 * la asistencia eso es la madrugada del Viernes Santo perdida sin un aviso.
 * Ver `colaEscritura.ts`.
 */
export async function guardarPlantilla(cual: PlantillaGuardable, valor: unknown): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return true
  try {
    const hermandadId = await hermandadActualId()
    // Sin saber de qué hermandad es no se puede escribir, y puede ser porque la
    // consulta que lo averigua tampoco tiene red: se trata como falta de red.
    if (!hermandadId) {
      encolarSiEsDeRed('sin conexión', [{ clase: 'bloque', cual, valor }])
      return false
    }
    const { error } = await supabase
      .from('hermandad_settings')
      .upsert({ hermandad_id: hermandadId, [cual]: valor }, { onConflict: 'hermandad_id' })
    if (error) {
      // Un rechazo de la base NO se encola: fallaría igual las mil veces
      // siguientes. `encolarSiEsDeRed` lo distingue y devuelve false.
      encolarSiEsDeRed(error.message, [{ clase: 'bloque', cual, valor }])
      return false
    }
    return true
  } catch (err) {
    encolarSiEsDeRed(String(err), [{ clase: 'bloque', cual, valor }])
    return false
  }
}
