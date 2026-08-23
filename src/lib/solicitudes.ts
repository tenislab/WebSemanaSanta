import { useEffect, useState } from 'react'
import { leerPersistido, useEscuchaOtrasPestanas } from './persistencia'
import { supabase, isSupabaseConfigured } from './supabase'
import { hermandadDestino } from './multiHermandad'
import { traducirErrorDeEscritura } from './errorDeBaseDeDatos'

export type EstadoSolicitud = 'Pendiente' | 'Aprobada' | 'Rechazada'

/**
 * Solicitud de alta como hermano/a, enviada desde el área del hermano por
 * quien todavía no está en el censo. La secretaría la revisa desde
 * Hermanos: al aprobarla se crea el hermano con el DNI, el correo y la
 * contraseña que la persona propuso; al rechazarla, queda constancia sin
 * dar de alta a nadie.
 */
export interface SolicitudAlta {
  id: string
  nombre: string
  dni: string
  email: string
  telefono: string
  /** Contraseña que la persona eligió al solicitar el alta; se convertirá en la suya si se aprueba. */
  clavePropuesta: string
  fecha: string
  estado: EstadoSolicitud
  /**
   * Si la manda un hermano para un hijo menor, el id del que lo pide: al
   * aprobarla, el menor queda a su cargo y podrá gestionarle la papeleta
   * desde su propia cuenta.
   */
  tutorId?: string
  /** Fecha de nacimiento del menor, para que secretaría vea que lo es. */
  fechaNacimiento?: string
  /**
   * POR QUÉ SE RECHAZÓ. Lo escribe secretaría al rechazar, y lo lee quien la
   * mandó, en su propia área.
   *
   * Sin esto, la solicitud se resolvía y desaparecía: quien había pedido el
   * alta de su hijo veía un día que ya no estaba y no sabía si le habían dado
   * de alta, si se había perdido o si se la habían denegado. Un «no» sin
   * motivo obliga a llamar a la hermandad para preguntar, que es justo la
   * llamada que esto tenía que ahorrar.
   */
  motivoRechazo?: string
  /** Cuándo se aprobó o se rechazó (aaaa-mm-dd). Vacío mientras está pendiente. */
  resueltaEl?: string
}

/** Se exporta para que el área del hermano pueda escuchar sus cambios. */
export const STORAGE_KEY = 'cabildo-solicitudes'

function solicitudToRow(s: SolicitudAlta): Record<string, unknown> {
  return {
    id: s.id,
    nombre: s.nombre,
    dni: s.dni,
    email: s.email,
    telefono: s.telefono,
    clave_propuesta: s.clavePropuesta,
    fecha: s.fecha,
    estado: s.estado,
    tutor_id: s.tutorId ?? null,
    fecha_nacimiento: s.fechaNacimiento ?? null,
    motivo_rechazo: s.motivoRechazo ?? null,
    resuelta_el: s.resueltaEl ?? null,
  }
}

function rowToSolicitud(r: Record<string, unknown>): SolicitudAlta {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    dni: r.dni as string,
    email: r.email as string,
    telefono: r.telefono as string,
    clavePropuesta: r.clave_propuesta as string,
    fecha: r.fecha as string,
    estado: r.estado as EstadoSolicitud,
    tutorId: (r.tutor_id as string | null) ?? undefined,
    fechaNacimiento: (r.fecha_nacimiento as string | null) ?? undefined,
    motivoRechazo: (r.motivo_rechazo as string | null) ?? undefined,
    resueltaEl: (r.resuelta_el as string | null) ?? undefined,
  }
}

export function getSolicitudes(): SolicitudAlta[] {
  return leerPersistido<SolicitudAlta[]>(STORAGE_KEY, [])
}

/**
 * Como `getSolicitudes`, pero con Supabase conectado trae la tabla real (solo
 * la ve quien ha iniciado sesión: la secretaría).
 *
 * EL ERROR SE MIRA, y aquí está el fallo que arregla esto: la consulta hacía
 * `if (cancelado || error) return` — o sea, si la base rechazaba la lectura, la
 * función se iba de puntillas y la pantalla se quedaba con lo que hubiera en el
 * navegador, que en un ordenador recién estrenado es una lista VACÍA.
 *
 * Traducido a lo que ve la secretaría: alguien pide el alta desde la web, la
 * solicitud está guardada en la base, y en el panel no aparece nada. Ni la
 * solicitud, ni un aviso, ni un motivo. Se da por hecho que nadie ha pedido
 * nada y esa persona se queda sin entrar en la hermandad.
 *
 * Y el motivo más probable es justo el que no se adivina: los permisos. Es el
 * mismo rechazo que impedía crear hermanos — ver `POR-QUE-NO-PUEDO.sql`.
 */
export function useSolicitudes(): SolicitudAlta[] {
  const [solicitudes, setSolicitudes] = useState<SolicitudAlta[]>(() => getSolicitudes())
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelado = false
    supabase
      .from('solicitudes_alta')
      .select('*')
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) {
          /*
           * NO se vacía la lista: se deja lo que hubiera. Poner cero solicitudes
           * porque la consulta falló es afirmar algo que no se sabe, y encima es
           * la afirmación que hace que nadie mire.
           */
          console.error('No se pudieron leer las solicitudes de alta:', error.message)
          window.dispatchEvent(new CustomEvent('cabildo-sync-error', {
            detail: {
              tabla: 'solicitudes_alta',
              fallos: [`leer: ${error.message}`],
              traducidos: [traducirErrorDeEscritura('solicitudes_alta', 'leer', error.message, error.code)],
            },
          }))
          return
        }
        const traidas = (data ?? []).map(rowToSolicitud)
        setSolicitudes(traidas)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(traidas))
      })
    return () => {
      cancelado = true
    }
  }, [])
  // Lo que cambie en otra pestaña (el panel y el área del hermano abiertos a
  // la vez) se refleja aquí sin recargar.
  useEscuchaOtrasPestanas(STORAGE_KEY, () => setSolicitudes(getSolicitudes()))

  return solicitudes
}

