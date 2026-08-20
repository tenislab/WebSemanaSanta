import { useEffect, useState } from 'react'
import { leerPersistido, useEscuchaOtrasPestanas } from './persistencia'
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

/**
 * El catálogo de cuotas que tenga guardado este navegador.
 *
 * CON BASE DE DATOS DEVUELVE LISTA VACÍA cuando no hay nada guardado, y eso es
 * a propósito. Caer en `CONCEPTOS_CUOTA_INICIALES` («Cuota anual», 60 €) era
 * el camino a una remesa entera mal cobrada:
 *
 *   1. La hermandad tiene su «Cuota ordinaria» de 45 € y ya ha emitido 2026.
 *   2. El tesorero entra desde otro ordenador. Su navegador está limpio, así
 *      que Cuotas le ofrece «Cuota anual — 60 €», que no es suya.
 *   3. Como ningún recibo de la hermandad se llama «Cuota anual», la propia
 *      aplicación le avisa: «hay N hermanos sin la cuota anual de este año».
 *   4. Pulsa «Emitir» y salen recibos duplicados a TODO el censo, a 60 €.
 *   5. Si se domicilian, el banco carga 60 € a cada hermano que ya pagó 45.
 *
 * Y el aviso que le empujaba a hacerlo lo escribía la aplicación.
 */
export function getConceptosCuota(): ConceptoCuotaConfig[] {
  const valores = leerPersistido<ConceptoCuotaConfig[]>(STORAGE_KEY, [])
  if (Array.isArray(valores) && valores.length > 0) return valores
  return isSupabaseConfigured ? [] : CONCEPTOS_CUOTA_INICIALES
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
  // Lo que cambie en otra pestaña (el panel y el área del hermano abiertos a
  // la vez) se refleja aquí sin recargar.
  useEscuchaOtrasPestanas(STORAGE_KEY, () => setConceptos(getConceptosCuota()))

  return conceptos
}

export async function saveConceptosCuota(conceptos: ConceptoCuotaConfig[]) {
  // Primero el navegador (ver `saveLista`).
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conceptos))
  if (isSupabaseConfigured) {
    await reemplazarTablaCompleta(
      'conceptos_cuota',
      conceptos.map((c, orden) => ({ id: c.id, nombre: c.nombre, importe: c.importe, orden })),
    )
  }
}
