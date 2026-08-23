export type CategoriaDocumento = 'Acta' | 'Regla' | 'Contrato' | 'Boletín' | 'Expediente' | 'Archivo histórico'

export type Cargo =
  | 'Hermano Mayor'
  | 'Secretario/a'
  | 'Tesorero/a'
  | 'Fiscal'
  | 'Mayordomo/Prioste'
  | 'Diputado/a Mayor de Gobierno'
  | 'Vocal'
  | 'Hermano de a pie'

export type TipoCabildo = 'General' | 'Extraordinario' | 'De Oficiales'
export type EstadoExpediente = 'Abierto' | 'Cerrado'

export interface Documento {
  id: string
  numero: number
  nombre: string
  categoria: CategoriaDocumento
  /** Fecha propia del documento (de celebración, firma o publicación, según la categoría), en ISO. */
  fecha: string
  /** Fecha de incorporación al archivo, en ISO; se autogenera al crear, no es editable. */
  fechaAlta: string
  descripcion: string
  archivadoPor: string | null
  /** null = visible para cualquier hermano autenticado; con cargos = restringido a quien ostente alguno de ellos. */
  cargosConAcceso: Cargo[] | null
  tipoCabildo: TipoCabildo | null
  proveedor: string | null
  vigenciaHasta: string | null
  estadoExpediente: EstadoExpediente | null
  /** Nombre del archivo adjunto (PDF, imagen…), o null si no tiene. El archivo en sí vive en IndexedDB (lib/filestore.ts). */
  archivoNombre: string | null
  archivoTipo: string | null
  archivoTamano: number | null
}

export const CATEGORIAS_DOCUMENTO: CategoriaDocumento[] = ['Acta', 'Regla', 'Contrato', 'Boletín', 'Expediente', 'Archivo histórico']

export const CARGOS: Cargo[] = [
  'Hermano Mayor',
  'Secretario/a',
  'Tesorero/a',
  'Fiscal',
  'Mayordomo/Prioste',
  'Diputado/a Mayor de Gobierno',
  'Vocal',
  'Hermano de a pie',
]

/**
 * Documentos de ejemplo del archivo, mientras conectamos la base de datos.
 * Casos sembrados a propósito: un contrato ya vencido (cera) y otro a punto
 * de vencer (banda de música), para probar la pill de vigencia; un
 * expediente disciplinario restringido incluso para el Hermano Mayor (solo
 * Secretaría y Fiscalía) — el control de acceso no tiene ninguna excepción
 * oculta por cargo, así que si un cargo no está en la lista, no lo ve nadie
 * que simule ese cargo, ni siquiera el Hermano Mayor; y una Regla y un
 * Boletín sin restricción, por ser documentos institucionales de acceso
 * amplio.
 */
