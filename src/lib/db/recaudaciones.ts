import type { Recaudacion } from '../recaudaciones'

/**
 * `hermandad_id` no se manda: la pone la base con su disparador, igual que en
 * el resto de tablas. Mandarla desde el navegador sería dejar que el navegador
 * eligiera de qué hermandad es la fila.
 *
 * El OBJETIVO viaja en CÉNTIMOS. En euros con decimales, `numeric` y el
 * `number` de JavaScript no redondean igual en los empates, y una campaña de
 * 12.345,675 € se guarda como una cosa y se lee como otra. En céntimos es un
 * entero y no hay nada que redondear.
 */
export function recaudacionToRow(r: Recaudacion): Record<string, unknown> {
  return {
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    objetivo_cent: Math.round(r.objetivo * 100),
    fecha_inicio: r.fechaInicio,
    fecha_fin: r.fechaFin ?? null,
    estado: r.estado,
    en_la_web: r.enLaWeb,
  }
}

export function rowToRecaudacion(row: Record<string, unknown>): Recaudacion {
  return {
    id: row.id as string,
    nombre: (row.nombre as string) ?? '',
    descripcion: (row.descripcion as string | null) ?? '',
    objetivo: Number(row.objetivo_cent ?? 0) / 100,
    fechaInicio: (row.fecha_inicio as string) ?? '',
    fechaFin: (row.fecha_fin as string | null) ?? undefined,
    estado: (row.estado as Recaudacion['estado']) ?? 'abierta',
    enLaWeb: !!row.en_la_web,
    creadaEn: (row.creada_en as string) ?? '',
  }
}
