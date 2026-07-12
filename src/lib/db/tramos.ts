import type { Tramo } from '../tramos'

export function tramoToRow(t: Tramo, orden: number): Record<string, unknown> {
  return {
    id: t.id,
    nombre: t.nombre,
    cuerpo: t.cuerpo,
    capacidad: t.capacidad,
    tipo: t.tipo ?? null,
    reparto: t.reparto ?? null,
    precio: t.precio ?? null,
    orden,
  }
}

export function rowToTramo(r: Record<string, unknown>): Tramo {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    cuerpo: r.cuerpo as string,
    capacidad: r.capacidad as number,
    tipo: (r.tipo as string | null) ?? undefined,
    reparto: (r.reparto as Tramo['reparto']) ?? undefined,
    precio: (r.precio as number | null) ?? null,
  }
}
