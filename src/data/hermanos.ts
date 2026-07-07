export type EstadoHermano = 'Activo' | 'Nuevo' | 'Baja'

export interface Hermano {
  id: string
  numero: number
  nombre: string
  estado: EstadoHermano
  antiguedad: number
  email: string
  telefono: string
  direccion: string
  tramo: string
  cuotaAlDia: boolean
}

/**
 * Censo de ejemplo. Lo comparten el módulo de Hermanos y el de Cuotas
 * (cada recibo se emite a nombre de uno de estos hermanos), para que los
 * datos no diverjan entre pantallas mientras no hay base de datos real.
 */
export const HERMANOS_INICIALES: Hermano[] = [
  { id: 'h1', numero: 89, nombre: 'Ana Sánchez del Río', estado: 'Activo', antiguedad: 1991, email: 'ana.sanchez@example.com', telefono: '622 104 558', direccion: 'C/ Alfarería, 12', tramo: 'Cruz de guía', cuotaAlDia: true },
  { id: 'h2', numero: 214, nombre: 'María Reyes Ortega', estado: 'Activo', antiguedad: 1998, email: 'maria.reyes@example.com', telefono: '655 302 119', direccion: 'C/ Feria, 44', tramo: 'Cirio 3º tramo', cuotaAlDia: true },
  { id: 'h3', numero: 340, nombre: 'Juan Luis Cabrera', estado: 'Activo', antiguedad: 2004, email: 'juanluis.cabrera@example.com', telefono: '611 887 220', direccion: 'Avda. de la Palmera, 8', tramo: 'Insignias', cuotaAlDia: false },
  { id: 'h4', numero: 501, nombre: 'Francisco Gómez Nieto', estado: 'Activo', antiguedad: 2012, email: 'fran.gomez@example.com', telefono: '699 445 011', direccion: 'C/ Betis, 21', tramo: 'Cirio 7º tramo', cuotaAlDia: false },
  { id: 'h5', numero: 612, nombre: 'Carmen Pérez Luna', estado: 'Activo', antiguedad: 2016, email: 'carmen.perez@example.com', telefono: '633 210 774', direccion: 'C/ Sierpes, 3', tramo: 'Música', cuotaAlDia: true },
  { id: 'h6', numero: 58, nombre: 'Antonio Vega Morales', estado: 'Baja', antiguedad: 1985, email: 'antonio.vega@example.com', telefono: '600 112 334', direccion: 'C/ San Jacinto, 15', tramo: 'Sin asignar', cuotaAlDia: false },
  { id: 'h7', numero: 733, nombre: 'Isabel Ramírez Cortés', estado: 'Nuevo', antiguedad: 2026, email: 'isabel.ramirez@example.com', telefono: '644 908 213', direccion: 'C/ Pureza, 30', tramo: 'Sin asignar', cuotaAlDia: true },
  { id: 'h8', numero: 178, nombre: 'Manuel Jiménez Ruiz', estado: 'Activo', antiguedad: 1996, email: 'manuel.jimenez@example.com', telefono: '677 554 902', direccion: 'C/ Castilla, 61', tramo: 'Cruz de guía', cuotaAlDia: true },
  { id: 'h9', numero: 425, nombre: 'Lucía Fernández Soto', estado: 'Activo', antiguedad: 2007, email: 'lucia.fernandez@example.com', telefono: '688 337 145', direccion: 'C/ Rodrigo de Triana, 9', tramo: 'Cirio 3º tramo', cuotaAlDia: true },
  { id: 'h10', numero: 690, nombre: 'Pedro Molina Aguilar', estado: 'Activo', antiguedad: 2014, email: 'pedro.molina@example.com', telefono: '612 776 480', direccion: 'C/ Evangelista, 18', tramo: 'Insignias', cuotaAlDia: false },
  { id: 'h11', numero: 731, nombre: 'Rocío Domínguez Vargas', estado: 'Nuevo', antiguedad: 2026, email: 'rocio.dominguez@example.com', telefono: '691 220 667', direccion: 'C/ Pagés del Corro, 55', tramo: 'Sin asignar', cuotaAlDia: true },
  { id: 'h12', numero: 302, nombre: 'José Antonio Reina', estado: 'Activo', antiguedad: 2001, email: 'joseantonio.reina@example.com', telefono: '666 803 512', direccion: 'C/ Dos de Mayo, 7', tramo: 'Cirio 7º tramo', cuotaAlDia: true },
]

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}
