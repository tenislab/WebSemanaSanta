import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'
import { formatCurrency } from './format'
import { guardarConAviso } from './persistencia'
import { datosVerificacionDe, urlVerificacion } from './verificacion'

/**
 * Modelo de papeleta personalizado. La hermandad sube la imagen de SU propio
 * modelo de papeleta (una foto o un escaneo, da igual el diseño) y coloca
 * encima los datos del hermano en las posiciones que quiera. Al imprimir, cada
 * campo se rellena con los datos reales de cada hermano sobre esa imagen.
 *
 * Todo se guarda en el navegador (localStorage); no necesita base de datos.
 */

/** Datos del hermano/papeleta que se pueden colocar sobre el modelo. */
export type ClaveDato =
  | 'nombre'
  | 'numeroHermano'
  | 'dni'
  | 'antiguedad'
  | 'tramo'
  | 'puesto'
  | 'modalidad'
  | 'importe'
  | 'estado'
  | 'numeroPapeleta'
  | 'fechaSolicitud'
  | 'fechaSalida'
  | 'hermandad'
  | 'anio'
  | 'qr'
  | 'textoFijo'

export const CLAVES_DATO: { clave: ClaveDato; etiqueta: string; ejemplo: string }[] = [
  { clave: 'nombre', etiqueta: 'Nombre del hermano', ejemplo: 'María López García' },
  { clave: 'numeroHermano', etiqueta: 'Nº de hermano', ejemplo: '128' },
  { clave: 'dni', etiqueta: 'DNI / NIE', ejemplo: '12345678A' },
  { clave: 'antiguedad', etiqueta: 'Hermano desde (año)', ejemplo: '2009' },
  { clave: 'tramo', etiqueta: 'Tramo / cuerpo', ejemplo: 'Cirios · Cristo' },
  { clave: 'puesto', etiqueta: 'Puesto en el tramo', ejemplo: '14' },
  { clave: 'modalidad', etiqueta: 'Modalidad (mantilla, cirio…)', ejemplo: 'Cirio' },
  { clave: 'importe', etiqueta: 'Importe', ejemplo: '15,00 €' },
  { clave: 'estado', etiqueta: 'Estado', ejemplo: 'Pagada' },
  { clave: 'numeroPapeleta', etiqueta: 'Nº de papeleta', ejemplo: '0042' },
  { clave: 'fechaSolicitud', etiqueta: 'Fecha de solicitud', ejemplo: '10 feb 2026' },
  { clave: 'fechaSalida', etiqueta: 'Día de la estación', ejemplo: '2026-03-27' },
  { clave: 'hermandad', etiqueta: 'Nombre de la hermandad', ejemplo: 'Hermandad de la Vera-Cruz' },
  { clave: 'anio', etiqueta: 'Año de la campaña', ejemplo: '2026' },
  { clave: 'qr', etiqueta: 'Código QR (verificación)', ejemplo: 'QR' },
  { clave: 'textoFijo', etiqueta: 'Texto fijo (etiqueta)', ejemplo: 'Titular:' },
]

export interface CampoModelo {
  id: string
  /** Clave del dato a mostrar. Es `string` (no solo ClaveDato) para poder
   *  reutilizar el mismo editor con otros modelos, como el de recibo. */
  clave: string
  /** Posición del campo en porcentaje del ancho/alto de la imagen (0–100). */
  xPct: number
  yPct: number
  /** Tamaño de letra en % del ancho de la imagen, para que escale igual en pantalla y al imprimir. */
  tamanoPct: number
  negrita: boolean
  color: string
  align: 'left' | 'center' | 'right'
  /** Solo para el campo "textoFijo": el texto literal a mostrar. */
  texto?: string
}

export interface ModeloPapeleta {
  /** Imagen del modelo en base64 (data URL). */
  imagenDataUrl: string
  campos: CampoModelo[]
}

const CLAVE_STORAGE = 'cabildo-modelo-papeleta'

export function getModeloPapeleta(): ModeloPapeleta | null {
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

export function saveModeloPapeleta(modelo: ModeloPapeleta) {
  guardarConAviso(CLAVE_STORAGE, modelo)
}

export function borrarModeloPapeleta() {
  localStorage.removeItem(CLAVE_STORAGE)
}

/** Contexto para resolver los valores de cada campo con datos reales. */
export interface DatosModelo {
  hermano: Hermano
  papeleta?: Papeleta | null
  tramoEtiqueta?: string | null
  puesto?: number | null
  hermandadNombre?: string
  fechaSalida?: string | null
}

/** Devuelve el texto que corresponde a un campo del modelo, con datos reales. */
export function valorDeCampo(campo: CampoModelo, datos: DatosModelo): string {
  const { hermano, papeleta } = datos
  switch (campo.clave) {
    case 'nombre':
      return hermano.nombre
    case 'numeroHermano':
      return String(hermano.numero)
    case 'dni':
      return hermano.dni || ''
    case 'antiguedad':
      return String(hermano.antiguedad ?? '')
    case 'tramo':
      return datos.tramoEtiqueta || papeleta?.opcion || ''
    case 'puesto':
      return datos.puesto != null ? String(datos.puesto) : ''
    case 'modalidad':
      return papeleta?.opcion || datos.tramoEtiqueta || ''
    case 'importe':
      return papeleta ? formatCurrency(papeleta.importe) : ''
    case 'estado':
      return papeleta?.estado || ''
    case 'numeroPapeleta':
      return papeleta ? String(papeleta.numero).padStart(4, '0') : ''
    case 'fechaSolicitud':
      return papeleta?.fechaSolicitud || ''
    case 'fechaSalida':
      return datos.fechaSalida || ''
    case 'hermandad':
      return datos.hermandadNombre || ''
    case 'anio':
      return papeleta ? String(papeleta.anio) : ''
    case 'qr':
      // Devuelve la URL de verificación; PapeletaModeloRender la dibuja como QR.
      return papeleta
        ? urlVerificacion(
            datosVerificacionDe(
              papeleta,
              hermano,
              datos.tramoEtiqueta || papeleta.opcion || 'Sin tramo',
              datos.hermandadNombre || '',
            ),
          )
        : ''
    case 'textoFijo':
      return campo.texto ?? ''
    default:
      return ''
  }
}