/** Reemplaza la lista completa (usado tras aprobar/rechazar): sincroniza por diferencia con Supabase si está conectado. */
export async function saveSolicitudes(solicitudes: SolicitudAlta[]) {
  if (isSupabaseConfigured && supabase) {
    try {
      /*
       * SI NO SE PUEDE LEER, NO SE ESCRIBE.
       *
       * Lo de abajo decide qué crear y qué borrar comparando con lo que hay en
       * la base. Con `data ?? []` una lectura fallida se convertía en «no hay
       * nada», y a partir de ahí el guardado trabaja sobre una foto que no es
       * la de la base: intenta crear otra vez lo que ya existe y da un error de
       * clave duplicada que no dice nada de lo que pasó de verdad.
       *
       * Comparar contra una lista que nunca vino de la base es la misma
       * trampa que ya se arregló en `supabaseSync`, y allí llegaba a BORRAR.
       */
      const { data, error: errorLeer } = await supabase.from('solicitudes_alta').select('id')
      if (errorLeer) {
        console.error('No se pudieron leer las solicitudes antes de guardar:', errorLeer.message)
        window.dispatchEvent(new CustomEvent('cabildo-sync-error', {
          detail: {
            tabla: 'solicitudes_alta',
            fallos: [`leer: ${errorLeer.message}`],
            traducidos: [traducirErrorDeEscritura('solicitudes_alta', 'leer', errorLeer.message, errorLeer.code)],
          },
        }))
        return
      }
      const idsActuales = new Set((data ?? []).map((r: { id: string }) => r.id))
      const nextIds = new Set(solicitudes.map((s) => s.id))
      const eliminadas = [...idsActuales].filter((id) => !nextIds.has(id))
      const nuevas = solicitudes.filter((s) => !idsActuales.has(s.id))
      const posiblesCambios = solicitudes.filter((s) => idsActuales.has(s.id))

      /* Se mira el error de cada una: supabase-js no lanza excepción cuando la
         base rechaza la operación, devuelve `{ error }`. Sin mirarlo, una
         solicitud de alta aceptada en pantalla podía no llegar nunca a la
         base, y la persona se quedaba sin dar de alta creyendo que lo estaba. */
      const fallos: string[] = []
      if (eliminadas.length > 0) {
        const { error } = await supabase.from('solicitudes_alta').delete().in('id', eliminadas)
        if (error) fallos.push(`borrar: ${error.message}`)
      }
      if (nuevas.length > 0) {
        const { error } = await supabase.from('solicitudes_alta').insert(nuevas.map(solicitudToRow))
        if (error) fallos.push(`crear: ${error.message}`)
      }
      for (const s of posiblesCambios) {
        const { error } = await supabase.from('solicitudes_alta').update(solicitudToRow(s)).eq('id', s.id)
        if (error) fallos.push(`guardar ${s.nombre}: ${error.message}`)
      }
      if (fallos.length > 0) {
        console.error('No se pudieron guardar las solicitudes en Supabase:', fallos.join(' · '))
        window.dispatchEvent(new CustomEvent('cabildo-sync-error', {
          detail: { tabla: 'solicitudes_alta', fallos },
        }))
      }
    } catch (err) {
      console.error('No se pudieron guardar las solicitudes en Supabase:', err)
      window.dispatchEvent(new CustomEvent('cabildo-sync-error', {
        detail: { tabla: 'solicitudes_alta', fallos: [String(err)] },
      }))
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(solicitudes))
}

/**
 * Inserta una solicitud desde el área del hermano, sin sesión iniciada
 * (todavía no es hermano/a): usa el permiso de inserción anónima de
 * `solicitudes_alta`, no el guardado por diferencia (que necesitaría poder
 * leer la tabla, y una persona anónima no puede).
 */
export async function crearSolicitudPrincipal(nueva: SolicitudAlta): Promise<{ ok: boolean; error?: string }> {
  if (isSupabaseConfigured && supabase) {
    // A qué hermandad se pide el alta. Quien lo rellena todavía no es hermano
    // y no ha iniciado sesión, así que hay que decirlo aquí: la hermandad de
    // la web que está mirando, o la suya si ya está dentro de su área.
    const hermandadId = await hermandadDestino()
    if (!hermandadId) {
      return { ok: false, error: 'No se ha podido saber a qué hermandad enviar la solicitud. Recarga la página e inténtalo otra vez.' }
    }
    const { error } = await supabase
      .from('solicitudes_alta')
      .insert({ ...solicitudToRow(nueva), hermandad_id: hermandadId })
    if (error) {
      console.error('No se pudo enviar la solicitud a Supabase:', error.message)
      // Antes se seguía adelante y la pantalla decía «tu solicitud se ha
      // enviado a la secretaría», cuando solo existía en SU propio navegador.
      return { ok: false, error: 'No se pudo enviar la solicitud. Inténtalo de nuevo en un momento.' }
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([nueva, ...getSolicitudes()]))
  return { ok: true }
}

/** Clave de almacenamiento de las solicitudes de una hermandad de muestra (su propio buzón, aislado del resto). */
export function claveSolicitudesMuestra(hermandadId: string) {
  return `cabildo-solicitudes-${hermandadId}`
}
