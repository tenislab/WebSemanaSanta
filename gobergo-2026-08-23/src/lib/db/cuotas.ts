import type { Cuota, MetodoCobro } from '../../data/cuotas'

export function cuotaToRow(c: Cuota): Record<string, unknown> {
  return {
    id: c.id,
    numero: c.numero,
    hermano_id: c.hermanoId,
    concepto: c.concepto,
    importe: c.importe,
    estado: c.estado,
    ejercicio: c.ejercicio ?? null,
    fecha_emision: c.fechaEmision,
    fecha_cobro: c.fechaCobro,
    domiciliada: c.domiciliada,
    metodo_cobro: c.metodoCobro ?? null,
    fecha_pago: c.fechaPago ?? null,
    remesada_el: c.remesadaEl ?? null,
    mora_propuesta_por: c.moraPropuestaPor ?? null,
    mora_propuesta_nombre: c.moraPropuestaNombre ?? null,
    pago_comunicado: c.pagoComunicado ?? null,
  }
}

export function rowToCuota(r: Record<string, unknown>): Cuota {
  return {
    id: r.id as string,
    numero: r.numero as number,
    hermanoId: r.hermano_id as string,
    concepto: r.concepto as string,
    importe: Number(r.importe),
    estado: r.estado as Cuota['estado'],
    ejercicio: r.ejercicio != null ? Number(r.ejercicio) : undefined,
    fechaEmision: r.fecha_emision as string,
    fechaCobro: r.fecha_cobro as string,
    domiciliada: r.domiciliada as boolean,
    metodoCobro: (r.metodo_cobro as MetodoCobro | null) ?? undefined,
    fechaPago: (r.fecha_pago as string | null) ?? undefined,
    remesadaEl: (r.remesada_el as string | null) ?? undefined,
    moraPropuestaPor: (r.mora_propuesta_por as string | null) ?? undefined,
    moraPropuestaNombre: (r.mora_propuesta_nombre as string | null) ?? undefined,
    pagoComunicado: (r.pago_comunicado as Cuota['pagoComunicado']) ?? null,
  }
}
