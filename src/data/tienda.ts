/**
 * LA TIENDA DE LA HERMANDAD: los tipos y las cuentas.
 *
 * Todo lo que se puede calcular sin tocar la red vive aquí, puro y aparte de
 * las pantallas, porque es donde se puede mentir con dinero: el IVA de una
 * factura, el margen de un artículo y el beneficio de una temporada.
 *
 * La historia completa —por qué una venta se registra con una función de la
 * base y no escribiendo desde el navegador— está en `supabase/tienda.sql`.
 */

/** Por dónde se vendió. Los datos se miran separados y juntos. */
export type CanalVenta = 'fisica' | 'online'

/** Por qué se movió el stock. */
export type TipoMovimientoStock = 'compra' | 'venta' | 'rotura' | 'ajuste' | 'devolucion'

export type EstadoVenta = 'Cobrada' | 'Anulada'

/**
 * Las formas de pago del mostrador.
 *
 * `Efectivo` no es una más: es la que decide si el dinero entra en Caja o en
 * el banco, y de eso depende que el tesorero pueda conciliar. Ver
 * `cuentaSegunMetodo` en `lib/apuntes.ts`, que es quien lo aplica.
 */
export const FORMAS_PAGO = ['Efectivo', 'Tarjeta', 'Bizum', 'Transferencia'] as const
export type FormaPago = (typeof FORMAS_PAGO)[number]

/** La ficha de un artículo. */
export interface Producto {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  /** PVP CON IVA INCLUIDO: es lo que se dice en el mostrador. */
  precio: number
  /** Lo que le costó a la hermandad. De aquí sale el margen. */
  coste: number
  /** Porcentaje de IVA repercutido. 0 si la hermandad está exenta. */
  iva: number
  stock: number
  /** Por debajo de esto se avisa a quien lleva el inventario. 0 = no avisar. */
  stockMinimo: number
  activo: boolean
  visibleEnWeb: boolean
  fotoUrl?: string
  creadoEn: string
}

export interface LineaVenta {
  id: string
  ventaId: string
  productoId?: string
  /** Copiados al vender: la factura no puede cambiar si cambia la ficha. */
  codigo: string
  nombre: string
  cantidad: number
  /** Lo que se cobró de verdad por unidad, ya con descuento o rebaja. */
  precioUnitario: number
  /** Lo que ponía en la ficha, para ver qué se rebajó. */
  precioTarifa: number
  costeUnitario: number
  iva: number
}

export interface Venta {
  id: string
  serie: string
  numero: number
  canal: CanalVenta
  formaPago: string
  hermanoId?: string
  compradorNombre: string
  compradorNif: string
  compradorDireccion: string
  descuentoId?: string
  descuentoPct: number
  base: number
  ivaTotal: number
  total: number
  costeTotal: number
  estado: EstadoVenta
  fecha: string
  notas: string
}

export interface MovimientoStock {
  id: string
  productoId: string
  tipo: TipoMovimientoStock
  /** Positivo entra, negativo sale. */
  cantidad: number
  motivo: string
  ventaId?: string
  quien?: string
  fecha: string
}

export interface Descuento {
  id: string
  nombre: string
  porcentaje: number
  /** La etiqueta de la ficha que da derecho a él. Vacío = cualquier hermano. */
  etiqueta?: string
  activo: boolean
  creadoEn: string
}

/** La referencia que se enseña e imprime: «A-14». */
export function referenciaFactura(v: Pick<Venta, 'serie' | 'numero'>): string {
  return `${v.serie}-${v.numero}`
}

/**
 * EL DESGLOSE DE IVA DE UN IMPORTE QUE YA LO LLEVA DENTRO.
 *
 * El precio de la ficha es el del mostrador, con el IVA incluido (ver el
 * comentario de `productos.precio`). Para la factura hace falta separarlo.
 *
 * En CÉNTIMOS y con `Math.round`, no sumando decimales: 12,40 + 2,60 tiene que
 * dar 15,00 exactos y no 14,999999999. Y la cuota se saca RESTANDO la base del
 * total en vez de calcularla aparte, para que los tres números cuadren siempre
 * aunque el redondeo caiga a un lado. Una factura donde base + IVA no da el
 * total es una factura mal hecha.
 */
export function desglosarIva(totalConIva: number, porcentajeIva: number): { base: number; iva: number; total: number } {
  const cent = Math.round(totalConIva * 100)
  const baseCent = Math.round(cent / (1 + porcentajeIva / 100))
  return { base: baseCent / 100, iva: (cent - baseCent) / 100, total: cent / 100 }
}

/**
 * Lo que se gana con un artículo: precio menos coste.
 *
 * SOBRE EL PRECIO CON IVA, que es lo que la hermandad tiene en la mano cuando
 * está exenta —el caso normal— y lo que se quiere ver de un vistazo en la
 * ficha. Para el margen fiscal de verdad habría que usar la base, y por eso
 * `margenSobreBase` existe aparte: son dos preguntas distintas y mezclarlas
 * daría un número que no es ninguna de las dos.
 */
