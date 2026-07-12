import type { Hermano } from '../../data/hermanos'

/** camelCase (app) ⇄ snake_case (tabla `hermanos` en Supabase). */
export function hermanoToRow(h: Hermano): Record<string, unknown> {
  return {
    id: h.id,
    numero: h.numero,
    nombre: h.nombre,
    estado: h.estado,
    antiguedad: h.antiguedad,
    email: h.email,
    telefono: h.telefono,
    direccion: h.direccion,
    cuota_al_dia: h.cuotaAlDia,
    iban: h.iban,
    dni: h.dni,
    clave_acceso: h.claveAcceso,
  }
}

export function rowToHermano(r: Record<string, unknown>): Hermano {
  return {
    id: r.id as string,
    numero: r.numero as number,
    nombre: r.nombre as string,
    estado: r.estado as Hermano['estado'],
    antiguedad: r.antiguedad as number,
    email: r.email as string,
    telefono: r.telefono as string,
    direccion: r.direccion as string,
    cuotaAlDia: r.cuota_al_dia as boolean,
    iban: (r.iban as string | null) ?? null,
    dni: r.dni as string,
    claveAcceso: r.clave_acceso as string,
  }
}
