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
