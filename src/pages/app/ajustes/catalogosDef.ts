import { CANALES, SEGMENTOS } from '../../../data/comunicados'
import { CATEGORIAS_ENSER } from '../../../data/enseres'
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO, CUENTAS_POR_DEFECTO } from '../../../data/movimientos'
import { CLAVES_CATALOGOS } from '../../../lib/catalogos'
import { TIPOS_INCIDENCIA_POR_DEFECTO } from '../../../data/incidencias'

/**
 * LAS LISTAS QUE LA HERMANDAD RELLENA A SU MANERA.
 *
 * Vive aparte porque la usan la sección de catálogos y el resto de la
 * pantalla, y la sección se fue a su fichero.
 */
export const CATALOGOS_DEF = [
  { k: 'ingresos', clave: CLAVES_CATALOGOS.categoriasIngreso, titulo: 'Categorías de ingresos', porDefecto: CATEGORIAS_INGRESO },
  { k: 'gastos', clave: CLAVES_CATALOGOS.categoriasGasto, titulo: 'Categorías de gastos', porDefecto: CATEGORIAS_GASTO },
  { k: 'cuentas', clave: CLAVES_CATALOGOS.cuentasTesoreria, titulo: 'Cuentas de tesorería', porDefecto: CUENTAS_POR_DEFECTO },
  { k: 'incidencias', clave: CLAVES_CATALOGOS.tiposIncidencia, titulo: 'Tipos de incidencia (día de salida)', porDefecto: TIPOS_INCIDENCIA_POR_DEFECTO },
  { k: 'enseres', clave: CLAVES_CATALOGOS.categoriasEnser, titulo: 'Categorías del inventario', porDefecto: CATEGORIAS_ENSER },
  { k: 'canales', clave: CLAVES_CATALOGOS.canalesComunicado, titulo: 'Canales de comunicación', porDefecto: CANALES },
  { k: 'segmentos', clave: CLAVES_CATALOGOS.segmentosComunicado, titulo: 'Destinatarios de comunicados', porDefecto: SEGMENTOS },
] as const
