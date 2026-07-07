export type EstadoPapeleta = 'Solicitada' | 'Asignada' | 'Pagada' | 'Entregada' | 'Anulada'

export interface Papeleta {
  id: string
  numero: number
  hermanoId: string
  tramo: string | null
  importe: number
  estado: EstadoPapeleta
  fechaSolicitud: string
  fechaEntrega?: string
}

/** Tramos del cortejo entre los que se reparten las papeletas. */
export const TRAMOS_DISPONIBLES = [
  'Cruz de guía',
  'Bocina',
  'Insignias',
  'Cirio 1º tramo',
  'Cirio 2º tramo',
  'Cirio 3º tramo',
  'Música',
]

export const IMPORTE_PAPELETA = 18

/** Papeletas de ejemplo, emitidas a hermanos del censo (ver data/hermanos.ts). */
export const PAPELETAS_INICIALES: Papeleta[] = [
  { id: 'p1', numero: 412, hermanoId: 'h2', tramo: 'Cirio 3º tramo', importe: 18, estado: 'Entregada', fechaSolicitud: '20 ene 2026', fechaEntrega: '10 feb 2026' },
  { id: 'p2', numero: 413, hermanoId: 'h3', tramo: 'Insignias', importe: 18, estado: 'Pagada', fechaSolicitud: '20 ene 2026' },
  { id: 'p3', numero: 414, hermanoId: 'h1', tramo: 'Cruz de guía', importe: 22, estado: 'Entregada', fechaSolicitud: '18 ene 2026', fechaEntrega: '08 feb 2026' },
  { id: 'p4', numero: 415, hermanoId: 'h4', tramo: 'Cirio 1º tramo', importe: 18, estado: 'Asignada', fechaSolicitud: '22 ene 2026' },
  { id: 'p5', numero: 416, hermanoId: 'h5', tramo: 'Música', importe: 15, estado: 'Pagada', fechaSolicitud: '19 ene 2026' },
  { id: 'p6', numero: 417, hermanoId: 'h8', tramo: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '02 feb 2026' },
  { id: 'p7', numero: 418, hermanoId: 'h9', tramo: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '03 feb 2026' },
  { id: 'p8', numero: 419, hermanoId: 'h10', tramo: 'Cirio 2º tramo', importe: 18, estado: 'Anulada', fechaSolicitud: '15 ene 2026' },
  { id: 'p9', numero: 420, hermanoId: 'h12', tramo: 'Bocina', importe: 18, estado: 'Pagada', fechaSolicitud: '21 ene 2026' },
  { id: 'p10', numero: 421, hermanoId: 'h7', tramo: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '04 feb 2026' },
]
