import type { Papeleta } from '../../data/papeletas'

export function papeletaToRow(p: Papeleta): Record<string, unknown> {
  return {
    id: p.id,
    numero: p.numero,
    hermano_id: p.hermanoId,
    anio: p.anio,
    tramo_id: p.tramoId,
    opcion: p.opcion ?? null,
    importe: p.importe,
    estado: p.estado,
    fecha_solicitud: p.fechaSolicitud,
    fecha_entrega: p.fechaEntrega ?? null,
    pago_metodo: p.pagoComunicado?.metodo ?? null,
    pago_fecha: p.pagoComunicado?.fecha ?? null,
  }
}

export function rowToPapeleta(r: Record<string, unknown>): Papeleta {
  return {
    id: r.id as string,
    numero: r.numero as number,
    hermanoId: r.hermano_id as string,
    anio: r.anio as number,
    tramoId: (r.tramo_id as string | null) ?? null,
    opcion: (r.opcion as string | null) ?? undefined,
    importe: Number(r.importe),
    estado: r.estado as Papeleta['estado'],
    fechaSolicitud: r.fecha_solicitud as string,
    fechaEntrega: (r.fecha_entrega as string | null) ?? undefined,
    pagoComunicado: r.pago_metodo
      ? { metodo: r.pago_metodo as 'Bizum' | 'Transferencia', fecha: r.pago_fecha as string }
      : null,
  }
}
