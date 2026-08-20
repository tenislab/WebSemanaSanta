import type { Hermano } from '../data/hermanos'
import { metodoDeCuota, type Cuota } from '../data/cuotas'
import { formatCurrency } from './format'
import { guardarConAviso } from './persistencia'
import type { CampoModelo, ModeloPapeleta } from './modeloPapeleta'
import { guardarPlantilla, traerPlantilla } from './plantillasHermandad'

/**
 * Modelo de recibo personalizado para las cuotas: la hermandad sube la imagen
 * de su modelo de recibo y coloca encima los datos (nº de recibo, hermano,
 * importe, método, fechas…). Reutiliza la misma estructura y editor que el
 * modelo de papeleta (ver lib/modeloPapeleta.ts), solo cambian los datos
 * disponibles, el resolutor y la clave de almacenamiento.
 */

export const CLAVES_DATO_RECIBO: { clave: string; etiqueta: string; ejemplo: string }[] = [
  { clave: 'numeroRecibo', etiqueta: 'Nº de recibo', ejemplo: '0042' },
  { clave: 'nombre', etiqueta: 'Nombre del hermano', ejemplo: 'María López García' },
  { clave: 'numeroHermano', etiqueta: 'Nº de hermano', ejemplo: '128' },
  { clave: 'dni', etiqueta: 'DNI / NIE', ejemplo: '12345678A' },
  { clave: 'concepto', etiqueta: 'Concepto', ejemplo: 'Cuota anual' },
  { clave: 'importe', etiqueta: 'Importe', ejemplo: '60,00 €' },
  { clave: 'estado', etiqueta: 'Estado', ejemplo: 'Pagada' },
  { clave: 'metodo', etiqueta: 'Método de cobro', ejemplo: 'Domiciliación' },
  { clave: 'fechaEmision', etiqueta: 'Fecha de emisión', ejemplo: '03 feb 2026' },
  { clave: 'fechaCobro', etiqueta: 'Fecha de cobro', ejemplo: '18 feb 2026' },
  { clave: 'fechaPago', etiqueta: 'Fecha de pago', ejemplo: '05 feb 2026' },
  { clave: 'hermandad', etiqueta: 'Nombre de la hermandad', ejemplo: 'Hermandad de la Vera-Cruz' },
  { clave: 'textoFijo', etiqueta: 'Texto fijo (etiqueta)', ejemplo: 'Recibí:' },
]

const CLAVE_STORAGE = 'cabildo-modelo-recibo'

export function getModeloRecibo(): ModeloPapeleta | null {
  try {
    const raw = localStorage.getItem(CLAVE_STORAGE)
    if (!raw) return null
    const m = JSON.parse(raw) as ModeloPapeleta
    if (m && typeof m.imagenDataUrl === 'string' && Array.isArray(m.campos)) return m
  } catch {
    // modelo corrupto: se ignora
  }
  return null
}

export function saveModeloRecibo(modelo: ModeloPapeleta) {
  guardarConAviso(CLAVE_STORAGE, modelo)
  void guardarPlantilla('modelo_recibo', modelo)
}

/** Trae el modelo de recibo de la hermandad y lo deja en la copia local. */
export async function cargarModeloReciboDeLaBase(): Promise<ModeloPapeleta | null> {
  const m = await traerPlantilla<ModeloPapeleta>('modelo_recibo')
  if (m && typeof m.imagenDataUrl === 'string' && Array.isArray(m.campos)) {
    guardarConAviso(CLAVE_STORAGE, m)
    return m
  }
  return null
}

export function borrarModeloRecibo() {
  localStorage.removeItem(CLAVE_STORAGE)
  void guardarPlantilla('modelo_recibo', null)
}

export interface DatosRecibo {
  cuota: Cuota
  hermano: Hermano
  hermandadNombre?: string
}

/** Texto de un campo del modelo de recibo con datos reales. */
export function valorDeCampoRecibo(campo: CampoModelo, datos: DatosRecibo): string {
  const { cuota, hermano } = datos
  switch (campo.clave) {
    case 'numeroRecibo':
      return String(cuota.numero).padStart(4, '0')
    case 'nombre':
      return hermano.nombre
    case 'numeroHermano':
      return String(hermano.numero)
    case 'dni':
      return hermano.dni || ''
    case 'concepto':
      return cuota.concepto
    case 'importe':
      return formatCurrency(cuota.importe)
    case 'estado':
      return cuota.estado
    case 'metodo':
      return metodoDeCuota(cuota)
    case 'fechaEmision':
      return cuota.fechaEmision
    case 'fechaCobro':
      return cuota.fechaCobro
    case 'fechaPago':
      return cuota.fechaPago ?? ''
    case 'hermandad':
      return datos.hermandadNombre || ''
    case 'textoFijo':
      return campo.texto ?? ''
    default:
      return ''
  }
}
