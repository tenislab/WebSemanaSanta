import type { Movimiento } from '../../data/movimientos'

export function movimientoToRow(m: Movimiento): Record<string, unknown> {
  return {
    id: m.id,
    numero: m.numero,
    fecha: m.fecha,
    concepto: m.concepto,
    categoria: m.categoria,
    tipo: m.tipo,
    importe: m.importe,
    cuenta: m.cuenta,
    estado: m.estado,
  }
}

export function rowToMovimiento(r: Record<string, unknown>): Movimiento {
  return {
    id: r.id as string,
    numero: r.numero as number,
    fecha: r.fecha as string,
    concepto: r.concepto as string,
    categoria: r.categoria as string,
    tipo: r.tipo as Movimiento['tipo'],
    importe: Number(r.importe),
    cuenta: r.cuenta as string,
    estado: r.estado as Movimiento['estado'],
  }
}
