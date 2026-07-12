import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { tramoToRow, rowToTramo } from './db/tramos'

/**
 * Un cuerpo es cada bloque del cortejo (un paso y su acompañamiento): Cristo,
 * Virgen, Misterio, Palio, Cautivo… Lo define cada hermandad con el nombre
 * que use — puede haber uno, dos, tres o los que hagan falta. El nombre
 * «Único» tiene un trato especial al mostrar etiquetas (no se antepone).
 */
export type Cuerpo = string

export type ModoReparto = 'numero' | 'solicitud'

export interface Tramo {
  id: string
  nombre: string
  /** Cuerpo del cortejo al que pertenece: agrupa y ordena el reparto por separado. */
  cuerpo: Cuerpo
  /** Cuántos hermanos caben en este tramo. */
  capacidad: number
  /** Qué se porta en este tramo (cirio, insignia, vara, presidencia…); lo define cada hermandad, texto libre. */
  tipo?: string
  /**
   * Cómo se llena el tramo — lo elige la hermandad:
   *  - 'numero': automático por número de hermano, con cascada entre los tramos
   *    del mismo tipo del cuerpo (el comportamiento clásico de los cirios).
   *  - 'solicitud': los hermanos lo piden y se lo queda el de menor número.
   * Si falta (datos antiguos), se deduce del tipo: los «cirio» van por número.
   */
  reparto?: ModoReparto
  /** Precio de la papeleta de este tramo; si falta, se usa el precio general de la hermandad. */
  precio?: number | null
}

const STORAGE_KEY = 'cabildo-tramos'
const CUERPOS_KEY = 'cabildo-cuerpos'
const PRECIO_BASE_KEY = 'cabildo-precio-papeleta'

export const CUERPOS_POR_DEFECTO: Cuerpo[] = ['Cristo', 'Virgen', 'Único']

/** Precio general de la papeleta cuando el tramo no fija el suyo (editable en Configuración). */
export const PRECIO_BASE_POR_DEFECTO = 18

/**
 * Catálogo de tramos por defecto: un cortejo con dos pasos (Cristo y
 * Virgen), cada uno con sus tramos, más la banda de música. El orden de la
 * lista es el orden real de desfile dentro de cada cuerpo (el primero va
 * justo detrás de la cruz de guía). No se fija un rango de números: el
 * tramo de cada hermano se reparte solo según el aforo (capacidad) de cada
 * uno, en ese orden — ver lib/cortejo.ts.
 */
const TRAMOS_POR_DEFECTO: Tramo[] = [
  { id: 't1', nombre: 'Cruz de guía', cuerpo: 'Cristo', capacidad: 3, tipo: 'Insignia', reparto: 'solicitud', precio: 22 },
  { id: 't2', nombre: 'Insignias', cuerpo: 'Cristo', capacidad: 8, tipo: 'Insignia', reparto: 'solicitud' },
  { id: 't3', nombre: 'Cirio 1º tramo', cuerpo: 'Cristo', capacidad: 40, tipo: 'Cirio', reparto: 'numero' },
  { id: 't4', nombre: 'Cirio 2º tramo', cuerpo: 'Cristo', capacidad: 40, tipo: 'Cirio', reparto: 'numero' },
  { id: 't5', nombre: 'Música', cuerpo: 'Único', capacidad: 25, tipo: 'Música', reparto: 'solicitud' },
  { id: 't6', nombre: 'Cirio 1º tramo', cuerpo: 'Virgen', capacidad: 40, tipo: 'Cirio', reparto: 'numero' },
  { id: 't7', nombre: 'Cirio 2º tramo', cuerpo: 'Virgen', capacidad: 40, tipo: 'Cirio', reparto: 'numero' },
  { id: 't8', nombre: 'Presidencia', cuerpo: 'Virgen', capacidad: 8, tipo: 'Presidencia', reparto: 'solicitud' },
]

export function getTramos(): Tramo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Tramo[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // localStorage no disponible o datos corruptos: seguimos con los valores por defecto
  }
  return TRAMOS_POR_DEFECTO
}

/** Como `getTramos`, pero con Supabase conectado trae la lista real en cuanto llega. */
export function useTramos(): Tramo[] {
  const [tramos, setTramosState] = useState<Tramo[]>(() => getTramos())
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelado = false
    supabase
      .from('tramos')
      .select('*')
      .order('orden')
      .then(({ data, error }) => {
        if (cancelado || error || !data || data.length === 0) return
        const traidos = data.map(rowToTramo)
        setTramosState(traidos)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(traidos))
        } catch {
          // sin espacio o sin localStorage: no pasa nada, ya está en memoria
        }
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return tramos
}

/**
 * Guarda los tramos. Con Supabase conectado, compara con lo que hay en la
 * tabla y manda solo los inserts/updates/deletes que hacen falta (los
 * tramos se editan como borrador y se guardan de una vez con el botón
 * «Guardar tramos», no en cada tecleo).
 */
