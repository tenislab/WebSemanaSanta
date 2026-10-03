/**
 * LOS ENSERES del inventario · camelCase (aplicación) ⇄ snake_case (tabla).
 *
 * Un fichero por tabla, y los dos traductores se le pasan a `useSupabaseTable`.
 * El porqué de que esto esté en un solo sitio, y los TRES SITIOS que hay que
 * tocar al añadir un campo —el tipo, los dos traductores y la columna—, está
 * contado en `lib/db/hermanos.ts`. Olvidar `fromRow` no da error: el dato se
 * guarda y no vuelve, y eso se lee como «se ha perdido».
 */
import type { Enser } from '../../data/enseres'

export function enserToRow(e: Enser): Record<string, unknown> {
  return {
    id: e.id,
    numero: e.numero,
    nombre: e.nombre,
    categoria: e.categoria,
    ubicacion: e.ubicacion,
    estado_conservacion: e.estadoConservacion,
    valor_asegurado: e.valorAsegurado,
    prestado_a: e.prestadoA,
    fecha_alta: e.fechaAlta,
    notas: e.notas,
  }
}

export function rowToEnser(r: Record<string, unknown>): Enser {
  return {
    id: r.id as string,
    numero: r.numero as number,
    nombre: r.nombre as string,
    categoria: r.categoria as string,
    ubicacion: r.ubicacion as string,
    estadoConservacion: r.estado_conservacion as Enser['estadoConservacion'],
    valorAsegurado: (r.valor_asegurado as number | null) ?? null,
    prestadoA: (r.prestado_a as string | null) ?? null,
    fechaAlta: r.fecha_alta as string,
    notas: (r.notas as string) ?? '',
  }
}
