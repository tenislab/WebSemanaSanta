export type CategoriaEnser = 'Orfebrería' | 'Textil' | 'Enser de culto' | 'Túnica' | 'Mobiliario' | 'Otro'
export type EstadoConservacion = 'Bueno' | 'Regular' | 'Necesita restauración'

export interface Enser {
  id: string
  numero: number
  nombre: string
  categoria: CategoriaEnser
  ubicacion: string
  estadoConservacion: EstadoConservacion
  /** Valor a efectos de seguro, si está asegurado; null si no lo está. */
  valorAsegurado: number | null
  prestadoA: string | null
  fechaAlta: string
  notas: string
}

export const CATEGORIAS_ENSER: CategoriaEnser[] = ['Orfebrería', 'Textil', 'Enser de culto', 'Túnica', 'Mobiliario', 'Otro']

/** Inventario de ejemplo: enseres, orfebrería y textiles de la hermandad, mientras conectamos la base de datos. */
export const ENSERES_INICIALES: Enser[] = [
  { id: 'e1', numero: 1, nombre: 'Cruz de guía de plata de ley', categoria: 'Orfebrería', ubicacion: 'Casa hermandad — Sala capitular', estadoConservacion: 'Bueno', valorAsegurado: 18000, prestadoA: null, fechaAlta: '1998', notas: 'Restaurada en 2019.' },
  { id: 'e2', numero: 2, nombre: 'Palio de la Virgen (bambalinas bordadas)', categoria: 'Textil', ubicacion: 'Camarín', estadoConservacion: 'Bueno', valorAsegurado: 42000, prestadoA: null, fechaAlta: '2004', notas: '' },
  { id: 'e3', numero: 3, nombre: 'Juego de candelabros de cola', categoria: 'Orfebrería', ubicacion: 'Casa hermandad — Almacén', estadoConservacion: 'Regular', valorAsegurado: 9500, prestadoA: null, fechaAlta: '1985', notas: 'Falta plateado en dos piezas.' },
  { id: 'e4', numero: 4, nombre: 'Túnicas de nazareno (lote de 40)', categoria: 'Túnica', ubicacion: 'Casa hermandad — Ropero', estadoConservacion: 'Bueno', valorAsegurado: 6000, prestadoA: null, fechaAlta: '2015', notas: 'Revisar cíngulos antes de la salida.' },
  { id: 'e5', numero: 5, nombre: 'Senatus romano', categoria: 'Enser de culto', ubicacion: 'Casa hermandad — Sala capitular', estadoConservacion: 'Necesita restauración', valorAsegurado: 3200, prestadoA: null, fechaAlta: '1972', notas: 'Grietas en el asta, pendiente de presupuesto.' },
  { id: 'e6', numero: 6, nombre: 'Estandarte corporativo', categoria: 'Textil', ubicacion: 'Cedido a la Agrupación de Cofradías', estadoConservacion: 'Bueno', valorAsegurado: 4100, prestadoA: 'Agrupación de Cofradías (exposición)', fechaAlta: '2010', notas: 'Devolución prevista tras la exposición.' },
  { id: 'e7', numero: 7, nombre: 'Ciriales (par)', categoria: 'Orfebrería', ubicacion: 'Casa hermandad — Sala capitular', estadoConservacion: 'Bueno', valorAsegurado: 5200, prestadoA: null, fechaAlta: '1990', notas: '' },
  { id: 'e8', numero: 8, nombre: 'Manto de la Virgen (terciopelo bordado en oro)', categoria: 'Textil', ubicacion: 'Camarín', estadoConservacion: 'Regular', valorAsegurado: 65000, prestadoA: null, fechaAlta: '1955', notas: 'Consolidar bordado antes de la próxima salida.' },
  { id: 'e9', numero: 9, nombre: 'Faroles de la cruz de guía (par)', categoria: 'Orfebrería', ubicacion: 'Casa hermandad — Almacén', estadoConservacion: 'Bueno', valorAsegurado: 2800, prestadoA: null, fechaAlta: '1998', notas: '' },
  { id: 'e10', numero: 10, nombre: 'Banco de la presidencia', categoria: 'Mobiliario', ubicacion: 'Casa hermandad — Almacén', estadoConservacion: 'Regular', valorAsegurado: null, prestadoA: null, fechaAlta: '1978', notas: 'Sin asegurar, valor tasado pendiente.' },
]
