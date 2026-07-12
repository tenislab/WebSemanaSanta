import type { Cuota } from '../../data/cuotas'

export function cuotaToRow(c: Cuota): Record<string, unknown> {
  return {
    id: c.id,
    numero: c.numero,
    hermano_id: c.hermanoId,
    concepto: c.concepto,
    importe: c.importe,
    estado: c.estado,
    fecha_emision: c.fechaEmision,
    fecha_cobro: c.fechaCobro,
    domiciliada: c.domiciliada,
    fecha_pago: c.fechaPago ?? null,
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
    fechaEmision: r.fecha_emision as string,
    fechaCobro: r.fecha_cobro as string,
    domiciliada: r.domiciliada as boolean,
    fechaPago: (r.fecha_pago as string | null) ?? undefined,
  }
}
