/**
 * Quién hizo qué, y cuándo.
 *
 * POR QUÉ HACE FALTA. Una junta de hermandad se renueva cada pocos años y
 * hereda un censo que no ha montado. Cuando algo no cuadra —un hermano de baja
 * que no debería estarlo, un IBAN cambiado, una papeleta anulada— la primera
 * pregunta es siempre la misma: quién lo hizo y cuándo. Sin esto, la respuesta
 * era «no se sabe», y eso en una hermandad acaba en una discusión de cabildo.
 *
 * Y no es solo comodidad: un censo de hermandad es categoría especial del
 * RGPD, y el artículo 32 pide poder demostrar quién accede y modifica.
 *
 * QUÉ NO SE GUARDA: el contenido del cambio. Apuntar «el IBAN pasó de X a Y»
 * duplicaría datos bancarios en una segunda tabla que nadie vigila, y para
 * responder a lo que se pregunta de verdad basta con saber quién lo tocó.
 *
 * NO SE PUEDE REESCRIBIR NI BORRAR, tampoco por el titular. Es lo que hace que
 * sirva para algo: un registro que puede editar quien tiene algo que ocultar
 * no prueba nada. De eso se encargan las políticas de Supabase, que no dan
 * permiso de modificación a nadie.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { leerPersistido } from './persistencia'

export type AccionRegistrada =
  | 'alta'
  | 'baja'
  | 'reactivacion'
  | 'iban'
  | 'ficha'
  | 'papeleta_anulada'
  | 'cuota_pagada'
  | 'cuota_devuelta'
  | 'importacion'
  | 'borrado'

export interface Apunte {
  id: string
  autorNombre: string
  accion: AccionRegistrada
  sobreTipo: string
  sobreId: string | null
  sobreNombre: string
  detalle: string
  cuando: string
}

/** Cómo se llama cada acción cuando hay que leerla. */
export const NOMBRE_ACCION: Record<AccionRegistrada, string> = {
  alta: 'Alta de hermano',
  baja: 'Baja de hermano',
  reactivacion: 'Reactivación',
  iban: 'Cambio de cuenta bancaria',
  ficha: 'Cambio en la ficha',
  papeleta_anulada: 'Papeleta anulada',
  cuota_pagada: 'Cuota cobrada',
  cuota_devuelta: 'Cuota devuelta',
  importacion: 'Importación de censo',
  borrado: 'Borrado de datos',
}

export const CLAVE_REGISTRO = 'cabildo-registro-actividad'

/**
 * Apunta algo que se acaba de hacer.
 *
 * **Nunca lanza.** Un registro que no se puede escribir no puede impedir que
 * se dé de baja a un hermano: el dato es lo importante y el apunte es la
 * prueba. Si falla, se avisa por consola y se sigue.
 *
 * Se llama DESPUÉS de que la cosa haya pasado, no antes: apuntar algo que
 * luego falla sería peor que no apuntarlo.
 */
export async function apuntar(datos: {
  autorNombre: string
  accion: AccionRegistrada
  sobreTipo: string
  sobreId?: string | null
  sobreNombre: string
  detalle: string
}): Promise<void> {
  const apunte: Apunte = {
    id: `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    autorNombre: datos.autorNombre || 'Alguien de la junta',
    accion: datos.accion,
    sobreTipo: datos.sobreTipo,
    sobreId: datos.sobreId ?? null,
    sobreNombre: datos.sobreNombre,
    detalle: datos.detalle,
    cuando: new Date().toISOString(),
  }

  // En el navegador siempre, para que se vea al momento sin esperar a la red.
  try {
    const previos = leerPersistido<Apunte[]>(CLAVE_REGISTRO, [])
    localStorage.setItem(CLAVE_REGISTRO, JSON.stringify([apunte, ...previos].slice(0, 500)))
  } catch {
    // sin sitio en el navegador: la copia de Supabase sigue siendo la buena
  }

  if (!isSupabaseConfigured || !supabase) return
  try {
    await supabase.from('registro_actividad').insert({
      autor_nombre: apunte.autorNombre,
      accion: apunte.accion,
      sobre_tipo: apunte.sobreTipo,
      sobre_id: apunte.sobreId,
      sobre_nombre: apunte.sobreNombre,
      detalle: apunte.detalle,
    })
  } catch (e) {
    console.warn('No se pudo apuntar en el registro de actividad:', e)
  }
}

/** Lo apuntado, lo más reciente primero. */
export async function leerRegistro(limite = 200): Promise<Apunte[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('registro_actividad')
        .select('*')
        .order('cuando', { ascending: false })
        .limit(limite)
      if (!error && data) {
        return (data as Record<string, unknown>[]).map((r) => ({
          id: r.id as string,
          autorNombre: (r.autor_nombre as string) ?? '',
          accion: r.accion as AccionRegistrada,
          sobreTipo: (r.sobre_tipo as string) ?? '',
          sobreId: (r.sobre_id as string | null) ?? null,
          sobreNombre: (r.sobre_nombre as string) ?? '',
          detalle: (r.detalle as string) ?? '',
          cuando: r.cuando as string,
        }))
      }
    } catch {
      // Sin red se enseña lo que haya en el navegador, que es mejor que nada.
    }
  }
  return leerPersistido<Apunte[]>(CLAVE_REGISTRO, []).slice(0, limite)
}

/** «hace 5 minutos», «ayer», «el 3 de marzo». */
export function cuandoEnCristiano(iso: string, ahora = new Date()): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const minutos = Math.floor((ahora.getTime() - t) / 60000)
  if (minutos < 1) return 'ahora mismo'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}
