import type { HermandadSettings } from './hermandadSettings'

/**
 * Cuándo sale el asistente de alta: la hermandad está recién creada y no tiene
 * ninguno de los datos que hacen falta. Está aquí y no en el componente para
 * que se pueda probar y para no romper la recarga en caliente.
 */
export const CLAVE_ALTA_HECHA = 'cabildo-alta-hermandad-hecha'

export function altaPendiente(s: HermandadSettings): boolean {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(CLAVE_ALTA_HECHA) === 'si') return false
  return !s.cif.trim() && !s.direccion.trim() && !s.iban.trim()
}
