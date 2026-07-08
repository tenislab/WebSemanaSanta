import type { Papeleta } from '../data/papeletas'

/**
 * Una campaña de papeletas de sitio corresponde a la estación de penitencia
 * de un año. Cada año se abre una campaña nueva: quien tuvo sitio el año
 * anterior puede renovarlo hasta la fecha límite; pasado ese día, quien no
 * renovó pierde su sitio y queda libre para otros.
 */
export interface Campana {
  anio: number
  /** Fecha límite para renovar el sitio del año anterior (ISO yyyy-mm-dd). */
  fechaLimiteRenovacion: string
  /** Día de la estación de penitencia de esta edición (ISO), informativo. */
  fechaSalida: string | null
}

const STORAGE_KEY = 'cabildo-campana'

const CAMPANA_POR_DEFECTO: Campana = {
  anio: 2027,
  fechaLimiteRenovacion: '2027-02-28',
  fechaSalida: '2027-03-28',
}

export function getCampana(): Campana {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...CAMPANA_POR_DEFECTO, ...(JSON.parse(raw) as Partial<Campana>) }
  } catch {
    // localStorage no disponible o datos corruptos: usamos los valores por defecto
  }
  return CAMPANA_POR_DEFECTO
}

export function saveCampana(campana: Campana) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(campana))
}

/** Días que faltan hasta una fecha ISO (negativo si ya pasó), normalizado a medianoche. */
export function diasHasta(iso: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - hoy.getTime()) / 86_400_000)
}

/** ¿Sigue abierta la ventana de renovación? */
export function ventanaAbierta(campana: Campana): boolean {
  return diasHasta(campana.fechaLimiteRenovacion) >= 0
}

export type EstadoRenovacion =
  | 'Renovada'
  | 'Nueva'
  | 'Por renovar'
  | 'No renovada'
  | 'Sin papeleta'

export interface RenovacionHermano {
  estado: EstadoRenovacion
  /** Papeleta con puesto del año anterior (el «sitio guardado»), o null. */
  sitioAnterior: Papeleta | null
  /** Papeleta del año de la campaña activa (no anulada), o null. */
  papeletaActual: Papeleta | null
}

/**
 * Estado de renovación de un hermano en la campaña activa, derivado de sus
 * papeletas (nada se guarda: se recalcula). «Renuncia» y el fin de la ventana
 * de renovación producen ambos el estado «No renovada» (pierde el sitio).
 */
export function renovacionDeHermano(
  hermanoId: string,
  papeletas: Papeleta[],
  campana: Campana,
): RenovacionHermano {
  const sitioAnterior =
    papeletas.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio - 1 && p.tramoId !== null) ?? null
  const papeletaActual =
    papeletas.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada') ?? null

  let estado: EstadoRenovacion
  if (papeletaActual?.estado === 'Renuncia') {
    estado = 'No renovada'
  } else if (papeletaActual) {
    estado = sitioAnterior ? 'Renovada' : 'Nueva'
  } else if (sitioAnterior) {
    estado = ventanaAbierta(campana) ? 'Por renovar' : 'No renovada'
  } else {
    estado = 'Sin papeleta'
  }

  return { estado, sitioAnterior, papeletaActual }
}
