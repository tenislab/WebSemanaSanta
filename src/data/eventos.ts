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
  /**
   * A quién le toca: un hermano del censo o alguien del personal con acceso al
   * panel. Null si nadie la ha cogido aún.
   */
  trabajadorId: string | null
  /**
   * De dónde sale ese id. Sin esto no se sabe dónde buscar el nombre.
   * `rol` son los cargos y los grupos («Secretaría», «Costaleros»): la tarea
   * es de quien tenga ese papel, no de una persona concreta.
   */
  trabajadorTipo?: 'hermano' | 'personal' | 'rol'
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
  /** Cada cuánto vuelve. Los eventos de antes no lo traen: no se repiten. */
  repeticion?: Repeticion
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

/**
 * Cada cuánto se repite un evento. Las hermandades tienen mucho acto que
 * vuelve: la misa de hermandad de cada mes, el ensayo de costaleros de cada
 * semana, el aniversario fundacional de cada año… Antes había que crearlos uno
 * a uno.
 */
export type TipoRepeticion = 'no' | 'diaria' | 'semanal' | 'mensual' | 'anual'

export const REPETICIONES: { id: TipoRepeticion; nombre: string; nota: string }[] = [
  { id: 'no', nombre: 'No se repite', nota: 'Una sola vez.' },
  { id: 'diaria', nombre: 'Cada día', nota: 'Para triduos, quinarios y novenas.' },
  { id: 'semanal', nombre: 'Cada semana', nota: 'Ensayos, reparto de alimentos…' },
  { id: 'mensual', nombre: 'Cada mes', nota: 'La misa de hermandad, el mismo día de cada mes.' },
  { id: 'anual', nombre: 'Cada año', nota: 'Aniversarios y cultos de siempre.' },
]

export interface Repeticion {
  tipo: TipoRepeticion
  /**
   * Hasta cuándo se repite (ISO yyyy-mm-dd). Vacío = para siempre. «Siempre»
   * no significa infinito de verdad: el calendario solo pinta lo que se ve.
   */
  hasta: string
  /** Cada cuántos días/semanas/meses/años. 1 = todos. */
  cada: number
}

export const SIN_REPETICION: Repeticion = { tipo: 'no', hasta: '', cada: 1 }

/** Una aparición concreta de un evento en el calendario. */
export interface Aparicion {
  evento: Evento
  /** La fecha de ESTA aparición (la del evento base, o una repetición). */
  fecha: string
  /** Cuántas veces se ha repetido ya (0 = la original). */
  vuelta: number
}

function aFecha(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function aIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Todas las apariciones de un evento entre dos fechas. Se calcula al vuelo: no
 * se guardan cientos de copias en la base por un ensayo semanal.
 *
 * Tope de seguridad de 400 apariciones: un evento diario «para siempre»
 * consultado a diez años vista colgaría el navegador.
 */
export function aparicionesEntre(evento: Evento, desde: string, hasta: string, tope = 400): Aparicion[] {
  const inicio = aFecha(evento.fecha)
  const dDesde = aFecha(desde)
  const dHasta = aFecha(hasta)
  if (!inicio || !dDesde || !dHasta) return []

  const rep = evento.repeticion ?? SIN_REPETICION
  if (rep.tipo === 'no') {
    return evento.fecha >= desde && evento.fecha <= hasta
      ? [{ evento, fecha: evento.fecha, vuelta: 0 }]
      : []
  }

  const finRepeticion = rep.hasta ? aFecha(rep.hasta) : null
  const cada = Math.max(1, rep.cada || 1)
  const salida: Aparicion[] = []
  const cursor = new Date(inicio)
  let vuelta = 0

  while (vuelta < tope) {
    if (finRepeticion && cursor > finRepeticion) break
    if (cursor > dHasta) break
    if (cursor >= dDesde) salida.push({ evento, fecha: aIso(cursor), vuelta })

    vuelta += 1
    if (rep.tipo === 'diaria') cursor.setDate(cursor.getDate() + cada)
    else if (rep.tipo === 'semanal') cursor.setDate(cursor.getDate() + 7 * cada)
    else if (rep.tipo === 'mensual') cursor.setMonth(cursor.getMonth() + cada)
    else cursor.setFullYear(cursor.getFullYear() + cada)
  }
  return salida
}

/** Lo mismo, para una lista de eventos, ya ordenado por fecha. */
export function calendarioEntre(eventos: Evento[], desde: string, hasta: string): Aparicion[] {
  return eventos
    .flatMap((e) => aparicionesEntre(e, desde, hasta))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.evento.hora ?? '').localeCompare(b.evento.hora ?? ''))
}

/** Cómo se lee la repetición de un evento, para enseñarlo en la ficha. */
export function textoRepeticion(rep: Repeticion | undefined): string {
  if (!rep || rep.tipo === 'no') return ''
  const cada = Math.max(1, rep.cada || 1)
  const unidad = { diaria: 'día', semanal: 'semana', mensual: 'mes', anual: 'año' }[rep.tipo]
  const plural = { diaria: 'días', semanal: 'semanas', mensual: 'meses', anual: 'años' }[rep.tipo]
  const frecuencia = cada === 1 ? `cada ${unidad}` : `cada ${cada} ${plural}`
  if (!rep.hasta) return `Se repite ${frecuencia}, sin fecha de fin`
  const d = aFecha(rep.hasta)
  const fin = d ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : rep.hasta
  return `Se repite ${frecuencia} hasta el ${fin}`
}
