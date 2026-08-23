import { useEffect, useState } from 'react'
import { leerPersistido, useEscuchaOtrasPestanas } from './persistencia'
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
  /**
   * Qué rol da esta opción a quien la saca («Mantilla» → etiqueta Mantilla).
   * Se pone sola mientras tenga la papeleta y desaparece al anularla.
   */
  etiqueta?: string
  /**
   * El puesto del cortejo que ocupa quien la saca.
   *
   * Estas papeletas nacieron para lo que NO sale en el cortejo: la simbólica de
   * quien no procesiona, un recuerdo, un donativo. Pero en cuanto una hermandad
   * las usa de verdad les pone nombres como «nazareno cirio», que sí es un
   * puesto: gente que camina, ocupa sitio y tiene que salir en la lista del
   * diputado de tramo. Sin esto se emitía la papeleta, se cobraba, y el cortejo
   * seguía diciendo 0/40 sin que nada avisara de por qué.
   *
   * Vacío = no sale en el cortejo, que para la simbólica es lo correcto.
   */
  tramoId?: string | null
}

const STORAGE_KEY = 'cabildo-papeletas-opciones'

/** Ejemplos iniciales; la hermandad los cambia o borra desde Configuración. */
export const OPCIONES_INICIALES: OpcionPapeleta[] = [
  { id: 'op1', nombre: 'Papeleta simbólica (no procesiona)', importe: 5 },
  { id: 'op2', nombre: 'Mantilla', importe: 15 },
]

/**
 * Las papeletas sueltas (mantilla, simbólica…) que tenga este navegador.
 *
 * Con base de datos y sin nada guardado devuelve lista vacía, por el mismo
 * motivo que el catálogo de cuotas: estas opciones llevan IMPORTE, y ofrecer
 * los de ejemplo a una hermandad de verdad es cobrar lo que no es.
 */
export function getOpcionesPapeleta(): OpcionPapeleta[] {
  const valores = leerPersistido<OpcionPapeleta[]>(STORAGE_KEY, [])
  if (Array.isArray(valores) && valores.length > 0) return valores
  return isSupabaseConfigured ? [] : OPCIONES_INICIALES
}

function rowToOpcion(r: Record<string, unknown>): OpcionPapeleta {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    importe: Number(r.importe),
    etiqueta: (r.etiqueta as string | null) ?? undefined,
    tramoId: (r.tramo_id as string | null) ?? null,
  }
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
  // Lo que cambie en otra pestaña (el panel y el área del hermano abiertos a
  // la vez) se refleja aquí sin recargar.
  useEscuchaOtrasPestanas(STORAGE_KEY, () => setOpciones(getOpcionesPapeleta()))

  return opciones
}

export async function saveOpcionesPapeleta(
  opciones: OpcionPapeleta[],
): Promise<{ ok: boolean; error?: string }> {
  // Primero el navegador (ver `saveLista`).
  localStorage.setItem(STORAGE_KEY, JSON.stringify(opciones))
  if (!isSupabaseConfigured) return { ok: true }
  return reemplazarTablaCompleta(
    'opciones_papeleta',
    opciones.map((o, orden) => ({
      id: o.id, nombre: o.nombre, importe: o.importe,
      etiqueta: o.etiqueta ?? null, tramo_id: o.tramoId || null, orden,
    })),
  )
}
