import { leerPersistido } from './persistencia'

/**
 * Catálogos configurables de la hermandad: listas de valores que antes
 * estaban fijas en el código (categorías de tesorería, tipos de incidencia,
 * categorías de inventario, canales de comunicación…) y que cada hermandad
 * ajusta a su realidad desde Configuración. Cada catálogo se guarda bajo su
 * propia clave `cabildo-…`, de modo que la copia de seguridad los incluye
 * sola y el «restablecer datos» los limpia con el resto.
 */
export const CLAVES_CATALOGOS = {
  categoriasIngreso: 'cabildo-catalogo-ingresos',
  categoriasGasto: 'cabildo-catalogo-gastos',
  cuentasTesoreria: 'cabildo-catalogo-cuentas',
  tiposIncidencia: 'cabildo-catalogo-incidencias',
  categoriasEnser: 'cabildo-catalogo-enseres',
  canalesComunicado: 'cabildo-catalogo-canales',
  segmentosComunicado: 'cabildo-catalogo-segmentos',
} as const

/** Lee un catálogo guardado, o devuelve los valores por defecto si la hermandad aún no lo ha tocado. */
export function getLista(clave: string, porDefecto: readonly string[]): string[] {
  const valores = leerPersistido<string[]>(clave, [...porDefecto])
  return Array.isArray(valores) && valores.length > 0 ? valores : [...porDefecto]
}

export function saveLista(clave: string, valores: string[]) {
  localStorage.setItem(clave, JSON.stringify(valores))
}