export function margen(p: Pick<Producto, 'precio' | 'coste'>): number {
  return Math.round((p.precio - p.coste) * 100) / 100
}

/** El margen sobre la base imponible, para cuando la hermandad sí repercute IVA. */
export function margenSobreBase(p: Pick<Producto, 'precio' | 'coste' | 'iva'>): number {
  const { base } = desglosarIva(p.precio, p.iva)
  return Math.round((base - p.coste) * 100) / 100
}

/** El margen en porcentaje. Sin dividir por cero cuando el artículo es gratis. */
export function margenPorcentaje(p: Pick<Producto, 'precio' | 'coste'>): number {
  if (p.precio <= 0) return 0
  return Math.round(((p.precio - p.coste) / p.precio) * 1000) / 10
}

/** ¿Hay que reponer esto? */
export function quedaPoco(p: Pick<Producto, 'stock' | 'stockMinimo'>): boolean {
  return p.stockMinimo > 0 && p.stock < p.stockMinimo
}

/** ¿Se ha acabado? Distinto de «queda poco»: esto ya no se puede vender. */
export function agotado(p: Pick<Producto, 'stock'>): boolean {
  return p.stock <= 0
}

/**
 * Lo que se cobra por una línea, aplicando el descuento del colectivo.
 *
 * Un precio puesto a mano MANDA sobre el descuento y no se suman: rebajar un
 * 50 % sobre un precio que ya se ha rebajado a ojo en el mostrador no lo
 * espera nadie, y el que se lleva la sorpresa es quien está cobrando. La base
 * de datos hace exactamente lo mismo (ver `registrar_venta`), y tienen que
 * coincidir: si no, el total que enseña la pantalla no sería el que se cobra.
 */
export function precioDeLinea(
  producto: Pick<Producto, 'precio'>,
  descuentoPct: number,
  precioAMano?: number | null,
): number {
  if (precioAMano != null && Number.isFinite(precioAMano) && precioAMano >= 0) {
    return Math.round(precioAMano * 100) / 100
  }
  const pct = Number.isFinite(descuentoPct) ? Math.min(100, Math.max(0, descuentoPct)) : 0
  return Math.round(producto.precio * (1 - pct / 100) * 100) / 100
}

/** Lo que suma una cesta antes de cobrarla, para enseñarlo mientras se teclea. */
export interface LineaCesta {
  producto: Producto
  cantidad: number
  /** Precio puesto a mano, si se ha rebajado en el mostrador. */
  precioAMano?: number | null
}

export function totalesDeCesta(
  lineas: LineaCesta[],
  descuentoPct = 0,
): { base: number; iva: number; total: number; coste: number; beneficio: number; unidades: number } {
  let baseCent = 0
  let totalCent = 0
  let costeCent = 0
  let unidades = 0
  for (const l of lineas) {
    const precio = precioDeLinea(l.producto, descuentoPct, l.precioAMano)
    const brutoCent = Math.round(precio * 100) * l.cantidad
    const bCent = Math.round(brutoCent / (1 + l.producto.iva / 100))
    totalCent += brutoCent
    baseCent += bCent
    costeCent += Math.round(l.producto.coste * 100) * l.cantidad
    unidades += l.cantidad
  }
  return {
    base: baseCent / 100,
    iva: (totalCent - baseCent) / 100,
    total: totalCent / 100,
    coste: costeCent / 100,
    // El beneficio se mide sobre lo COBRADO, que es el dinero que entra. Es el
    // mismo criterio con el que se apuntan los dos asientos en Tesorería.
    beneficio: (totalCent - costeCent) / 100,
    unidades,
  }
}

/**
 * ¿Le corresponde a este hermano este descuento?
 *
 * Se decide por las etiquetas que ya lleva su ficha —«Costalero», «Coro»,
 * «Acólito»—, que es donde la hermandad tiene escrito quién es quién. Sin
 * inventar una segunda lista que habría que mantener aparte.
 *
 * Esto es solo para PINTAR la pantalla: quien de verdad lo decide es la base,
 * en `registrar_venta`. Si esto dijera que sí y la base que no, la venta
 * fallaría — pero al revés, si esto fuera lo único, cualquiera con la consola
 * abierta se aplicaría el descuento de costaleros sin serlo.
 */
export function leCorresponde(
  d: Pick<Descuento, 'etiqueta' | 'activo'>,
  etiquetasDelHermano: string[] | undefined,
): boolean {
  if (!d.activo) return false
  if (!d.etiqueta) return true
  return (etiquetasDelHermano ?? []).includes(d.etiqueta)
}

/** Los descuentos que se le pueden ofrecer a quien está comprando. */
export function descuentosPara(
  descuentos: Descuento[],
  etiquetasDelHermano: string[] | undefined,
  esHermano: boolean,
): Descuento[] {
  // A quien no es hermano no se le ofrece ninguno: los descuentos son de la
  // hermandad para su gente, y en el mostrador es fácil dejar seleccionado el
  // de la venta anterior sin darse cuenta.
  if (!esHermano) return []
  return descuentos.filter((d) => leCorresponde(d, etiquetasDelHermano))
}
