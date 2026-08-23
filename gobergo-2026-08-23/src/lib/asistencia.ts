import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { guardarPlantilla, traerPlantilla } from './plantillasHermandad'

/**
 * Asistencia al día de salida (estación de penitencia). Para cada edición
 * (año) se guarda, por hermano, si asiste, si no asiste (con el motivo) o si
 * está pendiente de confirmar. Lo gestionan la secretaría (panel · Cortejo) y
 * los diputados de tramo desde su área de hermano.
 *
 * Se guarda en el navegador (localStorage) y, más adelante, en una tabla
 * propia de Supabase.
 */

export type EstadoAsistencia = 'pendiente' | 'asiste' | 'no_asiste'

export interface RegistroAsistencia {
  estado: EstadoAsistencia
  /** Motivo de la ausencia (solo cuando estado === 'no_asiste'). */
  motivo?: string
  /** Quién lo marcó (nombre del diputado o «Secretaría»), como traza. */
  por?: string
}

export const CLAVE_ASISTENCIA = 'cabildo-asistencia'

type MapaAsistencia = Record<string, RegistroAsistencia>

/** Clave de un hermano dentro de una edición. */
function clave(anio: number, hermanoId: string): string {
  return `${anio}:${hermanoId}`
}

export function getAsistencias(): MapaAsistencia {
  return leerPersistido<MapaAsistencia>(CLAVE_ASISTENCIA, {})
}

export function getAsistencia(anio: number, hermanoId: string): RegistroAsistencia {
  return getAsistencias()[clave(anio, hermanoId)] ?? { estado: 'pendiente' }
}

export function setAsistencia(anio: number, hermanoId: string, registro: RegistroAsistencia) {
  const mapa = getAsistencias()
  mapa[clave(anio, hermanoId)] = registro
  localStorage.setItem(CLAVE_ASISTENCIA, JSON.stringify(mapa))
  // Avisa a otras pestañas/hooks del mismo navegador.
  window.dispatchEvent(new Event('cabildo-asistencia'))
  /**
   * Y a la base de datos. Esto NO es un ajuste que se pueda rehacer: se marca
   * la madrugada del Viernes Santo, tramo por tramo, desde el móvil del
   * diputado. Guardado solo en ese móvil, se perdía al cerrar sesión — y
   * además el resto de la junta no lo veía.
   */
  void guardarPlantilla('asistencia', mapa)
}

/** Trae la asistencia de la hermandad y la deja en la copia local. */
export async function cargarAsistenciaDeLaBase(): Promise<MapaAsistencia | null> {
  const m = await traerPlantilla<MapaAsistencia>('asistencia')
  if (!m || typeof m !== 'object') return null
  localStorage.setItem(CLAVE_ASISTENCIA, JSON.stringify(m))
  window.dispatchEvent(new Event('cabildo-asistencia'))
  return m
}

export function etiquetaAsistencia(estado: EstadoAsistencia): string {
  if (estado === 'asiste') return 'Asiste'
  if (estado === 'no_asiste') return 'No asiste'
  return 'Sin confirmar'
}

export function claseAsistencia(estado: EstadoAsistencia): string {
  if (estado === 'asiste') return 'pill--ok'
  if (estado === 'no_asiste') return 'pill--warn'
  return 'pill--info'
}

/**
 * Hook reactivo con el mapa de asistencia y un setter que persiste. Se
 * resincroniza cuando cambia en esta pestaña o en otra.
 */
export function useAsistencias(): [MapaAsistencia, (anio: number, hermanoId: string, r: RegistroAsistencia) => void] {
  const [mapa, setMapa] = useState<MapaAsistencia>(() => getAsistencias())

  useEffect(() => {
    function sincronizar() {
      setMapa(getAsistencias())
    }
    window.addEventListener('storage', sincronizar)
    window.addEventListener('cabildo-asistencia', sincronizar)
    return () => {
      window.removeEventListener('storage', sincronizar)
      window.removeEventListener('cabildo-asistencia', sincronizar)
    }
  }, [])

  function marcar(anio: number, hermanoId: string, r: RegistroAsistencia) {
    setAsistencia(anio, hermanoId, r)
    setMapa(getAsistencias())
  }

  return [mapa, marcar]
}

