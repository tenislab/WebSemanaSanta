import type { Proyecto, TareaProyecto } from '../proyectos'

/**
 * El nombre del responsable se guarda ADEMÁS del identificador, y no es
 * duplicar por duplicar: un proyecto dura años y el hermano que lo llevaba
 * puede darse de baja. Con solo el identificador, la ficha desaparece y el
 * proyecto se queda sin nombre —«responsable: (nadie)»— justo cuando hay que
 * preguntar quién sabía de esto. Guardando el nombre queda el rastro.
 *
 * El presupuesto va en céntimos por lo mismo que el objetivo de la campaña.
 */
export function proyectoToRow(p: Proyecto): Record<string, unknown> {
  return {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    estado: p.estado,
    responsable_id: p.responsableId ?? null,
    responsable_nombre: p.responsableNombre ?? null,
    fecha_objetivo: p.fechaObjetivo ?? null,
    presupuesto_cent: Math.round(p.presupuesto * 100),
    recaudacion_id: p.recaudacionId ?? null,
  }
}

export function rowToProyecto(row: Record<string, unknown>): Proyecto {
  return {
    id: row.id as string,
    nombre: (row.nombre as string) ?? '',
    descripcion: (row.descripcion as string | null) ?? '',
    estado: (row.estado as Proyecto['estado']) ?? 'idea',
    responsableId: (row.responsable_id as string | null) ?? undefined,
    responsableNombre: (row.responsable_nombre as string | null) ?? undefined,
    fechaObjetivo: (row.fecha_objetivo as string | null) ?? undefined,
    presupuesto: Number(row.presupuesto_cent ?? 0) / 100,
    recaudacionId: (row.recaudacion_id as string | null) ?? undefined,
    creadoEn: (row.creado_en as string) ?? '',
  }
}

export function tareaProyectoToRow(t: TareaProyecto): Record<string, unknown> {
  return {
    id: t.id,
    proyecto_id: t.proyectoId,
    titulo: t.titulo,
    hecha: t.hecha,
    hermano_id: t.hermanoId ?? null,
    hermano_nombre: t.hermanoNombre ?? null,
    fecha_limite: t.fechaLimite ?? null,
  }
}

export function rowToTareaProyecto(row: Record<string, unknown>): TareaProyecto {
  return {
    id: row.id as string,
    proyectoId: row.proyecto_id as string,
    titulo: (row.titulo as string) ?? '',
    hecha: !!row.hecha,
    hermanoId: (row.hermano_id as string | null) ?? undefined,
    hermanoNombre: (row.hermano_nombre as string | null) ?? undefined,
    fechaLimite: (row.fecha_limite as string | null) ?? undefined,
    creadaEn: (row.creada_en as string) ?? '',
  }
}
