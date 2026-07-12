import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { isSupabaseConfigured } from './supabase'
import { leerTablaRemota, reemplazarTablaCompleta } from './db/catalogos'

/**
 * Papeletas personalizadas de la hermandad: además de los puestos del cortejo
 * (cirio, vara, cruz de guía…), cada hermandad puede vender papeletas propias
 * con su nombre y su precio — mantilla, papeleta simbólica del que no
 * procesiona, recuerdo… Se editan en Configuración y se ofrecen tanto en la
 * gestión de papeletas como en el área del hermano al sacar la papeleta.
 */
export interface OpcionPapeleta {
  id: string
  nombre: string
  importe: number
}

const STORAGE_KEY = 'cabildo-papeletas-opciones'

/** Ejemplos iniciales; la hermandad los cambia o borra desde Configuración. */
export const OPCIONES_INICIALES: OpcionPapeleta[] = [
  { id: 'op1', nombre: 'Papeleta simbólica (no procesiona)', importe: 5 },
  { id: 'op2', nombre: 'Mantilla', importe: 15 },
]

export function getOpcionesPapeleta(): OpcionPapeleta[] {
  return leerPersistido(STORAGE_KEY, OPCIONES_INICIALES)
}

function rowToOpcion(r: Record<string, unknown>): OpcionPapeleta {
  return { id: r.id as string, nombre: r.nombre as string, importe: Number(r.importe) }
}

/** Como `getOpcionesPapeleta`, pero con Supabase conectado trae la tabla real en cuanto llega. */
export function useOpcionesPapeleta(): OpcionPapeleta[] {
  const [opciones, setOpciones] = useState<OpcionPapeleta[]>(() => getOpcionesPapeleta())
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelado = false
    leerTablaRemota('opciones_papeleta', rowToOpcion).then((traidas) => {
      if (cancelado || !traidas) return
      setOpciones(traidas)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(traidas))
    })
    return () => {
      cancelado = true
    }
  }, [])
  return opciones
}

export async function saveOpcionesPapeleta(opciones: OpcionPapeleta[]) {
  if (isSupabaseConfigured) {
    await reemplazarTablaCompleta(
      'opciones_papeleta',
      opciones.map((o, orden) => ({ id: o.id, nombre: o.nombre, importe: o.importe, orden })),
    )
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(opciones))
}
