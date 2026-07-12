import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { isSupabaseConfigured } from './supabase'
import { leerTablaRemota, reemplazarTablaCompleta } from './db/catalogos'

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

function rowToConcepto(r: Record<string, unknown>): ConceptoCuotaConfig {
  return { id: r.id as string, nombre: r.nombre as string, importe: Number(r.importe) }
}

/** Como `getConceptosCuota`, pero con Supabase conectado trae la tabla real en cuanto llega. */
export function useConceptosCuota(): ConceptoCuotaConfig[] {
  const [conceptos, setConceptos] = useState<ConceptoCuotaConfig[]>(() => getConceptosCuota())
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelado = false
    leerTablaRemota('conceptos_cuota', rowToConcepto).then((traidos) => {
      if (cancelado || !traidos) return
      setConceptos(traidos)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(traidos))
    })
    return () => {
      cancelado = true
    }
  }, [])
  return conceptos
}

export async function saveConceptosCuota(conceptos: ConceptoCuotaConfig[]) {
  if (isSupabaseConfigured) {
    await reemplazarTablaCompleta(
      'conceptos_cuota',
      conceptos.map((c, orden) => ({ id: c.id, nombre: c.nombre, importe: c.importe, orden })),
    )
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conceptos))
}
