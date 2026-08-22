import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { guardarPlantilla, traerPlantilla } from './plantillasHermandad'

/**
 * Catálogo de etiquetas de la hermandad (costalero, acólito, banda…). Sirven
 * para segmentar avisos —mandar un comunicado solo a los costaleros— y para
 * filtrar el censo.
 *
 * Van en la base, en `hermandad_settings.etiquetas`. Antes vivían solo en el
 * navegador y eso daba dos problemas a la vez: el mayordomo creaba «Costalero
 * de repuesto» en su ordenador y desde secretaría esa etiqueta no existía, así
 * que el comunicado a ese grupo no se podía mandar; y al cerrar sesión se
 * borra todo lo que empieza por `cabildo-`, así que el catálogo entero
 * desaparecía y volvían las siete de fábrica.
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
  window.dispatchEvent(new Event('cabildo-etiquetas'))
  void guardarPlantilla('etiquetas', etiquetas)
}

/** Trae el catálogo de la hermandad y lo deja en la copia de este navegador. */
export async function cargarEtiquetasDeLaBase(): Promise<void> {
  const e = await traerPlantilla<string[]>('etiquetas')
  if (!Array.isArray(e)) return
  localStorage.setItem(CLAVE_ETIQUETAS, JSON.stringify(e))
  window.dispatchEvent(new Event('cabildo-etiquetas'))
}

/** Hook con el catálogo de etiquetas y un setter que persiste. */
export function useEtiquetas(): [string[], (siguiente: string[]) => void] {
  const [etiquetas, setEtiquetasState] = useState<string[]>(() => getEtiquetas())

  useEffect(() => {
    function sincronizar() {
      setEtiquetasState(getEtiquetas())
    }
    window.addEventListener('storage', sincronizar)
    window.addEventListener('cabildo-etiquetas', sincronizar)
    // Al montar, el catálogo de la hermandad manda sobre el de este navegador.
    void cargarEtiquetasDeLaBase()
    return () => {
      window.removeEventListener('storage', sincronizar)
      window.removeEventListener('cabildo-etiquetas', sincronizar)
    }
  }, [])

  function setEtiquetas(siguiente: string[]) {
    // Sin duplicados y sin vacíos, conservando el orden de aparición.
    const limpias = Array.from(new Set(siguiente.map((e) => e.trim()).filter(Boolean)))
    setEtiquetasState(limpias)
    saveEtiquetas(limpias)
  }

  return [etiquetas, setEtiquetas]
}
