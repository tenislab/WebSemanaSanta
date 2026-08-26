/**
 * Traductores entre las filas de la base y los objetos de la aplicación.
 *
 * Los `numeric` de Postgres llegan como TEXTO por la red («15.00»), así que
 * todo importe pasa por `Number(...)`. Sin eso, sumar dos precios da «15.005.00»
 * y el total de la cesta sale disparatado sin un solo error por medio.
 */
import type {
  ArticuloWeb, CanalVenta, Descuento, EstadoReserva, EstadoVenta, LineaReserva,
  LineaVenta, MovimientoStock, Producto, Reserva, TipoMovimientoStock, Venta,
} from '../../data/tienda'

/** Un `numeric` que viaja como texto, convertido sin sorpresas. */
function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function productoToRow(p: Producto): Record<string, unknown> {
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: p.precio,
    coste: p.coste,
    iva: p.iva,
    // `stock` NO se manda: lo mueve la base (ventas, roturas, entradas) y
    // escribirlo desde aquí pisaría lo que otro acaba de vender. Ver
    // `registrar_venta` y `mover_stock` en `supabase/tienda.sql`.
    stock_minimo: p.stockMinimo,
    activo: p.activo,
    visible_en_web: p.visibleEnWeb,
    foto_url: p.fotoUrl ?? null,
  }
}

export function rowToProducto(r: Record<string, unknown>): Producto {
  return {
    id: r.id as string,
    codigo: (r.codigo as string) ?? '',
    nombre: (r.nombre as string) ?? '',
    descripcion: (r.descripcion as string) ?? '',
    precio: num(r.precio),
    coste: num(r.coste),
    iva: num(r.iva),
    stock: num(r.stock),
    stockMinimo: num(r.stock_minimo),
    activo: r.activo !== false,
    visibleEnWeb: r.visible_en_web === true,
    fotoUrl: (r.foto_url as string | null) ?? undefined,
    creadoEn: (r.creado_en as string) ?? '',
  }
}

export function descuentoToRow(d: Descuento): Record<string, unknown> {
  return {
    id: d.id,
    nombre: d.nombre,
    porcentaje: d.porcentaje,
    etiqueta: d.etiqueta ?? null,
    activo: d.activo,
  }
}

export function rowToDescuento(r: Record<string, unknown>): Descuento {
  return {
    id: r.id as string,
    nombre: (r.nombre as string) ?? '',
    porcentaje: num(r.porcentaje),
    etiqueta: (r.etiqueta as string | null) ?? undefined,
    activo: r.activo !== false,
    creadoEn: (r.creado_en as string) ?? '',
  }
}

/**
 * Las ventas y sus líneas se LEEN, no se escriben desde aquí.
 *
 * Una venta la crea `registrar_venta()` de una vez —número de factura, stock y
 * los dos asientos— porque son seis cosas que tienen que pasar juntas o no
 * pasar. Por eso no hay `ventaToRow`: escribir una venta a mano desde el
 * navegador dejaría una factura sin stock descontado o sin asientos, y nadie
 * se enteraría hasta cuadrar el año.
 */
export function rowToVenta(r: Record<string, unknown>): Venta {
  return {
    id: r.id as string,
    serie: (r.serie as string) ?? 'A',
    numero: num(r.numero),
    canal: ((r.canal as string) === 'online' ? 'online' : 'fisica') as CanalVenta,
    formaPago: (r.forma_pago as string) ?? '',
    hermanoId: (r.hermano_id as string | null) ?? undefined,
    compradorNombre: (r.comprador_nombre as string) ?? '',
    compradorNif: (r.comprador_nif as string) ?? '',
    compradorDireccion: (r.comprador_direccion as string) ?? '',
    descuentoId: (r.descuento_id as string | null) ?? undefined,
    descuentoPct: num(r.descuento_pct),
    base: num(r.base),
    ivaTotal: num(r.iva_total),
    total: num(r.total),
    costeTotal: num(r.coste_total),
    estado: ((r.estado as string) === 'Anulada' ? 'Anulada' : 'Cobrada') as EstadoVenta,
    fecha: (r.fecha as string) ?? '',
    notas: (r.notas as string) ?? '',
  }
}

export function rowToLineaVenta(r: Record<string, unknown>): LineaVenta {
  return {
    id: r.id as string,
    ventaId: r.venta_id as string,
    productoId: (r.producto_id as string | null) ?? undefined,
    codigo: (r.codigo as string) ?? '',
    nombre: (r.nombre as string) ?? '',
    cantidad: num(r.cantidad),
    precioUnitario: num(r.precio_unitario),
    precioTarifa: num(r.precio_tarifa),
    costeUnitario: num(r.coste_unitario),
    iva: num(r.iva),
  }
}

export function rowToMovimientoStock(r: Record<string, unknown>): MovimientoStock {
  return {
    id: r.id as string,
    productoId: r.producto_id as string,
    tipo: (r.tipo as TipoMovimientoStock) ?? 'ajuste',
    cantidad: num(r.cantidad),
    motivo: (r.motivo as string) ?? '',
    ventaId: (r.venta_id as string | null) ?? undefined,
    quien: (r.quien as string | null) ?? undefined,
    fecha: (r.fecha as string) ?? '',
  }
}

/**
 * LAS RESERVAS DE LA WEB. También se leen y no se escriben desde aquí.
 *
 * Una reserva la crea `crear_reserva_web()` —que es lo único que puede llamar
 * quien entra en la web sin cuenta— y la cierran `entregar_reserva()` o
 * `soltar_reserva()`. Por eso no hay `reservaToRow`: escribirla a mano desde
 * el navegador sería dejar que el precio lo pusiera el que compra.
 */
export function rowToReserva(r: Record<string, unknown>): Reserva {
  return {
    id: r.id as string,
    referencia: (r.referencia as string) ?? '',
    nombre: (r.nombre as string) ?? '',
    email: (r.email as string) ?? '',
    telefono: (r.telefono as string) ?? '',
    notas: (r.notas as string) ?? '',
    estado: ((r.estado as string) ?? 'pendiente') as EstadoReserva,
    recogerAntesDe: (r.recoger_antes_de as string) ?? '',
    total: num(r.total),
    ventaId: (r.venta_id as string | null) ?? undefined,
    creadoEn: (r.creado_en as string) ?? '',
  }
}

export function rowToLineaReserva(r: Record<string, unknown>): LineaReserva {
  return {
    id: r.id as string,
    reservaId: r.reserva_id as string,
    productoId: (r.producto_id as string | null) ?? undefined,
    codigo: (r.codigo as string) ?? '',
    nombre: (r.nombre as string) ?? '',
    cantidad: num(r.cantidad),
    precioUnitario: num(r.precio_unitario),
  }
}

/** Lo que devuelve `catalogo_web()`: la ficha sin el coste ni el stock real. */
export function rowToArticuloWeb(r: Record<string, unknown>): ArticuloWeb {
  return {
    id: r.id as string,
    codigo: (r.codigo as string) ?? '',
    nombre: (r.nombre as string) ?? '',
    descripcion: (r.descripcion as string) ?? '',
    precio: num(r.precio),
    iva: num(r.iva),
    fotoUrl: (r.foto_url as string | null) ?? undefined,
    disponible: num(r.disponible),
  }
}
