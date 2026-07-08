export type Cuerpo = 'Cristo' | 'Virgen' | 'Único'

export interface Tramo {
  id: string
  nombre: string
  /** Cuerpo del cortejo al que pertenece: agrupa y ordena el reparto por separado. */
  cuerpo: Cuerpo
  /** Cuántos hermanos caben en este tramo. */
  capacidad: number
  /** Qué se porta en este tramo (cirio, insignia, vara, presidencia…); lo define cada hermandad, texto libre. */
  tipo?: string
}

const STORAGE_KEY = 'cabildo-tramos'

/**
 * Catálogo de tramos por defecto: un cortejo con dos pasos (Cristo y
 * Virgen), cada uno con sus tramos, más la banda de música. El orden de la
 * lista es el orden real de desfile dentro de cada cuerpo (el primero va
 * justo detrás de la cruz de guía). No se fija un rango de números: el
 * tramo de cada hermano se reparte solo según el aforo (capacidad) de cada
 * uno, en ese orden — ver lib/cortejo.ts.
 */
const TRAMOS_POR_DEFECTO: Tramo[] = [
  { id: 't1', nombre: 'Cruz de guía', cuerpo: 'Cristo', capacidad: 3, tipo: 'Insignia' },
  { id: 't2', nombre: 'Insignias', cuerpo: 'Cristo', capacidad: 8, tipo: 'Insignia' },
  { id: 't3', nombre: 'Cirio 1º tramo', cuerpo: 'Cristo', capacidad: 40, tipo: 'Cirio' },
  { id: 't4', nombre: 'Cirio 2º tramo', cuerpo: 'Cristo', capacidad: 40, tipo: 'Cirio' },
  { id: 't5', nombre: 'Música', cuerpo: 'Único', capacidad: 25, tipo: 'Música' },
  { id: 't6', nombre: 'Cirio 1º tramo', cuerpo: 'Virgen', capacidad: 40, tipo: 'Cirio' },
  { id: 't7', nombre: 'Cirio 2º tramo', cuerpo: 'Virgen', capacidad: 40, tipo: 'Cirio' },
  { id: 't8', nombre: 'Presidencia', cuerpo: 'Virgen', capacidad: 8, tipo: 'Presidencia' },
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

export function saveTramos(tramos: Tramo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tramos))
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

/** Rango de puestos [desde, hasta] que cubre un tramo dentro de su cuerpo, según el aforo acumulado de los tramos anteriores. */
export function rangoDeTramo(tramo: Tramo, tramosDelCuerpo: Tramo[]): [number, number] {
  let acumulado = 0
  for (const t of tramosDelCuerpo) {
    const desde = acumulado + 1
    acumulado += t.capacidad
    if (t.id === tramo.id) return [desde, acumulado]
  }
  return [0, 0]
}
