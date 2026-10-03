/**
 * EL PERSONAL con acceso al panel · camelCase (aplicación) ⇄ snake_case (tabla).
 *
 * Un fichero por tabla, y los dos traductores se le pasan a `useSupabaseTable`.
 * El porqué de que esto esté en un solo sitio, y los TRES SITIOS que hay que
 * tocar al añadir un campo —el tipo, los dos traductores y la columna—, está
 * contado en `lib/db/hermanos.ts`. Olvidar `fromRow` no da error: el dato se
 * guarda y no vuelve, y eso se lee como «se ha perdido».
 */
import type { MiembroPersonal } from '../personal'

export function personalToRow(p: MiembroPersonal): Record<string, unknown> {
  return {
    id: p.id,
    nombre: p.nombre,
    email: p.email,
    clave: p.clave,
    cargo: p.cargo,
    activo: p.activo,
    fecha_alta: p.fechaAlta,
    auth_user_id: p.authUserId,
  }
}

export function rowToPersonal(r: Record<string, unknown>): MiembroPersonal {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    email: r.email as string,
    clave: r.clave as string,
    cargo: r.cargo as MiembroPersonal['cargo'],
    activo: r.activo as boolean,
    fechaAlta: r.fecha_alta as string,
    authUserId: (r.auth_user_id as string | null) ?? null,
  }
}
