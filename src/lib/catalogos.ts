import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { supabase, isSupabaseConfigured } from './supabase'
import { leerCatalogoRemoto, reemplazarCatalogo } from './db/catalogos'

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

/** Como `getLista`, pero con Supabase conectado trae el catálogo real en cuanto llega. */
export function useLista(clave: string, porDefecto: readonly string[]): string[] {
  const [lista, setLista] = useState<string[]>(() => getLista(clave, porDefecto))
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelado = false
    leerCatalogoRemoto(clave).then((traida) => {
      if (cancelado || !traida) return
      setLista(traida)
      localStorage.setItem(clave, JSON.stringify(traida))
    })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  return lista
}

export async function saveLista(clave: string, valores: string[]) {
  if (isSupabaseConfigured) await reemplazarCatalogo(clave, valores)
  localStorage.setItem(clave, JSON.stringify(valores))
}

/**
 * Varios catálogos a la vez (los 7 de Configuración), en una sola consulta a
 * Supabase en vez de una por catálogo — así el hook se llama una única vez,
 * sin depender de cuántas claves haya.
 */
export function useCatalogos(
  defs: readonly { k: string; clave: string; porDefecto: readonly string[] }[],
): Record<string, string[]> {
  const [listas, setListas] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(defs.map((d) => [d.k, getLista(d.clave, d.porDefecto)])),
  )
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelado = false
    supabase
      .from('catalogos')
      .select('*')
      .order('orden')
      .then(({ data, error }) => {
        if (cancelado || error || !data) return
        const porClave = new Map<string, string[]>()
        data.forEach((r: { clave: string; valor: string }) => {
          const actuales = porClave.get(r.clave) ?? []
          actuales.push(r.valor)
          porClave.set(r.clave, actuales)
        })
        const combinado = { ...listas }
        let huboAlguno = false
        defs.forEach((d) => {
          const traida = porClave.get(d.clave)
          if (traida && traida.length > 0) {
            combinado[d.k] = traida
            huboAlguno = true
            localStorage.setItem(d.clave, JSON.stringify(traida))
          }
        })
        if (huboAlguno) setListas(combinado)
      })
    return () => {
      cancelado = true
    }
    // Solo al montar: Configuración monta este hook una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return listas
}
