/**
 * LAS CAMPAÑAS de recaudación · camelCase (aplicación) ⇄ snake_case (tabla).
 *
 * Un fichero por tabla, y los dos traductores se le pasan a `useSupabaseTable`.
 * El porqué de que esto esté en un solo sitio, y los TRES SITIOS que hay que
 * tocar al añadir un campo —el tipo, los dos traductores y la columna—, está
 * contado en `lib/db/hermanos.ts`. Olvidar `fromRow` no da error: el dato se
 * guarda y no vuelve, y eso se lee como «se ha perdido».
 */
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
    partidas: r.partidas ?? [],
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
    // Una base que todavía no tiene la columna devuelve `undefined`, y una
    // campaña sin partidas enlazadas es un caso normal, no un hueco.
    partidas: Array.isArray(row.partidas) ? (row.partidas as string[]) : [],
  }
}
