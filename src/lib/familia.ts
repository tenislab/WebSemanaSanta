import type { SolicitudAlta } from './solicitudes'
import { hoyIso } from './hoy'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * LO QUE UN HERMANO HA PEDIDO PARA LOS SUYOS, RESUELTO O NO.
 *
 * Llegó dicho así: «que si se acepta se quede guardado en el portal del
 * hermano como familiar en el apartado mi familia, que se ponga aprobado o
 * rechazado; si es rechazado, un porqué».
 *
 * EL FALLO era que «Mi familia» solo enseñaba las solicitudes PENDIENTES. En
 * cuanto secretaría resolvía una, desaparecía de la pantalla de quien la había
 * mandado: si se aprobaba, el niño aparecía en la lista de los que lleva —pero
 * sin decir en ningún sitio que aquello venía de su solicitud—, y si se
 * rechazaba, no quedaba nada. Ni un rastro. La persona veía un día que su
 * petición ya no estaba y tenía que llamar a la hermandad a preguntar qué
 * había pasado, que es justo la llamada que esto venía a ahorrar.
 *
 * Aquí se decide qué se le enseña y en qué orden. Va aparte y es puro para
 * poder probar lo que importa —que lo resuelto NO se pierde y que un rechazo
 * lleva su motivo— sin pintar nada.
 */

/** Motivos de rechazo que se ofrecen hechos, porque son los de siempre. */
export const MOTIVOS_DE_RECHAZO = [
  'Ya está en el censo de la hermandad',
  'Los datos no son correctos o están incompletos',
  'No cumple los requisitos para ser hermano/a',
  'Hay cuotas pendientes de pago',
  'Duplicada: ya se mandó esta misma solicitud',
]

/** El texto que se guarda cuando quien rechaza no escribe nada. */
export const RECHAZO_SIN_MOTIVO = 'La hermandad no ha detallado el motivo. Ponte en contacto con secretaría.'

/**
 * Deja la solicitud resuelta: con su estado, su fecha y —si es un rechazo— el
 * porqué.
 *
 * El motivo NUNCA queda vacío en un rechazo. Un «rechazada» a secas es peor
 * que no decir nada: la persona sabe que le han dicho que no y no sabe si es
 * un error suyo que puede arreglar o una decisión de la hermandad.
 */
export function resolverSolicitud(
  s: SolicitudAlta,
  estado: 'Aprobada' | 'Rechazada',
  motivo?: string,
  hoy?: string,
): SolicitudAlta {
  // `hoyIso` y no `toISOString()`: en España ese atajo devuelve el DÍA
  // ANTERIOR entre medianoche y las dos de la mañana, y en una hermandad se
  // trabaja de noche. Ver lib/hoy.ts.
  const resueltaEl = hoy ?? hoyIso()
  if (estado === 'Aprobada') {
    // Se limpia el motivo: si antes se rechazó y luego se aprueba, dejar el
    // porqué del rechazo colgando diría lo contrario de lo que ha pasado.
    return { ...s, estado, resueltaEl, motivoRechazo: undefined }
  }
  return { ...s, estado, resueltaEl, motivoRechazo: (motivo ?? '').trim() || RECHAZO_SIN_MOTIVO }
}

/**
 * Las solicitudes que ese hermano ha mandado para su familia, TODAS: las que
 * esperan y las ya resueltas.
 *
 * Orden: primero lo que sigue esperando —que es lo único sobre lo que puede
 * hacer algo—, y detrás lo resuelto, de lo más reciente a lo más antiguo.
 */
export function solicitudesDeMiFamilia(
  solicitudes: SolicitudAlta[],
  tutorId: string | null | undefined,
): SolicitudAlta[] {
  if (!tutorId) return []
  const mias = solicitudes.filter((s) => s.tutorId === tutorId)
  const peso = (s: SolicitudAlta) => (s.estado === 'Pendiente' ? 0 : 1)
  return [...mias].sort((a, b) => {
    if (peso(a) !== peso(b)) return peso(a) - peso(b)
    return (b.resueltaEl ?? b.fecha ?? '').localeCompare(a.resueltaEl ?? a.fecha ?? '')
  })
}

/** Cómo se dice cada estado en la ficha, y de qué color va la etiqueta. */
export function etiquetaDeSolicitud(s: SolicitudAlta): { texto: string; clase: string } {
  if (s.estado === 'Aprobada') return { texto: 'Aprobada', clase: 'pill--ok' }
  if (s.estado === 'Rechazada') return { texto: 'Rechazada', clase: 'pill--err' }
  return { texto: 'Pendiente de revisar', clase: 'pill--warn' }
}

/**
 * Lo que se le cuenta debajo del nombre. Se escribe en segunda persona porque
 * lo lee quien la mandó, no la secretaría.
 */
export function explicarSolicitud(s: SolicitudAlta): string {
  if (s.estado === 'Aprobada') {
    return `Aprobada${s.resueltaEl ? ` el ${enCristiano(s.resueltaEl)}` : ''}. `
      + 'Ya está en el censo y lo tienes arriba, entre los que llevas tú.'
  }
  if (s.estado === 'Rechazada') {
    return `No se ha aprobado${s.resueltaEl ? ` (${enCristiano(s.resueltaEl)})` : ''}: `
      + (s.motivoRechazo || RECHAZO_SIN_MOTIVO)
  }
  return `Enviada el ${s.fecha}. La secretaría la revisará y te avisará.`
}

/** Una fecha ISO dicha como se dice («14 de marzo de 2026»). */
function enCristiano(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** De quién depende un hermano: lo justo para decirlo, y nada más. */
export interface MiTutor {
  id: string
  nombre: string
  numero: number
}

/**
 * DE QUÉ FAMILIA ES QUIEN ESTÁ MIRANDO.
 *
 * El vínculo de familia son dos fichas y hasta ahora solo se veía desde una: el
 * padre veía a los suyos y el hijo no veía nada. No era un olvido de la
 * pantalla — es que el hijo NO PUEDE leer la ficha de su padre, y no debe:
 * ahí están su teléfono, su dirección y su IBAN.
 *
 * Por eso va por función del servidor (`mi_tutor()`), que sí puede elegir
 * columnas: devuelve el nombre y el número, que es todo lo que hace falta para
 * escribir «Perteneces a la familia de …».
 *
 * NO LANZA NUNCA. En una base que todavía no tiene la pieza puesta, la llamada
 * da error y aquí se traduce a `null`, o sea a «no dependes de nadie» — que es
 * lo que se veía antes de existir esto. Un dato de adorno no puede impedir a
 * nadie entrar en su área.
 */
export async function traerMiTutor(): Promise<MiTutor | null> {
  if (!isSupabaseConfigured || !supabase) return null
  try {
    const { data, error } = await supabase.rpc('mi_tutor')
    if (error || !Array.isArray(data) || data.length === 0) return null
    const t = data[0] as { id?: string; nombre?: string; numero?: number }
    if (!t?.id || !t?.nombre) return null
    return { id: t.id, nombre: t.nombre, numero: Number(t.numero ?? 0) }
  } catch {
    return null
  }
}
