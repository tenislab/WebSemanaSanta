/**
 * Eventos de la hermandad (cultos, cabildos, salidas, caridad…) con sus
 * TAREAS: cada tarea puede asignarse a un «trabajador» (un hermano, de la
 * junta o voluntario) y marcarse como hecha. El módulo de Eventos muestra el
 * calendario, el detalle de cada evento y las tareas pendientes por persona.
 */

export type TipoEvento = 'Culto' | 'Cabildo' | 'Salida' | 'Caridad' | 'Formación' | 'Convivencia' | 'Otro'

export const TIPOS_EVENTO: TipoEvento[] = ['Culto', 'Cabildo', 'Salida', 'Caridad', 'Formación', 'Convivencia', 'Otro']

export interface TareaEvento {
  id: string
  titulo: string
  hecha: boolean
  /** Hermano asignado (id del censo) o null si nadie la ha cogido aún. */
  trabajadorId: string | null
  /** Nombre del trabajador en el momento de asignar (por si luego cambia el censo). */
  trabajadorNombre?: string
  notas?: string
}

export interface Evento {
  id: string
  titulo: string
  tipo: TipoEvento
  /** Fecha del evento (ISO yyyy-mm-dd). */
  fecha: string
  /** Hora de inicio (HH:MM), opcional. */
  hora?: string
  lugar?: string
  descripcion?: string
  tareas: TareaEvento[]
}

/**
 * Eventos de ejemplo: agenda viva alrededor de la fecha de la demo (agosto de
 * 2026) más los grandes hitos de la campaña 2027. Deterministas, sin azar.
 */
export const EVENTOS_INICIALES: Evento[] = [
  {
    id: 'ev1',
    titulo: 'Misa de hermandad',
    tipo: 'Culto',
    fecha: '2026-08-23',
    hora: '20:00',
    lugar: 'Capilla de la hermandad',
    descripcion: 'Misa mensual por los hermanos difuntos.',
    tareas: [
      { id: 'ev1-t1', titulo: 'Preparar el altar y la cera', hecha: true, trabajadorId: 'h13', trabajadorNombre: 'Rafael Ortiz Bermejo' },
      { id: 'ev1-t2', titulo: 'Avisar al coro', hecha: false, trabajadorId: 'h9', trabajadorNombre: 'Lucía Fernández Soto' },
      { id: 'ev1-t3', titulo: 'Montar la megafonía', hecha: false, trabajadorId: null },
    ],
  },
  {
    id: 'ev2',
    titulo: 'Cabildo general ordinario',
    tipo: 'Cabildo',
    fecha: '2026-09-18',
    hora: '21:00',
    lugar: 'Casa de hermandad',
    descripcion: 'Aprobación de cuentas del ejercicio y presupuesto del siguiente.',
    tareas: [
      { id: 'ev2-t1', titulo: 'Enviar convocatoria con orden del día', hecha: true, trabajadorId: 'h2', trabajadorNombre: 'María Reyes Ortega' },
      { id: 'ev2-t2', titulo: 'Preparar memoria de cuentas', hecha: false, trabajadorId: 'h8', trabajadorNombre: 'Manuel Jiménez Ruiz' },
      { id: 'ev2-t3', titulo: 'Montar la sala y las papeletas de voto', hecha: false, trabajadorId: null },
    ],
  },
  {
    id: 'ev3',
    titulo: 'Reparto de alimentos (bolsa de caridad)',
    tipo: 'Caridad',
    fecha: '2026-09-05',
    hora: '10:00',
    lugar: 'Casa de hermandad',
    descripcion: 'Entrega mensual a las familias acogidas.',
    tareas: [
      { id: 'ev3-t1', titulo: 'Recoger los alimentos del banco', hecha: false, trabajadorId: 'h10', trabajadorNombre: 'Pedro Molina Aguilar' },
      { id: 'ev3-t2', titulo: 'Preparar los lotes', hecha: false, trabajadorId: 'h5', trabajadorNombre: 'Carmen Pérez Luna' },
      { id: 'ev3-t3', titulo: 'Turno de reparto (mañana)', hecha: false, trabajadorId: null },
    ],
  },
  {
    id: 'ev4',
    titulo: 'Triduo a Ntra. Sra.',
    tipo: 'Culto',
    fecha: '2026-10-16',
    hora: '20:30',
    lugar: 'Parroquia',
    descripcion: 'Primer día del triduo. Predica el director espiritual.',
    tareas: [
      { id: 'ev4-t1', titulo: 'Exorno floral del altar', hecha: false, trabajadorId: 'h13', trabajadorNombre: 'Rafael Ortiz Bermejo' },
      { id: 'ev4-t2', titulo: 'Turnos de acólitos', hecha: false, trabajadorId: null },
    ],
  },
  {
    id: 'ev5',
    titulo: 'Igualá de costaleros',
    tipo: 'Salida',
    fecha: '2027-01-24',
    hora: '12:00',
    lugar: 'Casa de hermandad',
    descripcion: 'Igualá y primer ensayo de la cuadrilla.',
    tareas: [
      { id: 'ev5-t1', titulo: 'Revisar el paso y las trabajaderas', hecha: false, trabajadorId: 'h13', trabajadorNombre: 'Rafael Ortiz Bermejo' },
      { id: 'ev5-t2', titulo: 'Lista de la cuadrilla', hecha: false, trabajadorId: 'h12', trabajadorNombre: 'José Antonio Reina' },
    ],
  },
  {
    id: 'ev6',
    titulo: 'Estación de penitencia',
    tipo: 'Salida',
    fecha: '2027-03-28',
    hora: '17:30',
    lugar: 'Desde la parroquia',
    descripcion: 'Día grande: salida de la cofradía. Ver Cortejo para tramos y asistencia.',
    tareas: [
      { id: 'ev6-t1', titulo: 'Montaje de pasos (semana previa)', hecha: false, trabajadorId: 'h13', trabajadorNombre: 'Rafael Ortiz Bermejo' },
      { id: 'ev6-t2', titulo: 'Reparto de túnicas', hecha: false, trabajadorId: 'h2', trabajadorNombre: 'María Reyes Ortega' },
      { id: 'ev6-t3', titulo: 'Avituallamiento de la cuadrilla', hecha: false, trabajadorId: null },
      { id: 'ev6-t4', titulo: 'Recogida y guarda de enseres', hecha: false, trabajadorId: null },
    ],
  },
]
