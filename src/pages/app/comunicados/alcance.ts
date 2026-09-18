/**
 * A QUIÉN ALCANZA UN DESTINATARIO.
 *
 * Los dos tipos que se pasan la pantalla y lo que se ha sacado de ella, y por
 * eso viven aparte: una hoja sin nada dentro más que tipos, para que nadie
 * tenga que importar la pantalla entera —con su React y su Supabase— para
 * poder nombrar un alcance.
 */
import type { Hermano } from '../../../data/hermanos'

/**
 * A quién alcanza un destinatario.
 *
 *   · `hermanos`   los del censo: buzón en su área y, si hay correo, correo.
 *   · `soloCorreo` la junta que tiene cuenta de acceso pero NO ficha en el
 *                  censo. No tienen área, así que buzón no hay; correo sí.
 *   · `reconocido` si sabemos siquiera a quién se refiere. `false` no es «no
 *                  hay nadie»: es «no lo entiendo», y hay que decirlo.
 */
/**
 * Alguien a quien solo le llega el correo: no tiene ficha en el censo ni área
 * donde recibir el aviso.
 *
 * Era `MiembroPersonal[]` —la junta con cuenta pero sin ficha— y de aquí se
 * usan tres campos: id, nombre y correo. Al abrirlo a esos tres caben también
 * los suscriptores de la web, que son exactamente el mismo caso: un correo y
 * un nombre, y nada más.
 */
export interface SoloCorreo {
  id: string
  nombre: string
  email: string
}

export interface Alcance {
  hermanos: Hermano[]
  soloCorreo: SoloCorreo[]
  reconocido: boolean
  /**
   * Este comunicado va a la lista de FUERA, no al censo. Cambia cómo se manda:
   * uno a uno, cada correo con su enlace de baja.
   */
  aSuscriptores?: boolean
}
