import type { Papeleta } from '../data/papeletas'

/**
 * Una campaña de papeletas de sitio corresponde a la estación de penitencia
 * de un año. Cada año se abre una campaña nueva: quien tuvo sitio el año
 * anterior puede renovarlo hasta la fecha límite; pasado ese día, quien no
 * renovó pierde su sitio y queda libre para otros.
 */
export interface Campana {
  anio: number
  /** Día en que se abre el plazo para los hermanos que participaron el año anterior (renovadores). */
  fechaInicioParticiparon: string
  /** Día en que se abre el plazo para los que NO participaron el año anterior (suele ser algo más tarde). */
  fechaInicioNoParticiparon: string
  /** Fecha límite (fin del plazo) para solicitar/renovar (ISO yyyy-mm-dd). */
  fechaLimiteRenovacion: string
  /** Día de la estación de penitencia de esta edición (ISO), informativo. */
  fechaSalida: string | null
}

const STORAGE_KEY = 'cabildo-campana'

// Fechas de la campaña de muestra: pensadas para que el plazo esté ABIERTO al
// abrir la demo (así se ve funcionar la solicitud del hermano). Cada hermandad
// las ajusta desde Papeletas › Ajustes de campaña. La apertura para quienes NO
// participaron el año anterior va unos días por detrás de la de renovadores.
const CAMPANA_POR_DEFECTO: Campana = {
  anio: 2027,
  fechaInicioParticiparon: '2026-06-01',
  fechaInicioNoParticiparon: '2026-06-20',
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

/** ¿Sigue abierta la ventana de renovación? (hasta la fecha límite). */
export function ventanaAbierta(campana: Campana): boolean {
  return diasHasta(campana.fechaLimiteRenovacion) >= 0
}

/**
 * ¿Puede este hermano solicitar/renovar HOY, según haya participado o no el
 * año anterior? Los que participaron pueden desde `fechaInicioParticiparon`;
 * el resto desde `fechaInicioNoParticiparon`. Ambos hasta la fecha límite.
 */
export function ventanaAbiertaPara(campana: Campana, participoElAnoAnterior: boolean): boolean {
  const inicio = participoElAnoAnterior ? campana.fechaInicioParticiparon : campana.fechaInicioNoParticiparon
  return diasHasta(inicio) <= 0 && diasHasta(campana.fechaLimiteRenovacion) >= 0
}

/**
 * ¿Participó el hermano en la campaña de ese año? Cuenta cualquier papeleta
 * emitida —de tramo o personalizada (mantilla, simbólica, aceptada online)—
 * salvo las anuladas y las renuncias. Sirve para decidir qué fecha de apertura
 * le aplica en la campaña siguiente (renovadores vs. nuevos), sin excluir a
 * quien salió con una papeleta sin sitio en el cortejo.
 */
export function participoEnCampana(hermanoId: string, papeletas: Papeleta[], anio: number): boolean {
  return papeletas.some(
    (p) => p.hermanoId === hermanoId && p.anio === anio && p.estado !== 'Anulada' && p.estado !== 'Renuncia',
  )
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
  /**
   * Su sitio del año pasado, si de verdad salió.
   *
   * EL FILTRO DE ESTADO NO SOBRA. Antes solo se miraba que hubiera papeleta
   * con tramo, sin importar cómo acabó. Así, a quien anularon la papeleta el
   * año anterior —«no llegó a pagar»— le salía este año «Por renovar», con la
   * columna «Sitio 2026» diciendo su tramo y el botón «Renovar Cristo — Cirio
   * 1º tramo». O sea: la hermandad le guardaba el sitio y la prioridad a quien
   * no salió y no pagó, delante de los que sí.
   *
   * `participoEnCampana`, aquí al lado, SÍ excluía las anuladas: las dos
   * funciones daban respuestas distintas sobre si el hermano había salido.
   * Ahora usan el mismo criterio.
   */
  const sitioAnterior =
    papeletas.find(
      (p) =>
        p.hermanoId === hermanoId &&
        p.anio === campana.anio - 1 &&
        p.tramoId !== null &&
        p.estado !== 'Anulada' &&
        p.estado !== 'Renuncia',
    ) ?? null
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
