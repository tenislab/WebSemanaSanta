export type EstadoPapeleta = 'Solicitada' | 'Asignada' | 'Pagada' | 'Entregada' | 'Anulada'

export interface Papeleta {
  id: string
  numero: number
  hermanoId: string
  /** Tramo elegido para el cortejo (cruz de guía, vara, cirio…); el puesto dentro de él se calcula solo por número de hermano. */
  tramoId: string | null
  importe: number
  estado: EstadoPapeleta
  fechaSolicitud: string
  fechaEntrega?: string
}

export const IMPORTE_PAPELETA = 18

/**
 * Papeletas de ejemplo, emitidas a hermanos del censo (ver data/hermanos.ts).
 * Los id de tramoId corresponden al catálogo por defecto de lib/tramos.ts
 * (t1 Cruz de guía, t2 Insignias, t3/t4 Cirio Cristo, t5 Música, t6/t7 Cirio
 * Virgen, t8 Presidencia). Cuatro hermanos (h1, h13, h14, h15) eligen el
 * mismo tramo «Cruz de guía» (aforo 3), para poder mostrar un caso real de
 * "Excede aforo" en Cortejo.
 */
export const PAPELETAS_INICIALES: Papeleta[] = [
  { id: 'p1', numero: 412, hermanoId: 'h2', tramoId: 't3', importe: 18, estado: 'Entregada', fechaSolicitud: '20 ene 2026', fechaEntrega: '10 feb 2026' },
  { id: 'p2', numero: 413, hermanoId: 'h3', tramoId: 't2', importe: 18, estado: 'Pagada', fechaSolicitud: '20 ene 2026' },
  { id: 'p3', numero: 414, hermanoId: 'h1', tramoId: 't1', importe: 22, estado: 'Entregada', fechaSolicitud: '18 ene 2026', fechaEntrega: '08 feb 2026' },
  { id: 'p4', numero: 415, hermanoId: 'h4', tramoId: 't4', importe: 18, estado: 'Asignada', fechaSolicitud: '22 ene 2026' },
  { id: 'p5', numero: 416, hermanoId: 'h5', tramoId: 't5', importe: 15, estado: 'Pagada', fechaSolicitud: '19 ene 2026' },
  { id: 'p6', numero: 417, hermanoId: 'h8', tramoId: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '02 feb 2026' },
  { id: 'p7', numero: 418, hermanoId: 'h9', tramoId: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '03 feb 2026' },
  { id: 'p8', numero: 419, hermanoId: 'h10', tramoId: 't6', importe: 18, estado: 'Anulada', fechaSolicitud: '15 ene 2026' },
  { id: 'p9', numero: 420, hermanoId: 'h12', tramoId: 't6', importe: 18, estado: 'Pagada', fechaSolicitud: '21 ene 2026' },
  { id: 'p10', numero: 421, hermanoId: 'h7', tramoId: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '04 feb 2026' },
  { id: 'p11', numero: 422, hermanoId: 'h13', tramoId: 't1', importe: 22, estado: 'Asignada', fechaSolicitud: '05 feb 2026' },
  { id: 'p12', numero: 423, hermanoId: 'h14', tramoId: 't1', importe: 22, estado: 'Asignada', fechaSolicitud: '05 feb 2026' },
  { id: 'p13', numero: 424, hermanoId: 'h15', tramoId: 't1', importe: 22, estado: 'Asignada', fechaSolicitud: '06 feb 2026' },
]
