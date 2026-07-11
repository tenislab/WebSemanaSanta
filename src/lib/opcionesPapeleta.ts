import { leerPersistido } from './persistencia'

/**
 * Papeletas personalizadas de la hermandad: además de los puestos del cortejo
 * (cirio, vara, cruz de guía…), cada hermandad puede vender papeletas propias
 * con su nombre y su precio — mantilla, papeleta simbólica del que no
 * procesiona, recuerdo… Se editan en Configuración y se ofrecen tanto en la
 * gestión de papeletas como en el área del hermano al sacar la papeleta.
 */
export interface OpcionPapeleta {
  id: string
  nombre: string
  importe: number
}

const STORAGE_KEY = 'cabildo-papeletas-opciones'

/** Ejemplos iniciales; la hermandad los cambia o borra desde Configuración. */
export const OPCIONES_INICIALES: OpcionPapeleta[] = [
  { id: 'op1', nombre: 'Papeleta simbólica (no procesiona)', importe: 5 },
  { id: 'op2', nombre: 'Mantilla', importe: 15 },
]

export function getOpcionesPapeleta(): OpcionPapeleta[] {
  return leerPersistido(STORAGE_KEY, OPCIONES_INICIALES)
}

export function saveOpcionesPapeleta(opciones: OpcionPapeleta[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(opciones))
}
