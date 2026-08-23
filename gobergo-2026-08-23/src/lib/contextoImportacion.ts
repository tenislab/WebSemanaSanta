import { useMemo } from 'react'
import { CLAVES_CATALOGOS, useLista } from './catalogos'
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO, CUENTAS_POR_DEFECTO } from '../data/movimientos'
import { CATEGORIAS_ENSER } from '../data/enseres'
import type { ContextoDeTabla } from './importarTabla'
import type { Hermano } from '../data/hermanos'

/**
 * Lo que el importador necesita saber de ESTA hermandad para leer un archivo:
 * su censo (para enganchar cada recibo a un hermano) y sus catálogos, que cada
 * una configura a su gusto en Configuración.
 *
 * Está en un sitio solo porque lo piden tres pantallas, y porque un contexto
 * montado a mano en cada una se despega: la que se olvidara de pasar las
 * categorías de gasto mandaría todos los gastos importados a «otros» sin que
 * nadie supiera por qué.
 *
 * El resultado va memorizado a propósito: el ensayo del importador se recalcula
 * cuando cambia el contexto, y un objeto nuevo en cada pintado lo recalcularía
 * entero con cada tecla.
 */
/**
 * El censo vacío, en una constante y no en un `= []` por defecto: un array
 * nuevo en cada pintado rompería la memorización de aquí abajo, y con ella la
 * del ensayo entero.
 */
const SIN_CENSO: Pick<Hermano, 'id' | 'dni' | 'nombre' | 'numero'>[] = []

export function useContextoDeImportacion(
  hermanos: Pick<Hermano, 'id' | 'dni' | 'nombre' | 'numero'>[] = SIN_CENSO,
): ContextoDeTabla {
  const categoriasIngreso = useLista(CLAVES_CATALOGOS.categoriasIngreso, CATEGORIAS_INGRESO)
  const categoriasGasto = useLista(CLAVES_CATALOGOS.categoriasGasto, CATEGORIAS_GASTO)
  const cuentas = useLista(CLAVES_CATALOGOS.cuentasTesoreria, CUENTAS_POR_DEFECTO)
  const categoriasEnser = useLista(CLAVES_CATALOGOS.categoriasEnser, CATEGORIAS_ENSER)

  return useMemo(
    () => ({
      hermanos,
      anioEnCurso: new Date().getFullYear(),
      categoriasIngreso,
      categoriasGasto,
      cuentas,
      categoriasEnser,
    }),
    [hermanos, categoriasIngreso, categoriasGasto, cuentas, categoriasEnser],
  )
}
