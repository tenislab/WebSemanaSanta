export type EstadoPapeleta = 'Solicitada' | 'Asignada' | 'Pagada' | 'Entregada' | 'Anulada' | 'Renuncia'

export interface Papeleta {
  id: string
  numero: number
  hermanoId: string
  /** Año de la edición / campaña a la que pertenece la papeleta. */
  anio: number
  /** Tramo elegido para el cortejo (cruz de guía, vara, cirio…); el puesto dentro de él se calcula solo por número de hermano. */
  tramoId: string | null
  importe: number
  estado: EstadoPapeleta
  fechaSolicitud: string
  fechaEntrega?: string
}

export const IMPORTE_PAPELETA = 18

/**
 * Papeletas de ejemplo repartidas en dos campañas para poder mostrar el ciclo
 * de renovación anual:
 *
 *  - Año anterior (2026): sitios ya entregados. Son el «sitio del año
 *    anterior» que cada hermano puede renovar.
 *  - Campaña activa (2027): algunos ya han renovado, otros están «Por
 *    renovar», uno ha renunciado y otros sacan papeleta por primera vez.
 *
 * En la campaña activa, cuatro hermanos (h1, h13, h14, h15) coinciden en el
 * tramo «Cruz de guía» (t1, aforo 3) para mostrar un caso real de "Excede
 * aforo" en el Cortejo. Ver data/hermanos.ts y lib/tramos.ts.
 */
export const PAPELETAS_INICIALES: Papeleta[] = [
  // ---- Año anterior 2026: sitios entregados (el «sitio guardado») ----
  { id: 'pa1', numero: 312, hermanoId: 'h1', anio: 2026, tramoId: 't1', importe: 22, estado: 'Entregada', fechaSolicitud: '18 ene 2026', fechaEntrega: '08 feb 2026' },
  { id: 'pa2', numero: 313, hermanoId: 'h2', anio: 2026, tramoId: 't3', importe: 18, estado: 'Entregada', fechaSolicitud: '20 ene 2026', fechaEntrega: '10 feb 2026' },
  { id: 'pa3', numero: 314, hermanoId: 'h3', anio: 2026, tramoId: 't2', importe: 18, estado: 'Entregada', fechaSolicitud: '20 ene 2026', fechaEntrega: '10 feb 2026' },
  { id: 'pa4', numero: 315, hermanoId: 'h4', anio: 2026, tramoId: 't4', importe: 18, estado: 'Entregada', fechaSolicitud: '22 ene 2026', fechaEntrega: '11 feb 2026' },
  { id: 'pa5', numero: 316, hermanoId: 'h5', anio: 2026, tramoId: 't5', importe: 15, estado: 'Entregada', fechaSolicitud: '19 ene 2026', fechaEntrega: '09 feb 2026' },
  { id: 'pa6', numero: 317, hermanoId: 'h8', anio: 2026, tramoId: 't3', importe: 18, estado: 'Entregada', fechaSolicitud: '21 ene 2026', fechaEntrega: '10 feb 2026' },
  { id: 'pa7', numero: 318, hermanoId: 'h9', anio: 2026, tramoId: 't6', importe: 18, estado: 'Entregada', fechaSolicitud: '23 ene 2026', fechaEntrega: '11 feb 2026' },
  { id: 'pa8', numero: 319, hermanoId: 'h10', anio: 2026, tramoId: 't7', importe: 18, estado: 'Entregada', fechaSolicitud: '24 ene 2026', fechaEntrega: '12 feb 2026' },
  { id: 'pa9', numero: 320, hermanoId: 'h12', anio: 2026, tramoId: 't8', importe: 18, estado: 'Entregada', fechaSolicitud: '20 ene 2026', fechaEntrega: '10 feb 2026' },
  { id: 'pa10', numero: 321, hermanoId: 'h13', anio: 2026, tramoId: 't1', importe: 22, estado: 'Entregada', fechaSolicitud: '18 ene 2026', fechaEntrega: '08 feb 2026' },

  // ---- Campaña activa 2027 ----
  // Renovaciones (tenían sitio en 2026 y lo mantienen)
  { id: 'pb1', numero: 412, hermanoId: 'h1', anio: 2027, tramoId: 't1', importe: 22, estado: 'Entregada', fechaSolicitud: '12 ene 2027', fechaEntrega: '05 feb 2027' },
  { id: 'pb2', numero: 413, hermanoId: 'h2', anio: 2027, tramoId: 't3', importe: 18, estado: 'Pagada', fechaSolicitud: '13 ene 2027' },
  { id: 'pb3', numero: 414, hermanoId: 'h3', anio: 2027, tramoId: 't2', importe: 18, estado: 'Asignada', fechaSolicitud: '14 ene 2027' },
  { id: 'pb4', numero: 415, hermanoId: 'h9', anio: 2027, tramoId: 't6', importe: 18, estado: 'Pagada', fechaSolicitud: '15 ene 2027' },
  { id: 'pb5', numero: 416, hermanoId: 'h13', anio: 2027, tramoId: 't1', importe: 22, estado: 'Asignada', fechaSolicitud: '12 ene 2027' },
  // Nuevas (sin sitio el año anterior)
  { id: 'pb6', numero: 417, hermanoId: 'h14', anio: 2027, tramoId: 't1', importe: 22, estado: 'Asignada', fechaSolicitud: '20 ene 2027' },
  { id: 'pb7', numero: 418, hermanoId: 'h15', anio: 2027, tramoId: 't1', importe: 22, estado: 'Asignada', fechaSolicitud: '21 ene 2027' },
  { id: 'pb8', numero: 419, hermanoId: 'h7', anio: 2027, tramoId: null, importe: 18, estado: 'Solicitada', fechaSolicitud: '22 ene 2027' },
  // Renuncia (tenía sitio en 2026 y decide no salir este año)
  { id: 'pb9', numero: 420, hermanoId: 'h5', anio: 2027, tramoId: null, importe: 0, estado: 'Renuncia', fechaSolicitud: '18 ene 2027' },
  // (h4, h8, h10, h12 tenían sitio en 2026 y aún no han renovado → "Por renovar")
  // (h6 está de baja y h11 es nueva sin sitio → "Sin papeleta")
]