export async function saveTramos(tramos: Tramo[]) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.from('tramos').select('id')
      const idsActuales = new Set((data ?? []).map((r: { id: string }) => r.id))
      const nextIds = new Set(tramos.map((t) => t.id))
      const eliminados = [...idsActuales].filter((id) => !nextIds.has(id))
      const nuevos = tramos.filter((t) => !idsActuales.has(t.id))
      const posiblesCambios = tramos.filter((t) => idsActuales.has(t.id))

      if (eliminados.length > 0) await supabase.from('tramos').delete().in('id', eliminados)
      if (nuevos.length > 0) {
        await supabase.from('tramos').insert(nuevos.map((t, i) => tramoToRow(t, tramos.indexOf(t) ?? i)))
      }
      for (const t of posiblesCambios) {
        await supabase.from('tramos').update(tramoToRow(t, tramos.indexOf(t))).eq('id', t.id)
      }
    } catch (err) {
      console.error('No se pudieron guardar los tramos en Supabase:', err)
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tramos))
}

/**
 * Cuerpos configurados por la hermandad, en su orden. Si aún no se han
 * guardado (datos antiguos), se deducen de los tramos existentes para no
 * perder nada, con los de siempre como último recurso.
 */
export function getCuerpos(): Cuerpo[] {
  try {
    const raw = localStorage.getItem(CUERPOS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Cuerpo[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // seguimos con la deducción
  }
  const delosTramos = cuerposPresentes(getTramos())
  return delosTramos.length > 0 ? delosTramos : CUERPOS_POR_DEFECTO
}

export function saveCuerpos(cuerpos: Cuerpo[]) {
  localStorage.setItem(CUERPOS_KEY, JSON.stringify(cuerpos))
}

/** Precio general de la papeleta de la hermandad (el tramo puede fijar el suyo). */
export function getPrecioBase(): number {
  try {
    const raw = localStorage.getItem(PRECIO_BASE_KEY)
    if (raw !== null) {
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) return n
    }
  } catch {
    // valores por defecto
  }
  return PRECIO_BASE_POR_DEFECTO
}

export function savePrecioBase(precio: number) {
  localStorage.setItem(PRECIO_BASE_KEY, String(precio))
}

/** Precio de la papeleta de un tramo: el suyo propio o, si no lo fija, el general. */
export function precioDeTramo(tramo: Tramo | null | undefined, precioBase: number): number {
  if (tramo && tramo.precio != null && tramo.precio >= 0) return tramo.precio
  return precioBase
}

/** Cuerpos que aparecen en los tramos, en su orden de desfile (primera aparición). */
export function cuerposPresentes(tramos: Tramo[]): Cuerpo[] {
  const out: Cuerpo[] = []
  tramos.forEach((t) => {
    if (!out.includes(t.cuerpo)) out.push(t.cuerpo)
  })
  return out
}

/** Tramos de un cuerpo, en su orden de desfile (el orden en que están guardados). */
export function tramosDeCuerpo(cuerpo: Cuerpo, tramos: Tramo[]): Tramo[] {
  return tramos.filter((t) => t.cuerpo === cuerpo)
}

/** Aforo total de un cuerpo: la suma de la capacidad de todos sus tramos. */
export function aforoDeCuerpo(cuerpo: Cuerpo, tramos: Tramo[]): number {
  return tramosDeCuerpo(cuerpo, tramos).reduce((sum, t) => sum + t.capacidad, 0)
}

/** Nombre completo para mostrar, con el cuerpo delante salvo que sea único. */
export function etiquetaTramo(tramo: Tramo): string {
  return tramo.cuerpo === 'Único' ? tramo.nombre : `${tramo.cuerpo} — ${tramo.nombre}`
}

function normalizaTipo(tipo: string | undefined): string {
  return (tipo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Modo de reparto efectivo del tramo. Los datos guardados antes de que el
 * reparto fuera configurable no lo traen: en ese caso se deduce del tipo
 * (los «cirio» de toda la vida se llenan por número; el resto, por solicitud).
 */
export function repartoDe(tramo: Tramo): ModoReparto {
  if (tramo.reparto === 'numero' || tramo.reparto === 'solicitud') return tramo.reparto
  return normalizaTipo(tramo.tipo) === 'cirio' ? 'numero' : 'solicitud'
}

/** ¿Se llena automáticamente por número de hermano (comportamiento cirio)? */
export function esAutomatico(tramo: Tramo): boolean {
  return repartoDe(tramo) === 'numero'
}

export interface GrupoAutomatico {
  /** Etiqueta del grupo para selectores («Cirio», «Penitente»…). */
  etiqueta: string
  /** Tramos del grupo, en orden de desfile; la cascada corre dentro del grupo. */
  tramos: Tramo[]
}

/**
 * Agrupa los tramos automáticos de una lista por su tipo (los «Cirio 1º/2º»
 * cascadan entre sí; unos hipotéticos «Penitente 1º/2º» formarían su propio
 * grupo aparte). Los tramos automáticos sin tipo comparten un mismo grupo.
 */
export function gruposAutomaticos(tramos: Tramo[]): GrupoAutomatico[] {
  const grupos = new Map<string, GrupoAutomatico>()
  tramos.filter(esAutomatico).forEach((t) => {
    const clave = normalizaTipo(t.tipo) || '__auto'
    const existente = grupos.get(clave)
    if (existente) {
      existente.tramos.push(t)
    } else {
      grupos.set(clave, { etiqueta: t.tipo?.trim() || 'Por número', tramos: [t] })
    }
  })
  return [...grupos.values()]
}

/**
 * @deprecated Usa esAutomatico(): el comportamiento «cirio» ya no depende del
 * nombre del tipo, sino del modo de reparto que configure la hermandad.
 */
export function esCirio(tramo: Tramo): boolean {
  return esAutomatico(tramo)
}
