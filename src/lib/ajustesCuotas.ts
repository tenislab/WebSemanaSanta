import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { guardarPlantilla, traerPlantilla } from './plantillasHermandad'

/**
 * Ajustes de cuotas que decide cada hermandad. Por ahora: si poner en mora a un
 * hermano requiere que lo confirmen dos cargos (tesorero y secretario) o basta
 * con uno.
 */
export interface AjustesCuotas {
  /** Si true, la mora la ha de proponer un cargo y confirmar otro distinto. */
  moraRequiereDosCargos: boolean
  /** Si true, no se puede sacar papeleta a un hermano con cuotas pendientes. */
  bloquearPapeletaConDeuda: boolean
}

export const CLAVE_AJUSTES_CUOTAS = 'cabildo-ajustes-cuotas'

export const AJUSTES_CUOTAS_INICIAL: AjustesCuotas = { moraRequiereDosCargos: false, bloquearPapeletaConDeuda: false }

export function getAjustesCuotas(): AjustesCuotas {
  return leerPersistido<AjustesCuotas>(CLAVE_AJUSTES_CUOTAS, AJUSTES_CUOTAS_INICIAL)
}

export function saveAjustesCuotas(a: AjustesCuotas) {
  localStorage.setItem(CLAVE_AJUSTES_CUOTAS, JSON.stringify(a))
  window.dispatchEvent(new Event('cabildo-ajustes-cuotas'))
  /*
   * Y A LA BASE, porque esto lo decide la hermandad, no el navegador.
   *
   * `bloquearPapeletaConDeuda` es «a quien deba cuotas no se le saca
   * papeleta»: se acuerda en cabildo y se activa una vez. Viviendo solo aquí,
   * quien atendía el sábado desde el otro ordenador no tenía el bloqueo y le
   * sacaba la papeleta a un moroso.
   *
   * Y `moraRequiereDosCargos` es un control de cuatro ojos. Un control de
   * cuatro ojos que se salta abriendo otro navegador no es un control.
   */
  void guardarPlantilla('ajustes_cuotas', a)
}

/** Trae los ajustes de la hermandad y los deja en la copia de este navegador. */
export async function cargarAjustesCuotasDeLaBase(): Promise<void> {
  const a = await traerPlantilla<AjustesCuotas>('ajustes_cuotas')
  if (!a) return
  localStorage.setItem(CLAVE_AJUSTES_CUOTAS, JSON.stringify(a))
  window.dispatchEvent(new Event('cabildo-ajustes-cuotas'))
}

export function useAjustesCuotas(): [AjustesCuotas, (a: AjustesCuotas) => void] {
  const [ajustes, setAjustesState] = useState<AjustesCuotas>(() => getAjustesCuotas())
  useEffect(() => {
    function sync() {
      setAjustesState(getAjustesCuotas())
    }
    window.addEventListener('storage', sync)
    window.addEventListener('cabildo-ajustes-cuotas', sync)
    // Al montar, lo que diga la base manda sobre lo que hubiera aquí.
    void cargarAjustesCuotasDeLaBase()
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('cabildo-ajustes-cuotas', sync)
    }
  }, [])
  function setAjustes(a: AjustesCuotas) {
    setAjustesState(a)
    saveAjustesCuotas(a)
  }
  return [ajustes, setAjustes]
}
