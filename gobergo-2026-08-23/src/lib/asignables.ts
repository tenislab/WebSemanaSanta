import type { Hermano } from '../data/hermanos'
import type { MiembroPersonal } from './personal'

/**
 * Alguien a quien se puede asignar algo. No siempre es un hermano del censo:
 * una tarea de un evento puede recaer en el secretario o en el tesorero, que
 * entran con su cuenta del panel y no tienen número de hermano.
 */
export interface PersonaAsignable {
  id: string
  nombre: string
  /** Lo que se ve a la izquierda en la lista: «Nº 45», «Secretario/a»… */
  marca: string
}

/**
 * Los hermanos del censo, como asignables. **Sin las bajas**: no pueden sacar
 * papeleta ni entrar en el cortejo, y sin este filtro se les emitía una
 * papeleta que se cobraba pero luego no aparecía en ningún reparto ni en el
 * orden impreso, porque el reparto descarta a los de baja.
 */
export function hermanosAsignables(hermanos: Hermano[]): PersonaAsignable[] {
  return hermanos
    .filter((h) => h.estado !== 'Baja')
    .map((h) => ({ id: h.id, nombre: h.nombre, marca: h.numero > 0 ? `Nº ${h.numero}` : '—' }))
}

/**
 * Los CARGOS y las etiquetas, como asignables. Muchas tareas no son de nadie
 * en concreto sino «de secretaría» o «de los costaleros»: obligar a poner un
 * nombre hacía que la gente dejara la tarea sin asignar.
 */
export function rolesAsignables(cargos: readonly string[], etiquetas: readonly string[]): PersonaAsignable[] {
  return [
    ...cargos.map((c) => ({ id: `rol:cargo:${c}`, nombre: c, marca: 'Cargo' })),
    ...etiquetas.map((e) => ({ id: `rol:etiqueta:${e}`, nombre: e, marca: 'Grupo' })),
  ]
}

/** ¿Este id de asignación es un rol y no una persona? */
export function esRol(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith('rol:'))
}

/** El personal con acceso al panel, como asignables. */
export function personalAsignable(personal: MiembroPersonal[]): PersonaAsignable[] {
  return personal.filter((m) => m.activo).map((m) => ({ id: m.id, nombre: m.nombre, marca: m.cargo }))
}
