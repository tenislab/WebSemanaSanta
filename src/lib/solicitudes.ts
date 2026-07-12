import { leerPersistido } from './persistencia'

export type EstadoSolicitud = 'Pendiente' | 'Aprobada' | 'Rechazada'

/**
 * Solicitud de alta como hermano/a, enviada desde el área del hermano por
 * quien todavía no está en el censo. La secretaría la revisa desde
 * Hermanos: al aprobarla se crea el hermano con el DNI, el correo y la
 * contraseña que la persona propuso; al rechazarla, queda constancia sin
 * dar de alta a nadie.
 */
export interface SolicitudAlta {
  id: string
  nombre: string
  dni: string
  email: string
  telefono: string
  /** Contraseña que la persona eligió al solicitar el alta; se convertirá en la suya si se aprueba. */
  clavePropuesta: string
  fecha: string
  estado: EstadoSolicitud
}

const STORAGE_KEY = 'cabildo-solicitudes'

export function getSolicitudes(): SolicitudAlta[] {
  return leerPersistido<SolicitudAlta[]>(STORAGE_KEY, [])
}

export function saveSolicitudes(solicitudes: SolicitudAlta[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(solicitudes))
}

/** Clave de almacenamiento de las solicitudes de una hermandad de muestra (su propio buzón, aislado del resto). */
export function claveSolicitudesMuestra(hermandadId: string) {
  return `cabildo-solicitudes-${hermandadId}`
}
