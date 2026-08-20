import type { Evento, TareaEvento, TipoEvento } from '../../data/eventos'

/** Mapeo Evento ↔ fila de Supabase. Las tareas van embebidas como JSON. */
export function eventoToRow(e: Evento): Record<string, unknown> {
  return {
    id: e.id,
    titulo: e.titulo,
    tipo: e.tipo,
    fecha: e.fecha,
    hora: e.hora ?? null,
    lugar: e.lugar ?? null,
    descripcion: e.descripcion ?? null,
    tareas: e.tareas,
    // La repetición NO se mandaba, así que se perdía al recargar: un culto
    // «todos los primeros viernes» volvía a ser una fecha suelta y desaparecía
    // del calendario y de la web en cuanto pasaba ese primer viernes.
    repeticion: e.repeticion ?? null,
  }
}

export function rowToEvento(r: Record<string, unknown>): Evento {
  return {
    id: r.id as string,
    titulo: r.titulo as string,
    tipo: r.tipo as TipoEvento,
    fecha: r.fecha as string,
    hora: (r.hora as string | null) ?? undefined,
    lugar: (r.lugar as string | null) ?? undefined,
    descripcion: (r.descripcion as string | null) ?? undefined,
    repeticion: (r.repeticion as Evento['repeticion'] | null) ?? undefined,
    tareas: Array.isArray(r.tareas) ? (r.tareas as TareaEvento[]) : [],
  }
}
