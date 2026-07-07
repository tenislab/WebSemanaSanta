export type EstadoPapeleta = 'Solicitada' | 'Asignada' | 'Pagada' | 'Entregada' | 'Anulada'

export interface Papeleta {
  id: string
  numero: number
  hermanoId: string
  /** Puesto (número de posición) asignado dentro del cortejo; determina el tramo. */
  puesto: number | null
  /** Nombre del tramo al que pertenece `puesto`, resuelto contra el catálogo de tramos. */
  tramo: string | null
  importe: number
  estado: EstadoPapeleta
  fechaSolicitud: string
  fechaEntrega?: string
  /** Registro de por qué se saltó el orden de antigüedad al asignar, si aplica. */
  overrideAntiguedad?: { motivo: string; registradoPor: string; fecha: string } | null
}

export const IMPORTE_PAPELETA = 18

/**
 * Papeletas de ejemplo, emitidas a hermanos del censo (ver data/hermanos.ts).
 * Cuatro de ellas (p3, p11, p12, p13) comparten el tramo «Cristo — Cruz de
 * guía» (aforo 3), para poder mostrar una lista de espera real en Cortejo.
 */
export const PAPELETAS_INICIALES: Papeleta[] = [
  { id: 'p1', numero: 412, hermanoId: 'h2', puesto: 30, tramo: 'Cristo — Cirio 1º tramo', importe: 18, estado: 'Entregada', fechaSolicitud: '20 ene 2026', fechaEntrega: '10 feb 2026' },
  { id: 'p2', numero: 413, hermanoId: 'h3', puesto: 8, tramo: 'Cristo — Insignias', importe: 18, estado: 'Pagada', fechaSolicitud: '20 ene 2026' },
  { id: 'p3', numero: 414, hermanoId: 'h1', puesto: 2, tramo: 'Cristo — Cruz de guía', importe: 22, estado: 'Entregada', fechaSolicitud: '18 ene 2026', fechaEntrega: '08 feb 2026' },
  { id: 'p4', numero: 415, hermanoId: 'h4', puesto: 70, tramo: 'Cristo — Cirio 2º tramo', importe: 18, estado: 'Asignada', fechaSolicitud: '22 ene 2026' },
  { id: 'p5', numero: 416, hermanoId: 'h5', puesto: 100, tramo: 'Música', importe: 15, estado: 'Pagada', fechaSolicitud: '19 ene 2026' },
  { id: 'p6', numero: 417, hermanoId: 'h8', puesto: null, tramo: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '02 feb 2026' },
  { id: 'p7', numero: 418, hermanoId: 'h9', puesto: null, tramo: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '03 feb 2026' },
  { id: 'p8', numero: 419, hermanoId: 'h10', puesto: 130, tramo: 'Virgen — Cirio 1º tramo', importe: 18, estado: 'Anulada', fechaSolicitud: '15 ene 2026' },
  { id: 'p9', numero: 420, hermanoId: 'h12', puesto: 170, tramo: 'Virgen — Cirio 2º tramo', importe: 18, estado: 'Pagada', fechaSolicitud: '21 ene 2026' },
  { id: 'p10', numero: 421, hermanoId: 'h7', puesto: null, tramo: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '04 feb 2026' },
  { id: 'p11', numero: 422, hermanoId: 'h13', puesto: 1, tramo: 'Cristo — Cruz de guía', importe: 22, estado: 'Asignada', fechaSolicitud: '05 feb 2026' },
  { id: 'p12', numero: 423, hermanoId: 'h14', puesto: 3, tramo: 'Cristo — Cruz de guía', importe: 22, estado: 'Asignada', fechaSolicitud: '05 feb 2026' },
  { id: 'p13', numero: 424, hermanoId: 'h15', puesto: 1, tramo: 'Cristo — Cruz de guía', importe: 22, estado: 'Asignada', fechaSolicitud: '06 feb 2026' },
]
