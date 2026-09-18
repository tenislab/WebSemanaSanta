/**
 * LAS COLUMNAS DEL CENSO Y CÓMO SE PINTA CADA ESTADO.
 *
 * La lista de columnas, el sesgo vacío y las tres funciones que traducen un
 * estado o una situación de cuota a palabras y a clase de CSS.
 *
 * Aparte porque NO es interfaz: son datos y funciones puras que se pueden
 * ejecutar con una prueba. Dentro de `Hermanos.tsx` no se podía probar ni una.
 */
import { type EstadoHermano } from '../../../data/hermanos'
import { etiquetaDeSituacion, type SituacionCuota } from '../../../lib/estadoCuotaHermano'
import { type CriteriosSegmento } from '../../../lib/segmentacion'

/**
 * En el censo, «sin sesgo» significa enseñarlo ENTERO, bajas incluidas. No
 * vale CRITERIOS_POR_DEFECTO, que ya filtra a activos con correo.
 */
export type OrdenCampo = 'numero' | 'nombre' | 'estado' | 'cuota' | 'antiguedad'
/** `opcional`: columna de apoyo que se oculta en el móvil (ver `col-opcional`). */
export const COLUMNAS: { id: OrdenCampo | 'tramo'; label: string; orden: boolean; opcional?: boolean }[] = [
  { id: 'numero', label: 'Nº', orden: true, opcional: true },
  { id: 'nombre', label: 'Hermano', orden: true },
  { id: 'tramo', label: 'Tramo', orden: false, opcional: true },
  { id: 'estado', label: 'Estado', orden: true },
  { id: 'cuota', label: 'Cuota', orden: true, opcional: true },
  { id: 'antiguedad', label: 'Antigüedad', orden: true, opcional: true },
]

export const SIN_SESGO: CriteriosSegmento = {
  estado: 'Cualquiera', cuota: 'Todos', edad: 'Todos', etiqueta: '', cargo: '', soloConEmail: false, campos: [],
}

/**
 * La cuota de un hermano en una palabra. Son CUATRO estados, no dos.
 *
 * Y SALE DE SUS RECIBOS, no de la ficha. Antes se miraba `h.cuotaAlDia`, un
 * booleano guardado que nadie actualizaba nunca al cobrar: se ponía en falso
 * al dar de alta y ahí se quedaba para siempre. Todo el censo salía
 * «Pendiente» —hubieran pagado o no—, y de ese mismo dato bebían Informes, la
 * segmentación de comunicados y el área del propio hermano. Llegó dicho como
 * «las cuotas no se ponen en condiciones, no puedes ver si alguien tiene la
 * cuota en orden», y era literalmente cierto.
 *
 * El cuarto estado es «sin emitir»: a quien no se le ha emitido ningún recibo
 * no se le puede llamar moroso ni decir que está al día. Es lo que le pasa a
 * un censo recién importado, que es el caso de la captura que llegó.
 */
export function cuotaEnPalabras(s: SituacionCuota): string {
  return etiquetaDeSituacion(s).texto
}

export function cuotaClass(s: SituacionCuota): string {
  return etiquetaDeSituacion(s).clase
}

export function estadoClass(estado: EstadoHermano) {
  if (estado === 'Activo') return 'pill--ok'
  if (estado === 'Nuevo') return 'pill--info'
  return 'pill--off'
}


/** Solicitudes ya aprobadas al llegar con `?aprobar=`. A nivel de módulo para
 *  sobrevivir al remontaje que React hace en desarrollo. */
export const YA_APROBADAS = new Set<string>()
