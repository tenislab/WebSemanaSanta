import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'

/**
 * Catálogo de etiquetas de la hermandad (costalero, acólito, banda…). Cada
 * hermandad crea las suyas; se guardan en el navegador (localStorage) y, más
 * adelante, en una tabla propia de Supabase. Sirven para segmentar avisos
 * (mandar un comunicado solo a los costaleros, por ejemplo) y para filtrar el
 * censo.
 */

export const CLAVE_ETIQUETAS = 'cabildo-etiquetas'

/** Etiquetas de ejemplo con las que arranca una hermandad nueva. */
export const ETIQUETAS_INICIALES: string[] = [
  'Costalero',
  'Acólito',
  'Banda / Música',
  'Monaguillo',
  'Nazareno',
  'Diputado de tramo',
  'Junta de gobierno',
]

export function getEtiquetas(): string[] {
  return leerPersistido<string[]>(CLAVE_ETIQUETAS, ETIQUETAS_INICIALES)
}

export function saveEtiquetas(etiquetas: string[]) {
  localStorage.setItem(CLAVE_ETIQUETAS, JSON.stringify(etiquetas))
}

/** Hook con el catálogo de etiquetas y un setter que persiste. */
export function useEtiquetas(): [string[], (siguiente: string[]) => void] {
  const [etiquetas, setEtiquetasState] = useState<string[]>(() => getEtiquetas())

  useEffect(() => {
    function sincronizar() {
      setEtiquetasState(getEtiquetas())
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  function setEtiquetas(siguiente: string[]) {
    // Sin duplicados y sin vacíos, conservando el orden de aparición.
    const limpias = Array.from(new Set(siguiente.map((e) => e.trim()).filter(Boolean)))
    setEtiquetasState(limpias)
    saveEtiquetas(limpias)
  }

  return [etiquetas, setEtiquetas]
}
