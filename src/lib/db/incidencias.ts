/**
 * LAS INCIDENCIAS del cortejo · camelCase (aplicación) ⇄ snake_case (tabla).
 *
 * Un fichero por tabla, y los dos traductores se le pasan a `useSupabaseTable`.
 * El porqué de que esto esté en un solo sitio, y los TRES SITIOS que hay que
 * tocar al añadir un campo —el tipo, los dos traductores y la columna—, está
 * contado en `lib/db/hermanos.ts`. Olvidar `fromRow` no da error: el dato se
 * guarda y no vuelve, y eso se lee como «se ha perdido».
 */
import type { Incidencia } from '../../data/incidencias'

export function incidenciaToRow(i: Incidencia): Record<string, unknown> {
  return {
    id: i.id,
    papeleta_id: i.papeletaId,
    tipo: i.tipo,
    descripcion: i.descripcion,
    hora: i.hora,
    registrado_por: i.registradoPor,
    resuelta: i.resuelta,
  }
}

export function rowToIncidencia(r: Record<string, unknown>): Incidencia {
  return {
    id: r.id as string,
    papeletaId: r.papeleta_id as string,
    tipo: r.tipo as string,
    descripcion: r.descripcion as string,
    hora: r.hora as string,
    registradoPor: r.registrado_por as string,
    resuelta: r.resuelta as boolean,
  }
}
