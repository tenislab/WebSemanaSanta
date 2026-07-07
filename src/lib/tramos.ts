export interface Tramo {
  id: string
  nombre: string
  /** Puesto inicial del rango (inclusive). */
  desde: number
  /** Puesto final del rango (inclusive). */
  hasta: number
}

const STORAGE_KEY = 'cabildo-tramos'

/**
 * Catálogo de tramos por defecto: un cortejo con dos pasos (Cristo y
 * Virgen), cada uno con sus tramos, más la banda de música entre ambos.
 * Los números de puesto van del 1 (cabeza del cortejo) hacia arriba: un
 * puesto 1000 queda más lejos del primer paso que uno 100.
 */
const TRAMOS_POR_DEFECTO: Tramo[] = [
  { id: 't1', nombre: 'Cristo — Cruz de guía', desde: 1, hasta: 20 },
  { id: 't2', nombre: 'Cristo — Insignias', desde: 21, hasta: 60 },
  { id: 't3', nombre: 'Cristo — Cirio 1º tramo', desde: 61, hasta: 220 },
  { id: 't4', nombre: 'Cristo — Cirio 2º tramo', desde: 221, hasta: 380 },
  { id: 't5', nombre: 'Música', desde: 381, hasta: 410 },
  { id: 't6', nombre: 'Virgen — Cirio 1º tramo', desde: 411, hasta: 570 },
  { id: 't7', nombre: 'Virgen — Cirio 2º tramo', desde: 571, hasta: 730 },
  { id: 't8', nombre: 'Virgen — Presidencia', desde: 731, hasta: 750 },
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

/** Devuelve el tramo al que pertenece un puesto, o null si ninguno lo cubre. */
export function tramoDePuesto(puesto: number, tramos: Tramo[]): Tramo | null {
  return tramos.find((t) => puesto >= t.desde && puesto <= t.hasta) ?? null
}

/** Pares de tramos cuyos rangos se solapan, para avisar al editarlos. */
export function solapes(tramos: Tramo[]): Array<[Tramo, Tramo]> {
  const pares: Array<[Tramo, Tramo]> = []
  for (let i = 0; i < tramos.length; i++) {
    for (let j = i + 1; j < tramos.length; j++) {
      const a = tramos[i]
      const b = tramos[j]
      if (a.desde <= b.hasta && b.desde <= a.hasta) pares.push([a, b])
    }
  }
  return pares
}
