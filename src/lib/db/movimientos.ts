/**
 * LOS MOVIMIENTOS de tesorería · camelCase (aplicación) ⇄ snake_case (tabla).
 *
 * Un fichero por tabla, y los dos traductores se le pasan a `useSupabaseTable`.
 * El porqué de que esto esté en un solo sitio, y los TRES SITIOS que hay que
 * tocar al añadir un campo —el tipo, los dos traductores y la columna—, está
 * contado en `lib/db/hermanos.ts`. Olvidar `fromRow` no da error: el dato se
 * guarda y no vuelve, y eso se lee como «se ha perdido».
 */
import type { Movimiento } from '../../data/movimientos'

export function movimientoToRow(m: Movimiento): Record<string, unknown> {
  return {
    id: m.id,
    numero: m.numero,
    fecha: m.fecha,
    concepto: m.concepto,
    categoria: m.categoria,
    tipo: m.tipo,
    importe: m.importe,
    cuenta: m.cuenta,
    estado: m.estado,
    origen: m.origen ?? null,
  }
}

export function rowToMovimiento(r: Record<string, unknown>): Movimiento {
  return {
    id: r.id as string,
    numero: r.numero as number,
    fecha: r.fecha as string,
    concepto: r.concepto as string,
    categoria: r.categoria as string,
    tipo: r.tipo as Movimiento['tipo'],
    importe: Number(r.importe),
    cuenta: r.cuenta as string,
    estado: r.estado as Movimiento['estado'],
    origen: (r.origen as string | null) ?? undefined,
  }
}
