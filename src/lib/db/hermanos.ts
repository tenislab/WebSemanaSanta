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
    auth_user_id: h.authUserId,
    etiquetas: h.etiquetas ?? [],
    fecha_nacimiento: h.fechaNacimiento ?? null,
    foto_data_url: h.fotoDataUrl ?? null,
    consiente_foto: h.consienteFoto ?? false,
    parroquia_bautismo: h.parroquiaBautismo ?? null,
    fecha_bautismo: h.fechaBautismo ?? null,
    talla_tunica: h.tallaTunica ?? null,
    notas_salud: h.notasSalud ?? null,
    baja_solicitada: h.bajaSolicitada ?? false,
    baja_solicitada_el: h.bajaSolicitadaEl ?? null,
    motivo_baja: h.motivoBaja ?? null,
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
    authUserId: (r.auth_user_id as string | null) ?? null,
    etiquetas: (r.etiquetas as string[] | null) ?? [],
    fechaNacimiento: (r.fecha_nacimiento as string | null) ?? undefined,
    fotoDataUrl: (r.foto_data_url as string | null) ?? null,
    consienteFoto: Boolean(r.consiente_foto),
    parroquiaBautismo: (r.parroquia_bautismo as string | null) ?? undefined,
    fechaBautismo: (r.fecha_bautismo as string | null) ?? undefined,
    tallaTunica: (r.talla_tunica as string | null) ?? undefined,
    notasSalud: (r.notas_salud as string | null) ?? undefined,
    bajaSolicitada: Boolean(r.baja_solicitada),
    bajaSolicitadaEl: (r.baja_solicitada_el as string | null) ?? undefined,
    motivoBaja: (r.motivo_baja as string | null) ?? undefined,
  }
}
