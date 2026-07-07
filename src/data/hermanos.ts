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
  /** Cuenta bancaria del hermano, de donde se carga la domiciliación de sus cuotas. */
  iban: string | null
}

/**
 * Censo de ejemplo. Lo comparten el módulo de Hermanos y el de Cuotas
 * (cada recibo se emite a nombre de uno de estos hermanos), para que los
 * datos no diverjan entre pantallas mientras no hay base de datos real.
 * Tres hermanos (h6, h7, h11) se dejan sin IBAN a propósito, para poder
 * mostrar qué pasa cuando no se puede domiciliar una cuota.
 */
export const HERMANOS_INICIALES: Hermano[] = [
  { id: 'h1', numero: 89, nombre: 'Ana Sánchez del Río', estado: 'Activo', antiguedad: 1991, email: 'ana.sanchez@example.com', telefono: '622 104 558', direccion: 'C/ Alfarería, 12', tramo: 'Cristo — Cruz de guía', cuotaAlDia: true, iban: 'ES47 2100 0813 6102 0012 3456' },
  { id: 'h2', numero: 214, nombre: 'María Reyes Ortega', estado: 'Activo', antiguedad: 1998, email: 'maria.reyes@example.com', telefono: '655 302 119', direccion: 'C/ Feria, 44', tramo: 'Cristo — Cirio 1º tramo', cuotaAlDia: true, iban: 'ES12 0049 1500 0512 3456 7892' },
  { id: 'h3', numero: 340, nombre: 'Juan Luis Cabrera', estado: 'Activo', antiguedad: 2004, email: 'juanluis.cabrera@example.com', telefono: '611 887 220', direccion: 'Avda. de la Palmera, 8', tramo: 'Cristo — Insignias', cuotaAlDia: false, iban: 'ES60 0182 0304 4102 0158 9001' },
  { id: 'h4', numero: 501, nombre: 'Francisco Gómez Nieto', estado: 'Activo', antiguedad: 2012, email: 'fran.gomez@example.com', telefono: '699 445 011', direccion: 'C/ Betis, 21', tramo: 'Cristo — Cirio 2º tramo', cuotaAlDia: false, iban: 'ES03 2038 5788 6360 0056 8237' },
  { id: 'h5', numero: 612, nombre: 'Carmen Pérez Luna', estado: 'Activo', antiguedad: 2016, email: 'carmen.perez@example.com', telefono: '633 210 774', direccion: 'C/ Sierpes, 3', tramo: 'Música', cuotaAlDia: true, iban: 'ES91 2100 0418 4502 0005 1332' },
  { id: 'h6', numero: 58, nombre: 'Antonio Vega Morales', estado: 'Baja', antiguedad: 1985, email: 'antonio.vega@example.com', telefono: '600 112 334', direccion: 'C/ San Jacinto, 15', tramo: 'Sin asignar', cuotaAlDia: false, iban: null },
  { id: 'h7', numero: 733, nombre: 'Isabel Ramírez Cortés', estado: 'Nuevo', antiguedad: 2026, email: 'isabel.ramirez@example.com', telefono: '644 908 213', direccion: 'C/ Pureza, 30', tramo: 'Sin asignar', cuotaAlDia: true, iban: null },
  { id: 'h8', numero: 178, nombre: 'Manuel Jiménez Ruiz', estado: 'Activo', antiguedad: 1996, email: 'manuel.jimenez@example.com', telefono: '677 554 902', direccion: 'C/ Castilla, 61', tramo: 'Cristo — Cruz de guía', cuotaAlDia: true, iban: 'ES71 0075 1234 5606 0012 3457' },
  { id: 'h9', numero: 425, nombre: 'Lucía Fernández Soto', estado: 'Activo', antiguedad: 2007, email: 'lucia.fernandez@example.com', telefono: '688 337 145', direccion: 'C/ Rodrigo de Triana, 9', tramo: 'Cristo — Cirio 1º tramo', cuotaAlDia: true, iban: 'ES27 2085 8720 2103 0012 3458' },
  { id: 'h10', numero: 690, nombre: 'Pedro Molina Aguilar', estado: 'Activo', antiguedad: 2014, email: 'pedro.molina@example.com', telefono: '612 776 480', direccion: 'C/ Evangelista, 18', tramo: 'Cristo — Insignias', cuotaAlDia: false, iban: 'ES38 2038 6109 9930 0012 3459' },
  { id: 'h11', numero: 731, nombre: 'Rocío Domínguez Vargas', estado: 'Nuevo', antiguedad: 2026, email: 'rocio.dominguez@example.com', telefono: '691 220 667', direccion: 'C/ Pagés del Corro, 55', tramo: 'Sin asignar', cuotaAlDia: true, iban: null },
  { id: 'h12', numero: 302, nombre: 'José Antonio Reina', estado: 'Activo', antiguedad: 2001, email: 'joseantonio.reina@example.com', telefono: '666 803 512', direccion: 'C/ Dos de Mayo, 7', tramo: 'Virgen — Cirio 1º tramo', cuotaAlDia: true, iban: 'ES55 0081 0345 6100 0123 4560' },
]

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}
