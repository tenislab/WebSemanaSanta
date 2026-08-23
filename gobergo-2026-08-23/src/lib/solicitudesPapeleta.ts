import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'

/**
 * Solicitud de papeleta de sitio que el hermano envía desde su área. La
 * secretaría la revisa desde Papeletas: al aceptarla se le emite la papeleta
 * en el tramo/modalidad pedidos; al rechazarla queda constancia. Es el paso
 * online que evita que el hermano tenga que pasar por secretaría.
 *
 * Por ahora se guarda en el navegador (modo local); con Supabase pasará a una
 * tabla propia (como solicitudes_alta).
 */

export type ModalidadPapeleta = 'Nazareno' | 'Penitente' | 'Acólito' | 'Otro'
export const MODALIDADES: ModalidadPapeleta[] = ['Nazareno', 'Penitente', 'Acólito', 'Otro']

export type EstadoSolicitudPapeleta = 'Pendiente' | 'Aceptada' | 'Rechazada'

export interface SolicitudPapeleta {
  id: string
  hermanoId: string
  hermanoNombre: string
  hermanoNumero: number
  anio: number
  modalidad: ModalidadPapeleta
  /** Preferencia libre (p. ej. «Cirio», «Mantilla»…). */
  preferencia: string
  /** Tramo o cuerpo solicitado, o «Sin preferencia». */
  tramoSolicitado: string
  comentario: string
  fecha: string
  estado: EstadoSolicitudPapeleta
}

const CLAVE = 'cabildo-solicitudes-papeleta'

export function getSolicitudesPapeleta(): SolicitudPapeleta[] {
  return leerPersistido<SolicitudPapeleta[]>(CLAVE, [])
}

export function saveSolicitudesPapeleta(lista: SolicitudPapeleta[]) {
  localStorage.setItem(CLAVE, JSON.stringify(lista))
}

/** Añade una solicitud (desde el área del hermano). */
export function crearSolicitudPapeleta(nueva: SolicitudPapeleta) {
  saveSolicitudesPapeleta([nueva, ...getSolicitudesPapeleta()])
}

/** Hook reactivo con las solicitudes de papeleta (se refresca entre pestañas). */
export function useSolicitudesPapeleta(): [SolicitudPapeleta[], (lista: SolicitudPapeleta[]) => void] {
  const [lista, setListaState] = useState<SolicitudPapeleta[]>(() => getSolicitudesPapeleta())
  useEffect(() => {
    function sync() {
      setListaState(getSolicitudesPapeleta())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  function setLista(next: SolicitudPapeleta[]) {
    setListaState(next)
    saveSolicitudesPapeleta(next)
  }
  return [lista, setLista]
}

/** ¿Tiene este hermano una solicitud de papeleta pendiente para el año dado? */
export function tieneSolicitudPendiente(hermanoId: string, anio: number): boolean {
  return getSolicitudesPapeleta().some((s) => s.hermanoId === hermanoId && s.anio === anio && s.estado === 'Pendiente')
}
