import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'

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
