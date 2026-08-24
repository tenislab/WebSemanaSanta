import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { guardarPlantilla, traerPlantilla } from './plantillasHermandad'
import { RENOVACION_POR_DEFECTO, renovacionValida, type FechaRenovacion } from './cuotasEmision'

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
  /**
   * El día en que la hermandad renueva las cuotas: el 1 de enero en casi
   * todas, en septiembre en algunas. De aquí sale el ejercicio que toca
   * cobrar y la fecha de cobro de la emisión anual.
   */
  renovacion: FechaRenovacion
}

export const CLAVE_AJUSTES_CUOTAS = 'cabildo-ajustes-cuotas'

export const AJUSTES_CUOTAS_INICIAL: AjustesCuotas = {
  moraRequiereDosCargos: false,
  bloquearPapeletaConDeuda: false,
  renovacion: RENOVACION_POR_DEFECTO,
}

/**
 * Los ajustes guardados, con la fecha de renovación siempre puesta.
 *
 * Lo que hay en el navegador (y en la plantilla de la hermandad) puede venir
 * de antes de que existiera este ajuste: entonces `renovacion` llega
 * `undefined` y `leerPersistido` lo devuelve tal cual, porque solo sustituye
 * el objeto entero, no los campos que falten. Sin esto, la primera hermandad
 * que abriera Cuotas tras actualizar calcularía el ejercicio sobre
 * `undefined`.
 */
export function getAjustesCuotas(): AjustesCuotas {
  const a = leerPersistido<AjustesCuotas>(CLAVE_AJUSTES_CUOTAS, AJUSTES_CUOTAS_INICIAL)
  return { ...AJUSTES_CUOTAS_INICIAL, ...a, renovacion: renovacionValida(a?.renovacion) }
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
