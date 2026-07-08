export type EstadoPapeleta = 'Solicitada' | 'Asignada' | 'Pagada' | 'Entregada' | 'Anulada'

export interface Papeleta {
  id: string
  numero: number
  hermanoId: string
  /** Cuerpo del cortejo en el que sale este hermano; junto con su número de hermano determina el tramo, que se calcula solo. */
  cuerpo: 'Cristo' | 'Virgen' | 'Único' | null
  importe: number
  estado: EstadoPapeleta
  fechaSolicitud: string
  fechaEntrega?: string
}

export const IMPORTE_PAPELETA = 18

/**
 * Papeletas de ejemplo, emitidas a hermanos del censo (ver data/hermanos.ts).
 * El tramo de cada una no se guarda aquí: se calcula solo a partir del
 * cuerpo y del número de hermano de quien la porta, repartido por el aforo
 * de los tramos configurados en Configuración (ver lib/cortejo.ts).
 */
export const PAPELETAS_INICIALES: Papeleta[] = [
  { id: 'p1', numero: 412, hermanoId: 'h2', cuerpo: 'Cristo', importe: 18, estado: 'Entregada', fechaSolicitud: '20 ene 2026', fechaEntrega: '10 feb 2026' },
  { id: 'p2', numero: 413, hermanoId: 'h3', cuerpo: 'Cristo', importe: 18, estado: 'Pagada', fechaSolicitud: '20 ene 2026' },
  { id: 'p3', numero: 414, hermanoId: 'h1', cuerpo: 'Cristo', importe: 22, estado: 'Entregada', fechaSolicitud: '18 ene 2026', fechaEntrega: '08 feb 2026' },
  { id: 'p4', numero: 415, hermanoId: 'h4', cuerpo: 'Cristo', importe: 18, estado: 'Asignada', fechaSolicitud: '22 ene 2026' },
  { id: 'p5', numero: 416, hermanoId: 'h5', cuerpo: 'Único', importe: 15, estado: 'Pagada', fechaSolicitud: '19 ene 2026' },
  { id: 'p6', numero: 417, hermanoId: 'h8', cuerpo: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '02 feb 2026' },
  { id: 'p7', numero: 418, hermanoId: 'h9', cuerpo: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '03 feb 2026' },
  { id: 'p8', numero: 419, hermanoId: 'h10', cuerpo: 'Virgen', importe: 18, estado: 'Anulada', fechaSolicitud: '15 ene 2026' },
  { id: 'p9', numero: 420, hermanoId: 'h12', cuerpo: 'Virgen', importe: 18, estado: 'Pagada', fechaSolicitud: '21 ene 2026' },
  { id: 'p10', numero: 421, hermanoId: 'h7', cuerpo: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '04 feb 2026' },
  { id: 'p11', numero: 422, hermanoId: 'h13', cuerpo: 'Cristo', importe: 22, estado: 'Asignada', fechaSolicitud: '05 feb 2026' },
  { id: 'p12', numero: 423, hermanoId: 'h14', cuerpo: 'Cristo', importe: 22, estado: 'Asignada', fechaSolicitud: '05 feb 2026' },
  { id: 'p13', numero: 424, hermanoId: 'h15', cuerpo: 'Cristo', importe: 22, estado: 'Asignada', fechaSolicitud: '06 feb 2026' },
]
