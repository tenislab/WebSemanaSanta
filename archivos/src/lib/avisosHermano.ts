import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { nuevoId } from './supabaseSync'
import type { Hermano } from '../data/hermanos'

/**
 * Avisos al hermano cuando la secretaría cambia algo de sus datos. Cada cambio
 * genera un aviso (correo simulado hasta conectar el proveedor) que el hermano
 * ve en su área. Así el hermano se entera de cualquier modificación que haga la
 * hermandad sobre su ficha.
 */

export interface AvisoHermano {
  id: string
  hermanoId: string
  fecha: string
  texto: string
  leido: boolean
}

const CLAVE = 'cabildo-avisos-hermano'

function hoy(): string {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function getAvisosHermano(): AvisoHermano[] {
  return leerPersistido<AvisoHermano[]>(CLAVE, [])
}

function saveAvisos(lista: AvisoHermano[]) {
  localStorage.setItem(CLAVE, JSON.stringify(lista))
}

/** Registra un aviso para un hermano (correo simulado). */
export function agregarAvisoHermano(hermanoId: string, texto: string) {
  const nuevo: AvisoHermano = { id: nuevoId(), hermanoId, fecha: hoy(), texto, leido: false }
  saveAvisos([nuevo, ...getAvisosHermano()])
}

/** Etiquetas legibles de los campos que el hermano vería como "suyos". */
const CAMPOS_AVISABLES: { campo: keyof Hermano; etiqueta: string }[] = [
  { campo: 'nombre', etiqueta: 'nombre' },
  { campo: 'email', etiqueta: 'correo electrónico' },
  { campo: 'telefono', etiqueta: 'teléfono' },
  { campo: 'direccion', etiqueta: 'dirección' },
  { campo: 'iban', etiqueta: 'cuenta bancaria' },
  { campo: 'estado', etiqueta: 'estado como hermano/a' },
]

/**
 * Compara la ficha anterior con la nueva y, si cambió algún dato del hermano,
 * le genera un aviso describiendo qué se cambió. Devuelve true si avisó.
 */
export function avisarCambiosHermano(anterior: Hermano, nuevo: Hermano): boolean {
  const cambiados = CAMPOS_AVISABLES.filter(({ campo }) => (anterior[campo] ?? '') !== (nuevo[campo] ?? ''))
  if (cambiados.length === 0) return false
  const lista = cambiados.map((c) => c.etiqueta)
  const enumerado =
    lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`
  agregarAvisoHermano(nuevo.id, `La secretaría ha actualizado tu ${enumerado}.`)
  return true
}

/** Hook reactivo con los avisos de un hermano (más nuevos primero). */
export function useAvisosHermano(hermanoId: string | null): {
  avisos: AvisoHermano[]
  sinLeer: number
  marcarLeidos: () => void
} {
  const [todos, setTodos] = useState<AvisoHermano[]>(() => getAvisosHermano())
  useEffect(() => {
    const sync = () => setTodos(getAvisosHermano())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const avisos = hermanoId ? todos.filter((a) => a.hermanoId === hermanoId) : []
  const sinLeer = avisos.filter((a) => !a.leido).length

  function marcarLeidos() {
    if (!hermanoId) return
    const actualizados = getAvisosHermano().map((a) =>
      a.hermanoId === hermanoId ? { ...a, leido: true } : a,
    )
    saveAvisos(actualizados)
    setTodos(actualizados)
  }

  return { avisos, sinLeer, marcarLeidos }
}
