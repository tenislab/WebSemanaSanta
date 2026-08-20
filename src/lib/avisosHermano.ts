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

/**
 * De qué va el aviso. Sirve para el icono, y para que el hermano pueda decir
 * qué quiere recibir y qué no.
 */
export type TipoAviso = 'ficha' | 'comunicado' | 'cuota' | 'papeleta'

export interface AvisoHermano {
  id: string
  hermanoId: string
  fecha: string
  texto: string
  leido: boolean
  /** Los avisos de antes no lo traían: se tratan como cambios de ficha. */
  tipo?: TipoAviso
  /** Titular del aviso, cuando lo tiene (el asunto de un comunicado). */
  titulo?: string
}

export const TIPOS_AVISO: { id: TipoAviso; nombre: string; icono: string; explica: string }[] = [
  { id: 'comunicado', nombre: 'Comunicados de la hermandad', icono: '📣', explica: 'Convocatorias de cabildo, cultos y avisos generales.' },
  { id: 'cuota', nombre: 'Mis cuotas', icono: '💶', explica: 'Cuando se emite un recibo o se da por pagado.' },
  { id: 'papeleta', nombre: 'Mi papeleta de sitio', icono: '🎟️', explica: 'Cuando te asignan sitio o cambia el estado de tu papeleta.' },
  { id: 'ficha', nombre: 'Cambios en mis datos', icono: '✉️', explica: 'Cuando la secretaría modifica algo de tu ficha.' },
]

const CLAVE = 'cabildo-avisos-hermano'
const CLAVE_PREFS = 'cabildo-avisos-preferencias'

/** Qué avisos quiere recibir cada hermano. Lo que no está, se recibe. */
export type PreferenciasAvisos = Partial<Record<TipoAviso, boolean>>

export function getPreferenciasAvisos(hermanoId: string): PreferenciasAvisos {
  const todas = leerPersistido<Record<string, PreferenciasAvisos>>(CLAVE_PREFS, {})
  return todas[hermanoId] ?? {}
}

export function savePreferenciasAvisos(hermanoId: string, prefs: PreferenciasAvisos) {
  const todas = leerPersistido<Record<string, PreferenciasAvisos>>(CLAVE_PREFS, {})
  localStorage.setItem(CLAVE_PREFS, JSON.stringify({ ...todas, [hermanoId]: prefs }))
}

/** ¿Quiere este hermano este tipo de aviso? Por defecto, sí. */
export function quiereAviso(prefs: PreferenciasAvisos, tipo: TipoAviso | undefined): boolean {
  return prefs[tipo ?? 'ficha'] !== false
}

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
export function agregarAvisoHermano(hermanoId: string, texto: string, tipo: TipoAviso = 'ficha', titulo?: string) {
  const nuevo: AvisoHermano = { id: nuevoId(), hermanoId, fecha: hoy(), texto, leido: false, tipo, titulo }
  saveAvisos([nuevo, ...getAvisosHermano()])
}

/** El mismo aviso para muchos hermanos de una vez (un comunicado). */
export function agregarAvisoAVarios(hermanoIds: string[], texto: string, tipo: TipoAviso, titulo?: string) {
  if (hermanoIds.length === 0) return
  const fecha = hoy()
  const nuevos: AvisoHermano[] = hermanoIds.map((hermanoId) => ({
    id: nuevoId(), hermanoId, fecha, texto, leido: false, tipo, titulo,
  }))
  saveAvisos([...nuevos, ...getAvisosHermano()])
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
 * le genera un aviso describiendo qué se cambió.
 *
 * Devuelve el texto del aviso, o `null` si no había nada que avisar. Devuelve
 * el texto y no un sí/no para que quien llama pueda mandar además el mismo
 * mensaje por correo sin volver a componerlo (y sin que este módulo tenga que
 * saber nada de correos, que acabaría en dos módulos importándose el uno al
 * otro). Como `null` es falso y un texto es verdadero, quien solo quiera saber
 * si hubo aviso puede seguir usándolo en un `if` igual que antes.
 */
export function avisarCambiosHermano(anterior: Hermano, nuevo: Hermano): string | null {
  const cambiados = CAMPOS_AVISABLES.filter(({ campo }) => (anterior[campo] ?? '') !== (nuevo[campo] ?? ''))
  if (cambiados.length === 0) return null
  const lista = cambiados.map((c) => c.etiqueta)
  const enumerado =
    lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`
  const texto = `La secretaría ha actualizado tu ${enumerado}.`
  agregarAvisoHermano(nuevo.id, texto)
  return texto
}

/** Hook reactivo con los avisos de un hermano (más nuevos primero). */
export function useAvisosHermano(hermanoId: string | null): {
  avisos: AvisoHermano[]
  sinLeer: number
  marcarLeidos: () => void
  marcarLeido: (id: string, leido: boolean) => void
  borrar: (id: string) => void
  preferencias: PreferenciasAvisos
  cambiarPreferencia: (tipo: TipoAviso, quiere: boolean) => void
} {
  const [todos, setTodos] = useState<AvisoHermano[]>(() => getAvisosHermano())
  const [preferencias, setPreferencias] = useState<PreferenciasAvisos>(() =>
    hermanoId ? getPreferenciasAvisos(hermanoId) : {},
  )
  useEffect(() => {
    const sync = () => {
      setTodos(getAvisosHermano())
      if (hermanoId) setPreferencias(getPreferenciasAvisos(hermanoId))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [hermanoId])
  useEffect(() => {
    setPreferencias(hermanoId ? getPreferenciasAvisos(hermanoId) : {})
  }, [hermanoId])

  // Se filtra al enseñarlos y no al crearlos: si el hermano vuelve a activar un
  // tipo, recupera lo que le habían mandado en vez de encontrarse el hueco.
  const avisos = hermanoId
    ? todos.filter((a) => a.hermanoId === hermanoId && quiereAviso(preferencias, a.tipo))
    : []
  const sinLeer = avisos.filter((a) => !a.leido).length

  function guardar(actualizados: AvisoHermano[]) {
    saveAvisos(actualizados)
    setTodos(actualizados)
  }

  function marcarLeidos() {
    if (!hermanoId) return
    guardar(getAvisosHermano().map((a) => (a.hermanoId === hermanoId ? { ...a, leido: true } : a)))
  }

  function marcarLeido(id: string, leido: boolean) {
    guardar(getAvisosHermano().map((a) => (a.id === id ? { ...a, leido } : a)))
  }

  function borrar(id: string) {
    guardar(getAvisosHermano().filter((a) => a.id !== id))
  }

  function cambiarPreferencia(tipo: TipoAviso, quiere: boolean) {
    if (!hermanoId) return
    const siguientes = { ...preferencias, [tipo]: quiere }
    setPreferencias(siguientes)
    savePreferenciasAvisos(hermanoId, siguientes)
  }

  return { avisos, sinLeer, marcarLeidos, marcarLeido, borrar, preferencias, cambiarPreferencia }
}
