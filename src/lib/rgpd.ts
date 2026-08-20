import { CLAVES_DATOS, leerDatos } from './persistencia'
import { supabase, isSupabaseConfigured } from './supabase'
import { rowToHermano } from './db/hermanos'
import { rowToCuota } from './db/cuotas'
import { rowToPapeleta } from './db/papeletas'
import { rowToIncidencia } from './db/incidencias'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'
import { CUOTAS_INICIALES, type Cuota } from '../data/cuotas'
import { PAPELETAS_INICIALES, type Papeleta } from '../data/papeletas'
import { INCIDENCIAS_INICIALES, type Incidencia } from '../data/incidencias'

/**
 * Protección de datos (RGPD). Herramientas para atender los derechos de un
 * hermano sobre sus datos personales: acceso (descargar todo lo que la
 * hermandad guarda sobre él) y supresión (borrarlo del censo y de los
 * registros que lo referencian). El registro contable puede tener que
 * conservarse por ley; por eso la supresión avisa y la decide la hermandad.
 */

export interface DatosHermano {
  hermano: Hermano
  cuotas: Cuota[]
  papeletas: Papeleta[]
  incidencias: Incidencia[]
}

function todos() {
  const hermanos = leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
  const cuotas = leerDatos(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)
  const papeletas = leerDatos(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES)
  const incidencias = leerDatos(CLAVES_DATOS.incidencias, INCIDENCIAS_INICIALES)
  return { hermanos, cuotas, papeletas, incidencias }
}

/**
 * Recopila todo lo que la hermandad guarda sobre un hermano. Con Supabase
 * conectado consulta la base de datos directamente (no la copia local), para
 * que el export del derecho de acceso incluya SIEMPRE los datos reales —
 * sobre todo las incidencias, que el área del hermano no carga en local y de
 * otro modo saldrían siempre vacías.
 */
export async function recopilarDatosHermano(hermanoId: string): Promise<DatosHermano | null> {
  if (isSupabaseConfigured && supabase) {
    const cliente = supabase
    const { data: filaHermano } = await cliente.from('hermanos').select('*').eq('id', hermanoId).maybeSingle()
    if (!filaHermano) return null
    const [{ data: cuotasRows }, { data: papeletasRows }] = await Promise.all([
      cliente.from('cuotas').select('*').eq('hermano_id', hermanoId),
      cliente.from('papeletas').select('*').eq('hermano_id', hermanoId),
    ])
    const susPapeletas = (papeletasRows ?? []).map(rowToPapeleta)
    const idsPapeletas = susPapeletas.map((p) => p.id)
    const { data: incidenciasRows } = idsPapeletas.length
      ? await cliente.from('incidencias').select('*').in('papeleta_id', idsPapeletas)
      : { data: [] as Record<string, unknown>[] }
    return {
      hermano: rowToHermano(filaHermano),
      cuotas: (cuotasRows ?? []).map(rowToCuota),
      papeletas: susPapeletas,
      incidencias: (incidenciasRows ?? []).map(rowToIncidencia),
    }
  }

  const { hermanos, cuotas, papeletas, incidencias } = todos()
  const hermano = hermanos.find((h) => h.id === hermanoId)
  if (!hermano) return null
  const susPapeletas = papeletas.filter((p) => p.hermanoId === hermanoId)
  const idsPapeletas = new Set(susPapeletas.map((p) => p.id))
  return {
    hermano,
    cuotas: cuotas.filter((c) => c.hermanoId === hermanoId),
    papeletas: susPapeletas,
    incidencias: incidencias.filter((i) => idsPapeletas.has(i.papeletaId)),
  }
}

/** JSON legible con los datos personales del hermano, para entregárselo (derecho de acceso). */
export function exportarDatosHermano(datos: DatosHermano): string {
  return JSON.stringify(
    {
      documento: 'Datos personales — Reglamento General de Protección de Datos (RGPD)',
      generadoEl: new Date().toISOString(),
      hermano: datos.hermano,
      cuotas: datos.cuotas,
      papeletasDeSitio: datos.papeletas,
      incidencias: datos.incidencias,
    },
    null,
    2,
  )
}

/**
 * Borra al hermano y todos los registros que lo referencian (cuotas,
 * papeletas e incidencias). Devuelve el censo resultante para que la
 * pantalla que lo llama actualice su propio estado.
 *
 * Con Supabase conectado, basta con borrar la fila de `hermanos`: sus
 * cuotas y papeletas (y las incidencias de esas papeletas) tienen
 * `on delete cascade` y se borran solas en la base de datos. Sin Supabase,
 * hay que hacer esa cascada a mano sobre las cuatro colecciones en
 * localStorage.
 */
export async function borrarDatosHermano(hermanoId: string): Promise<Hermano[] | null> {
  if (isSupabaseConfigured && supabase) {
    await supabase.from('hermanos').delete().eq('id', hermanoId)
    const { data, error } = await supabase.from('hermanos').select('*').order('numero')
    if (error) {
      // OJO: null = «no se pudo releer», NO «el censo está vacío». Devolver []
      // hacía que un fallo puntual de red borrase el censo entero de la vista.
      console.error('No se pudo recargar el censo tras borrar el hermano:', error.message)
      return null
    }
    return (data ?? []).map(rowToHermano)
  }

  const { hermanos, cuotas, papeletas, incidencias } = todos()
  const idsPapeletas = new Set(papeletas.filter((p) => p.hermanoId === hermanoId).map((p) => p.id))

  const hermanosRest = hermanos.filter((h) => h.id !== hermanoId)
  const cuotasRest = cuotas.filter((c) => c.hermanoId !== hermanoId)
  const papeletasRest = papeletas.filter((p) => p.hermanoId !== hermanoId)
  const incidenciasRest = incidencias.filter((i) => !idsPapeletas.has(i.papeletaId))

  localStorage.setItem(CLAVES_DATOS.hermanos, JSON.stringify(hermanosRest))
  localStorage.setItem(CLAVES_DATOS.cuotas, JSON.stringify(cuotasRest))
  localStorage.setItem(CLAVES_DATOS.papeletas, JSON.stringify(papeletasRest))
  localStorage.setItem(CLAVES_DATOS.incidencias, JSON.stringify(incidenciasRest))

  return hermanosRest
}
