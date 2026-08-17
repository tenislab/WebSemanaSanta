import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'

/**
 * Ajustes de cuotas que decide cada hermandad. Por ahora: si poner en mora a un
 * hermano requiere que lo confirmen dos cargos (tesorero y secretario) o basta
 * con uno.
 */
export interface AjustesCuotas {
  /** Si true, la mora la ha de proponer un cargo y confirmar otro distinto. */
  moraRequiereDosCargos: boolean
}

export const CLAVE_AJUSTES_CUOTAS = 'cabildo-ajustes-cuotas'

export const AJUSTES_CUOTAS_INICIAL: AjustesCuotas = { moraRequiereDosCargos: false }

export function getAjustesCuotas(): AjustesCuotas {
  return leerPersistido<AjustesCuotas>(CLAVE_AJUSTES_CUOTAS, AJUSTES_CUOTAS_INICIAL)
}

export function saveAjustesCuotas(a: AjustesCuotas) {
  localStorage.setItem(CLAVE_AJUSTES_CUOTAS, JSON.stringify(a))
}

export function useAjustesCuotas(): [AjustesCuotas, (a: AjustesCuotas) => void] {
  const [ajustes, setAjustesState] = useState<AjustesCuotas>(() => getAjustesCuotas())
  useEffect(() => {
    function sync() {
      setAjustesState(getAjustesCuotas())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  function setAjustes(a: AjustesCuotas) {
    setAjustesState(a)
    saveAjustesCuotas(a)
  }
  return [ajustes, setAjustes]
}
