import type { TareaRed } from '../tareasRedes'
import type { RedSocial } from '../../data/comunicados'

/**
 * `hermandad_id` no se manda: la pone la base y el disparador la vuelve a
 * fijar de todas formas. Y `hecha_en`/`hecha_por` tampoco se mandan al crear
 * —los pone la base al marcar hecho— pero sí viajan al leer, para poder
 * enseñar quién la cerró.
 */
export function tareaRedToRow(t: TareaRed): Record<string, unknown> {
  return {
    id: t.id,
    encargo_id: t.encargoId,
    titulo: t.titulo,
    texto: t.texto,
    que: t.que,
    red: t.red ?? null,
    hermano_id: t.hermanoId ?? null,
    estado: t.estado,
    notas: t.notas,
  }
}

export function rowToTareaRed(r: Record<string, unknown>): TareaRed {
  return {
    id: r.id as string,
    encargoId: r.encargo_id as string,
    titulo: r.titulo as string,
    texto: (r.texto as string | null) ?? '',
    que: r.que as TareaRed['que'],
    red: (r.red as RedSocial | null) ?? undefined,
    hermanoId: (r.hermano_id as string | null) ?? undefined,
    estado: r.estado as TareaRed['estado'],
    creadoEn: r.creado_en as string,
    hechaEn: (r.hecha_en as string | null) ?? undefined,
    hechaPor: (r.hecha_por as string | null) ?? undefined,
    notas: (r.notas as string | null) ?? '',
  }
}
