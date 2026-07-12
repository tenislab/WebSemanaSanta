import type { Incidencia } from '../../data/incidencias'

export function incidenciaToRow(i: Incidencia): Record<string, unknown> {
  return {
    id: i.id,
    papeleta_id: i.papeletaId,
    tipo: i.tipo,
    descripcion: i.descripcion,
    hora: i.hora,
    registrado_por: i.registradoPor,
    hermano_sustituto_id: i.hermanoSustitutoId ?? null,
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
    hermanoSustitutoId: (r.hermano_sustituto_id as string | null) ?? null,
    resuelta: r.resuelta as boolean,
  }
}
