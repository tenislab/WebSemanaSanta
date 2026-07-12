import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { supabase, isSupabaseConfigured } from './supabase'

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
}

const STORAGE_KEY = 'cabildo-solicitudes'

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
  }
}

export function getSolicitudes(): SolicitudAlta[] {
  return leerPersistido<SolicitudAlta[]>(STORAGE_KEY, [])
}

/** Como `getSolicitudes`, pero con Supabase conectado trae la tabla real (solo la ve quien ha iniciado sesión: la secretaría). */
export function useSolicitudes(): SolicitudAlta[] {
  const [solicitudes, setSolicitudes] = useState<SolicitudAlta[]>(() => getSolicitudes())
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelado = false
    supabase
      .from('solicitudes_alta')
      .select('*')
      .then(({ data, error }) => {
        if (cancelado || error) return
        const traidas = (data ?? []).map(rowToSolicitud)
        setSolicitudes(traidas)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(traidas))
      })
    return () => {
      cancelado = true
    }
  }, [])
  return solicitudes
}

/** Reemplaza la lista completa (usado tras aprobar/rechazar): sincroniza por diferencia con Supabase si está conectado. */
export async function saveSolicitudes(solicitudes: SolicitudAlta[]) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.from('solicitudes_alta').select('id')
      const idsActuales = new Set((data ?? []).map((r: { id: string }) => r.id))
      const nextIds = new Set(solicitudes.map((s) => s.id))
      const eliminadas = [...idsActuales].filter((id) => !nextIds.has(id))
      const nuevas = solicitudes.filter((s) => !idsActuales.has(s.id))
      const posiblesCambios = solicitudes.filter((s) => idsActuales.has(s.id))

      if (eliminadas.length > 0) await supabase.from('solicitudes_alta').delete().in('id', eliminadas)
      if (nuevas.length > 0) await supabase.from('solicitudes_alta').insert(nuevas.map(solicitudToRow))
      for (const s of posiblesCambios) {
        await supabase.from('solicitudes_alta').update(solicitudToRow(s)).eq('id', s.id)
      }
    } catch (err) {
      console.error('No se pudieron guardar las solicitudes en Supabase:', err)
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
export async function crearSolicitudPrincipal(nueva: SolicitudAlta) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('solicitudes_alta').insert(solicitudToRow(nueva))
    if (error) console.error('No se pudo enviar la solicitud a Supabase:', error.message)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([nueva, ...getSolicitudes()]))
}

/** Clave de almacenamiento de las solicitudes de una hermandad de muestra (su propio buzón, aislado del resto). */
export function claveSolicitudesMuestra(hermandadId: string) {
  return `cabildo-solicitudes-${hermandadId}`
}
