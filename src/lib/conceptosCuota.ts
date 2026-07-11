import { leerPersistido } from './persistencia'

/**
 * Conceptos de cuota de la hermandad, con su importe: cuota anual,
 * trimestral, juvenil, de costalero, derramas… Cada hermandad define los
 * suyos en Configuración; el módulo de Cuotas los ofrece al emitir recibos
 * y autorrellena el importe.
 */
export interface ConceptoCuotaConfig {
  id: string
  nombre: string
  importe: number
}

const STORAGE_KEY = 'cabildo-conceptos-cuota'

export const CONCEPTOS_CUOTA_INICIALES: ConceptoCuotaConfig[] = [
  { id: 'cc1', nombre: 'Cuota anual', importe: 60 },
  { id: 'cc2', nombre: 'Cuota trimestral', importe: 18 },
  { id: 'cc3', nombre: 'Cuota extraordinaria', importe: 25 },
]

export function getConceptosCuota(): ConceptoCuotaConfig[] {
  const valores = leerPersistido<ConceptoCuotaConfig[]>(STORAGE_KEY, CONCEPTOS_CUOTA_INICIALES)
  return Array.isArray(valores) && valores.length > 0 ? valores : CONCEPTOS_CUOTA_INICIALES
}

export function saveConceptosCuota(conceptos: ConceptoCuotaConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conceptos))
}
