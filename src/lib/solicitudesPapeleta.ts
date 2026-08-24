import { leerPersistido } from './persistencia'
import { useSupabaseTable } from './supabaseSync'
import { rowToSolicitudPapeleta, solicitudPapeletaToRow } from './db/solicitudesPapeleta'

/**
 * Solicitud de papeleta de sitio que el hermano envía desde su área. La
 * secretaría la revisa desde Papeletas: al aceptarla se le emite la papeleta
 * en el tramo/modalidad pedidos; al rechazarla queda constancia. Es el paso
 * online que evita que el hermano tenga que pasar por secretaría.
 *
 * ESTO SE GUARDABA EN EL MÓVIL DEL HERMANO, Y EN NINGÚN OTRO SITIO.
 *
 * En `localStorage`, con la clave de abajo. El hermano rellenaba el
 * formulario, le daba a enviar y la pantalla le decía que su solicitud quedaba
 * registrada — y quedaba, en su teléfono. La secretaría abría Papeletas ›
 * Solicitudes desde el ordenador de la casa de hermandad y leía SU
 * `localStorage`, que estaba vacío.
 *
 * Los dos lados de la misma función leyendo cajones distintos: el hermano veía
 * la suya y creía que ya estaba pedida; la hermandad no veía ninguna y creía
 * que nadie había pedido. Sin un error, sin una banda roja, sin una fila a
 * medias. Y al cerrar el plazo, las que no se atendieron no es que se
 * perdieran: es que nunca salieron del teléfono.
 *
 * Ahora va a la tabla `solicitudes_papeleta`, con sus políticas: el hermano
 * solo crea la suya y solo lee las suyas, el estado lo pone el servidor, y la
 * hermandad las ve y las resuelve. Ver `supabase/solicitudes-de-papeleta.sql`.
 */

export type ModalidadPapeleta = 'Nazareno' | 'Penitente' | 'Acólito' | 'Otro'
export const MODALIDADES: ModalidadPapeleta[] = ['Nazareno', 'Penitente', 'Acólito', 'Otro']

export type EstadoSolicitudPapeleta = 'Pendiente' | 'Aceptada' | 'Rechazada'

export interface SolicitudPapeleta {
  id: string
  hermanoId: string
  hermanoNombre: string
  hermanoNumero: number
  anio: number
  modalidad: ModalidadPapeleta
  /** Preferencia libre (p. ej. «Cirio», «Mantilla»…). */
  preferencia: string
  /** Tramo o cuerpo solicitado, o «Sin preferencia». */
  tramoSolicitado: string
  comentario: string
  fecha: string
  estado: EstadoSolicitudPapeleta
}

export const CLAVE_SOLICITUDES_PAPELETA = 'cabildo-solicitudes-papeleta'

/**
 * Sin nada de fábrica.
 *
 * Aquí no puede haber solicitudes de muestra: una solicitud inventada en la
 * lista de la secretaría es alguien a quien se le emite una papeleta que nadie
 * ha pedido.
 */
const NINGUNA: SolicitudPapeleta[] = []

/**
 * Las solicitudes, de la base.
 *
 * `sinEspejo` para el área del hermano, por lo mismo que en el resto de sus
 * tablas: él solo ve las suyas, y si dejara su lista en la copia de este
 * navegador, el panel abierto en otra pestaña vería desaparecer las de todos
 * los demás.
 */
export function useSolicitudesPapeleta(opciones?: { sinEspejo?: boolean }) {
  return useSupabaseTable<SolicitudPapeleta>(
    'solicitudes_papeleta',
    CLAVE_SOLICITUDES_PAPELETA,
    NINGUNA,
    solicitudPapeletaToRow,
    rowToSolicitudPapeleta,
    'fecha',
    opciones,
  )
}

/**
 * Lectura suelta, para quien solo quiere consultar de paso y no monta el hook.
 * Lee la copia de este navegador, así que solo sabe de lo último que se cargó:
 * quien necesite la lista de verdad, que use el hook.
 */
export function getSolicitudesPapeleta(): SolicitudPapeleta[] {
  return leerPersistido<SolicitudPapeleta[]>(CLAVE_SOLICITUDES_PAPELETA, NINGUNA)
}

/** ¿Tiene este hermano una solicitud de papeleta pendiente para el año dado? */
export function tieneSolicitudPendiente(hermanoId: string, anio: number): boolean {
  return getSolicitudesPapeleta().some(
    (s) => s.hermanoId === hermanoId && s.anio === anio && s.estado === 'Pendiente',
  )
}
