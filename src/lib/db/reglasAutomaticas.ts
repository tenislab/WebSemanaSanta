import type { ReglaAutomatica } from '../reglasAutomaticas'
import type { CriteriosSegmento } from '../segmentacion'

/**
 * `hermandad_id` no se manda: la pone la base.
 *
 * Y `ultima_vez` TAMPOCO, que es lo que importa aquí: ese campo lo escriben
 * `reclamar_regla_de_hoy()` y `devolver_regla()`, que son las que llevan la
 * cuenta de si la regla ya se disparó hoy. Si el navegador lo mandara al
 * guardar cualquier otro cambio —encender la regla, corregirle una coma— podría
 * pisar esa marca con un valor viejo y la felicitación saldría dos veces.
 */
export function reglaToRow(r: ReglaAutomatica): Record<string, unknown> {
  return {
    id: r.id,
    nombre: r.nombre,
    cada: r.cada,
    criterios: r.criterios ?? {},
    destinatarios: r.destinatarios,
    asunto: r.asunto,
    cuerpo: r.cuerpo,
    activa: r.activa,
  }
}

export function rowToRegla(r: Record<string, unknown>): ReglaAutomatica {
  return {
    id: r.id as string,
    nombre: (r.nombre as string | null) ?? '',
    cada: ((r.cada as string | null) ?? 'diaria') as ReglaAutomatica['cada'],
    criterios: ((r.criterios as CriteriosSegmento | null) ?? {}) as CriteriosSegmento,
    destinatarios: (r.destinatarios as string | null) ?? '',
    asunto: (r.asunto as string | null) ?? '',
    cuerpo: (r.cuerpo as string | null) ?? '',
    activa: r.activa === true,
    ultimaVez: (r.ultima_vez as string | null) ?? null,
  }
}
