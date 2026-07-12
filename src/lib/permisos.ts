import { leerPersistido } from './persistencia'
import { CARGOS, type Cargo } from '../data/documentos'

export interface Modulo {
  id: string
  label: string
}

/**
 * Módulos del panel que se pueden restringir por cargo. "Inicio" no está
 * aquí a propósito: el resumen general es visible para cualquier persona
 * con acceso al panel, tenga el cargo que tenga.
 */
export const MODULOS: Modulo[] = [
  { id: 'hermanos', label: 'Hermanos' },
  { id: 'cortejo', label: 'Cortejo' },
  { id: 'cuotas', label: 'Cuotas' },
  { id: 'papeletas', label: 'Papeletas de sitio' },
  { id: 'tesoreria', label: 'Tesorería' },
  { id: 'inventario', label: 'Inventario' },
  { id: 'archivo', label: 'Archivo documental' },
  { id: 'comunicados', label: 'Comunicados' },
  { id: 'informes', label: 'Informes' },
  { id: 'personal', label: 'Personal y permisos' },
  { id: 'configuracion', label: 'Configuración' },
]

const TODOS = MODULOS.map((m) => m.id)

/** Permisos de fábrica por cargo: un punto de partida razonable, pensado para editarse desde Personal. */
export const PERMISOS_POR_DEFECTO: Record<Cargo, string[]> = {
  'Hermano Mayor': TODOS,
  'Secretario/a': ['hermanos', 'cortejo', 'papeletas', 'archivo', 'comunicados', 'informes'],
  'Tesorero/a': ['tesoreria', 'cuotas', 'inventario', 'informes'],
  Fiscal: ['archivo', 'informes'],
  'Mayordomo/Prioste': ['cortejo', 'inventario', 'informes'],
  'Diputado/a Mayor de Gobierno': ['hermanos', 'cortejo', 'papeletas', 'informes'],
  Vocal: ['comunicados', 'informes'],
  'Hermano de a pie': [],
}

const STORAGE_KEY = 'cabildo-permisos-cargo'

/** Permisos actuales por cargo: los de fábrica, sustituidos por los que la hermandad haya personalizado. */
export function getPermisosPorCargo(): Record<Cargo, string[]> {
  const guardado = leerPersistido<Partial<Record<Cargo, string[]>>>(STORAGE_KEY, {})
  const combinado = { ...PERMISOS_POR_DEFECTO }
  for (const cargo of CARGOS) {
    if (guardado[cargo]) combinado[cargo] = guardado[cargo] as string[]
  }
  return combinado
}

export function savePermisosPorCargo(permisos: Record<Cargo, string[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(permisos))
}

/** Módulos visibles para un cargo, o null si no tiene restricción (titular de la hermandad). */
export function permisosDeCargo(cargo: Cargo | undefined | null): string[] | null {
  if (!cargo) return null
  return getPermisosPorCargo()[cargo] ?? []
}

export function puedeVerModulo(cargo: Cargo | undefined | null, moduloId: string) {
  const permisos = permisosDeCargo(cargo)
  return permisos === null || permisos.includes(moduloId)
}
