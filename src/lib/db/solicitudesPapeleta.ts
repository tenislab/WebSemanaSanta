import type { ModalidadPapeleta, SolicitudPapeleta } from '../solicitudesPapeleta'

/**
 * `hermandad_id` NO se manda, igual que en papeletas, cuotas y hermanos: la
 * columna lleva `default hermandad_actual()` y la pone la base a partir de
 * quién está preguntando. Mandarla desde el navegador sería darle a la
 * aplicación la oportunidad de equivocarse en el único dato que separa a una
 * hermandad de otra.
 *
 * Tampoco `estado` al crear: el disparador lo fija en «Pendiente» para
 * cualquier hermano. Se manda de todos modos porque la secretaría SÍ lo
 * cambia —es la misma fila y el mismo `toRow`— y ahí es justo lo que hace
 * falta escribir.
 */
export function solicitudPapeletaToRow(s: SolicitudPapeleta): Record<string, unknown> {
  return {
    id: s.id,
    hermano_id: s.hermanoId,
    hermano_nombre: s.hermanoNombre,
    hermano_numero: s.hermanoNumero,
    anio: s.anio,
    modalidad: s.modalidad,
    preferencia: s.preferencia,
    tramo_solicitado: s.tramoSolicitado,
    comentario: s.comentario,
    fecha: s.fecha,
    estado: s.estado,
  }
}

export function rowToSolicitudPapeleta(r: Record<string, unknown>): SolicitudPapeleta {
  return {
    id: r.id as string,
    hermanoId: r.hermano_id as string,
    hermanoNombre: (r.hermano_nombre as string | null) ?? '',
    hermanoNumero: Number(r.hermano_numero ?? 0),
    anio: Number(r.anio),
    modalidad: (r.modalidad as ModalidadPapeleta | null) ?? 'Nazareno',
    preferencia: (r.preferencia as string | null) ?? '',
    tramoSolicitado: (r.tramo_solicitado as string | null) ?? '',
    comentario: (r.comentario as string | null) ?? '',
    fecha: (r.fecha as string | null) ?? '',
    estado: (r.estado as SolicitudPapeleta['estado'] | null) ?? 'Pendiente',
  }
}
