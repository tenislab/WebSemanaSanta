import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { isSupabaseConfigured } from './supabase'
import { fetchPermisosPorCargoRemoto, guardarPermisosPorCargoRemoto } from './db/permisos'
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

/**
 * Refresca la caché local de permisos desde Supabase (si está conectado) y
 * devuelve una versión que cambia cuando llegan datos nuevos: úsala como
 * dependencia para recalcular menús/rutas en cuanto lleguen permisos reales,
 * no solo los que hubiera en este navegador.
 */
export function usePermisosSincronizados(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelado = false
    fetchPermisosPorCargoRemoto(PERMISOS_POR_DEFECTO).then((remoto) => {
      if (cancelado || !remoto) return
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remoto))
      setVersion((v) => v + 1)
    })
    return () => {
      cancelado = true
    }
  }, [])
  return version
}

/** Como `getPermisosPorCargo`, pero con Supabase conectado trae la tabla real en cuanto llega. */
export function usePermisosPorCargo(): Record<Cargo, string[]> {
  const version = usePermisosSincronizados()
  const [permisos, setPermisos] = useState<Record<Cargo, string[]>>(() => getPermisosPorCargo())
  useEffect(() => {
    setPermisos(getPermisosPorCargo())
    // Se relee de localStorage (ya actualizado por usePermisosSincronizados) cada vez que llega una versión nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])
  return permisos
}

export async function savePermisosPorCargo(permisos: Record<Cargo, string[]>) {
  if (isSupabaseConfigured) {
    await guardarPermisosPorCargoRemoto(permisos)
  }
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