/** Lee el registro del mapa (para no recalcular claves en los componentes). */
export function registroDe(mapa: MapaAsistencia, anio: number, hermanoId: string): RegistroAsistencia {
  return mapa[clave(anio, hermanoId)] ?? { estado: 'pendiente' }
}

/* ==========================================================================
   EL HISTORIAL DE CADA HERMANO, AÑO A AÑO

   Llegó dicho así: «si se da que no asiste que se guarde para el año
   siguiente en el historial de asistencia de cada hermano, eso hay que
   crearlo».

   Y resultó que guardado ya estaba: la clave del mapa es `año:hermano`, así
   que lo de cada edición se queda donde estaba y no se pisa. Lo que NO había
   era manera de VERLO. La asistencia se marcaba la madrugada del Viernes
   Santo y ahí moría: al año siguiente, repartiendo el cortejo, nadie sabía
   quién faltó el año pasado ni por qué.

   Que es justo el dato que hace falta en ese momento. Un hermano que lleva dos
   años sin salir no debería llevarse un sitio de los buenos por delante de
   quien no ha faltado nunca — y eso, hoy, se decide de memoria.
   ========================================================================== */

/** Una edición del historial de un hermano. */
export interface AnioDeAsistencia {
  anio: number
  estado: EstadoAsistencia
  motivo?: string
}

/**
 * Todo lo que consta de un hermano, de más reciente a más antiguo.
 *
 * Los años que no constan NO se rellenan con «pendiente»: un año sin dato no
 * es un año en el que estuviera pendiente, es un año del que no se sabe nada
 * —quizá ni era hermano—. Inventarlo llenaría la ficha de filas falsas.
 */
export function historialDeAsistencia(mapa: MapaAsistencia, hermanoId: string): AnioDeAsistencia[] {
  const suyos: AnioDeAsistencia[] = []
  for (const [k, registro] of Object.entries(mapa)) {
    const [anio, id] = k.split(':')
    if (id !== hermanoId) continue
    const n = Number(anio)
    if (!Number.isFinite(n)) continue
    suyos.push({ anio: n, estado: registro.estado, motivo: registro.motivo })
  }
  return suyos.sort((a, b) => b.anio - a.anio)
}

/**
 * Cuántas veces ha faltado y cuántas ha salido, contando solo lo que consta.
 *
 * Lo pendiente no cuenta ni a un lado ni a otro: un año marcado «pendiente» es
 * un año que nadie llegó a cerrar, y sumarlo a las faltas acusaría al hermano
 * de un descuido de la secretaría.
 */
export function resumenDeAsistencia(historial: AnioDeAsistencia[]): {
  salidas: number
  faltas: number
  ultimaFalta: AnioDeAsistencia | null
} {
  const faltas = historial.filter((h) => h.estado === 'no_asiste')
  return {
    salidas: historial.filter((h) => h.estado === 'asiste').length,
    faltas: faltas.length,
    // El historial ya viene de más reciente a más antiguo.
    ultimaFalta: faltas[0] ?? null,
  }
}

/**
 * El historial dicho en una frase, para ponerlo al lado del nombre al repartir
 * el cortejo. Vacío cuando no consta nada: mejor no decir nada que decir «0
 * salidas» de alguien que lleva veinte años saliendo y entró antes de que esto
 * existiera.
 */
export function asistenciaEnUnaFrase(historial: AnioDeAsistencia[]): string {
  const { salidas, faltas, ultimaFalta } = resumenDeAsistencia(historial)
  if (salidas === 0 && faltas === 0) return ''
  const partes: string[] = []
  if (salidas > 0) partes.push(salidas === 1 ? 'ha salido 1 vez' : `ha salido ${salidas} veces`)
  if (faltas > 0) {
    partes.push(faltas === 1 ? 'ha faltado 1 vez' : `ha faltado ${faltas} veces`)
  }
  const frase = partes.join(' y ')
  return ultimaFalta ? `${frase} (la última, en ${ultimaFalta.anio})` : frase
}