export const DOCUMENTOS_INICIALES: Documento[] = [
  {
    id: 'd1', numero: 1, nombre: 'Acta de Cabildo General de Cuentas 2026',
    categoria: 'Acta', fecha: '2026-01-18', fechaAlta: '2026-01-20',
    descripcion: 'Aprobación de cuentas del ejercicio anterior y presupuesto del ejercicio en curso.',
    archivadoPor: 'Ana Sánchez del Río', cargosConAcceso: null,
    tipoCabildo: 'General', proveedor: null, vigenciaHasta: null, estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd2', numero: 2, nombre: 'Acta de Cabildo de Oficiales sobre presupuesto de cultos',
    categoria: 'Acta', fecha: '2026-02-03', fechaAlta: '2026-02-04',
    descripcion: 'Reparto de partidas de gasto entre priostía, música y caridad para la Cuaresma.',
    archivadoPor: 'Secretaría', cargosConAcceso: ['Hermano Mayor', 'Secretario/a', 'Tesorero/a', 'Fiscal', 'Mayordomo/Prioste', 'Diputado/a Mayor de Gobierno'],
    tipoCabildo: 'De Oficiales', proveedor: null, vigenciaHasta: null, estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd3', numero: 3, nombre: 'Acta de Cabildo Extraordinario de reforma de Reglas',
    categoria: 'Acta', fecha: '2025-11-20', fechaAlta: '2025-11-22',
    descripcion: 'Reforma del artículo sobre el régimen de altas y bajas de hermanos, pendiente de aprobación arzobispal.',
    archivadoPor: 'Ana Sánchez del Río', cargosConAcceso: null,
    tipoCabildo: 'Extraordinario', proveedor: null, vigenciaHasta: null, estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd4', numero: 4, nombre: 'Reglas y Estatutos (texto vigente)',
    categoria: 'Regla', fecha: '2019-05-10', fechaAlta: '2025-09-01',
    descripcion: 'Texto refundido tras la última reforma aprobada por el Arzobispado.',
    archivadoPor: 'Secretaría', cargosConAcceso: null,
    tipoCabildo: null, proveedor: null, vigenciaHasta: null, estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd5', numero: 5, nombre: 'Reglamento de Régimen Interno',
    categoria: 'Regla', fecha: '2021-03-15', fechaAlta: '2025-09-01',
    descripcion: 'Desarrolla las funciones de cada cargo de la Junta de Gobierno y el régimen disciplinario.',
    archivadoPor: 'Secretaría', cargosConAcceso: null,
    tipoCabildo: null, proveedor: null, vigenciaHasta: null, estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd6', numero: 6, nombre: 'Contrato con banda de música para la estación de penitencia',
    categoria: 'Contrato', fecha: '2025-09-01', fechaAlta: '2025-09-03',
    descripcion: 'Contratación de la banda para acompañar el paso de palio.',
    archivadoPor: 'Juan Luis Cabrera', cargosConAcceso: ['Hermano Mayor', 'Tesorero/a', 'Fiscal'],
    tipoCabildo: null, proveedor: 'Banda de Música Ntra. Sra. del Carmen', vigenciaHasta: '2026-08-15', estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd7', numero: 7, nombre: 'Póliza de responsabilidad civil',
    categoria: 'Contrato', fecha: '2026-01-05', fechaAlta: '2026-01-06',
    descripcion: 'Cobertura de responsabilidad civil de la hermandad y de los costaleros.',
    archivadoPor: 'Juan Luis Cabrera', cargosConAcceso: ['Hermano Mayor', 'Tesorero/a'],
    tipoCabildo: null, proveedor: 'Mapfre Seguros', vigenciaHasta: '2026-12-31', estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd8', numero: 8, nombre: 'Contrato de suministro de cera',
    categoria: 'Contrato', fecha: '2025-05-20', fechaAlta: '2025-05-22',
    descripcion: 'Suministro anual de cirios y velas para cultos y estación de penitencia.',
    archivadoPor: 'Francisco Gómez Nieto', cargosConAcceso: ['Tesorero/a', 'Mayordomo/Prioste'],
    tipoCabildo: null, proveedor: 'Cerería La Giralda', vigenciaHasta: '2026-06-01', estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd9', numero: 9, nombre: 'Contrato de alquiler de sillas para la carrera oficial',
    categoria: 'Contrato', fecha: '2026-06-25', fechaAlta: '2026-07-08',
    descripcion: 'Alquiler de sillas de palco para hermanos e invitados durante la estación de penitencia.',
    archivadoPor: 'Francisco Gómez Nieto', cargosConAcceso: ['Tesorero/a'],
    tipoCabildo: null, proveedor: 'Sillas Hermandad Sevilla', vigenciaHasta: '2027-01-31', estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd10', numero: 10, nombre: 'Boletín de Cuaresma 2026',
    categoria: 'Boletín', fecha: '2026-02-01', fechaAlta: '2026-02-02',
    descripcion: 'Saludo del Hermano Mayor, memoria de actividades del año y avance de cultos.',
    archivadoPor: 'María Reyes Ortega', cargosConAcceso: null,
    tipoCabildo: null, proveedor: null, vigenciaHasta: null, estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd11', numero: 11, nombre: 'Boletín de Cuaresma 2025',
    categoria: 'Boletín', fecha: '2025-02-01', fechaAlta: '2025-02-03',
    descripcion: 'Edición del año anterior.',
    archivadoPor: 'María Reyes Ortega', cargosConAcceso: null,
    tipoCabildo: null, proveedor: null, vigenciaHasta: null, estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd12', numero: 12, nombre: 'Expediente de restauración del Senatus',
    categoria: 'Expediente', fecha: '2026-03-10', fechaAlta: '2026-07-02',
    descripcion: 'Memoria técnica y presupuesto para restaurar el asta del Senatus, con grietas visibles.',
    archivadoPor: 'Pedro Molina Aguilar', cargosConAcceso: ['Hermano Mayor', 'Mayordomo/Prioste'],
    tipoCabildo: null, proveedor: null, vigenciaHasta: null, estadoExpediente: 'Abierto', archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd13', numero: 13, nombre: 'Expediente disciplinario nº 3/2026',
    categoria: 'Expediente', fecha: '2026-04-22', fechaAlta: '2026-07-05',
    descripcion: 'Instrucción por incumplimiento reiterado de la normativa de hábito el día de la estación de penitencia.',
    archivadoPor: 'Secretaría', cargosConAcceso: ['Secretario/a', 'Fiscal'],
    tipoCabildo: null, proveedor: null, vigenciaHasta: null, estadoExpediente: 'Abierto', archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd14', numero: 14, nombre: 'Expediente de renovación de Junta de Gobierno ante el Arzobispado',
    categoria: 'Expediente', fecha: '2025-06-14', fechaAlta: '2025-06-20',
    descripcion: 'Comunicación de la nueva composición de la Junta de Gobierno y decreto de toma de razón.',
    archivadoPor: 'Ana Sánchez del Río', cargosConAcceso: ['Hermano Mayor', 'Secretario/a'],
    tipoCabildo: null, proveedor: null, vigenciaHasta: null, estadoExpediente: 'Cerrado', archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd15', numero: 15, nombre: 'Acta fundacional de la hermandad (1952)',
    categoria: 'Archivo histórico', fecha: '1952-04-12', fechaAlta: '2025-10-01',
    descripcion: 'Documento fundacional, digitalizado recientemente para su conservación.',
    archivadoPor: 'Secretaría', cargosConAcceso: null,
    tipoCabildo: null, proveedor: null, vigenciaHasta: null, estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
  {
    id: 'd16', numero: 16, nombre: 'Fotografías de la salida procesional de 1975',
    categoria: 'Archivo histórico', fecha: '1975-04-03', fechaAlta: '2025-10-05',
    descripcion: 'Reportaje fotográfico donado por la familia de un hermano fallecido.',
    archivadoPor: 'Secretaría', cargosConAcceso: null,
    tipoCabildo: null, proveedor: null, vigenciaHasta: null, estadoExpediente: null, archivoNombre: null, archivoTipo: null, archivoTamano: null,
  },
]
