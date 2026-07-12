import { CLAVES_DATOS, leerPersistido } from './persistencia'
import { supabase, isSupabaseConfigured } from './supabase'
import { rowToHermano } from './db/hermanos'
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
  const hermanos = leerPersistido(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
  const cuotas = leerPersistido(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)
  const papeletas = leerPersistido(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES)
  const incidencias = leerPersistido(CLAVES_DATOS.incidencias, INCIDENCIAS_INICIALES)
  return { hermanos, cuotas, papeletas, incidencias }
}

/** Recopila todo lo que la hermandad guarda sobre un hermano. */
export function recopilarDatosHermano(hermanoId: string): DatosHermano | null {
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
export async function borrarDatosHermano(hermanoId: string): Promise<Hermano[]> {
  if (isSupabaseConfigured && supabase) {
    await supabase.from('hermanos').delete().eq('id', hermanoId)
    const { data, error } = await supabase.from('hermanos').select('*').order('numero')
    if (error) {
      console.error('No se pudo recargar el censo tras borrar el hermano:', error.message)
      return []
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
