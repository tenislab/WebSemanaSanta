import type { ReglaAutomatica } from '../reglasAutomaticas'
import { CRITERIOS_POR_DEFECTO, type CriteriosSegmento } from '../segmentacion'

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
    /*
     * COMPLETADO CON LOS DE FÁBRICA, y esto REPARA lo que ya está guardado.
     *
     * Las reglas creadas antes del arreglo tienen en la columna solo
     * `{ cumpleanos: 'Hoy' }`, y con eso `filtrarSegmento` no sacaba a nadie.
     * Al leerlas así se completan, y en cuanto se toque cualquier cosa de la
     * regla se guardan ya enteras. No hace falta que nadie las rehaga.
     */
    criterios: {
      ...CRITERIOS_POR_DEFECTO,
      ...((r.criterios as Partial<CriteriosSegmento> | null) ?? {}),
    },
    destinatarios: (r.destinatarios as string | null) ?? '',
    asunto: (r.asunto as string | null) ?? '',
    cuerpo: (r.cuerpo as string | null) ?? '',
    activa: r.activa === true,
    ultimaVez: (r.ultima_vez as string | null) ?? null,
  }
}
