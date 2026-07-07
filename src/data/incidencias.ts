export type TipoIncidencia = 'Ausencia' | 'Indisposición' | 'Retraso' | 'Sustitución' | 'Otra'

export interface Incidencia {
  id: string
  /** Papeleta a la que afecta; de ahí se deduce el hermano y el tramo. */
  papeletaId: string
  tipo: TipoIncidencia
  descripcion: string
  hora: string
  registradoPor: string
  hermanoSustitutoId?: string | null
  resuelta: boolean
}

/**
 * Sin incidencias de ejemplo a propósito: todavía no ha llegado el día de
 * la estación de penitencia de esta edición. Se registran en directo desde
 * el «Modo día de salida» de Cortejo.
 */
export const INCIDENCIAS_INICIALES: Incidencia[] = []
