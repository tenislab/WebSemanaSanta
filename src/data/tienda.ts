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

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * EL CATÁLOGO DE LA DEMOSTRACIÓN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Todos los demás módulos traen ejemplo —treinta y cuatro hermanos, sus cuotas,
 * sus papeletas, el libro de tesorería—, y la tienda no traía ninguno. Así que
 * quien abría la demostración para ver la tienda encontraba «no hay artículos»,
 * y eso no se lee como «esto todavía no está puesto» sino como «esto está
 * roto». Llegó dicho tal cual: «no aparecen bien los artículos».
 *
 * VIENEN CON EXISTENCIAS, y eso es lo que de verdad importa. Un artículo con
 * cero unidades sale «agotado» en la caja y no se puede ni pulsar, así que un
 * catálogo de ejemplo sin género seguiría sin dejar probar nada.
 *
 * Los precios llevan el IVA incluido, como se dicen en el mostrador. Las
 * estampas van al 0 %: los impresos de culto suelen estar exentos, y de paso
 * la demostración enseña que el desglose lo respeta.
 */
export const PRODUCTOS_INICIALES: Producto[] = [
  {
    id: 'prod-medalla', codigo: 'MED', nombre: 'Medalla de la hermandad',
    descripcion: 'Plata de ley con cordón burdeos.',
    precio: 25, coste: 11, iva: 21, stock: 40, stockMinimo: 10,
    activo: true, visibleEnWeb: true, creadoEn: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'prod-camiseta', codigo: 'CAM', nombre: 'Camiseta de la cuadrilla',
    descripcion: 'Algodón, con el escudo bordado. Tallas de la S a la XXL.',
    precio: 15, coste: 6.5, iva: 21, stock: 62, stockMinimo: 15,
    activo: true, visibleEnWeb: true, creadoEn: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'prod-estampa', codigo: 'EST', nombre: 'Estampa del Señor',
    descripcion: 'Cartulina, con la oración al dorso.',
    precio: 1, coste: 0.18, iva: 0, stock: 500, stockMinimo: 100,
    activo: true, visibleEnWeb: true, creadoEn: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'prod-llavero', codigo: 'LLA', nombre: 'Llavero del escudo',
    descripcion: 'Metal esmaltado.',
    precio: 6, coste: 2.2, iva: 21, stock: 85, stockMinimo: 20,
    activo: true, visibleEnWeb: true, creadoEn: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'prod-libro', codigo: 'LIB', nombre: 'Libro del centenario',
    descripcion: 'Tapa dura, 240 páginas, con fotografías del archivo.',
    precio: 30, coste: 17, iva: 4, stock: 24, stockMinimo: 5,
    activo: true, visibleEnWeb: true, creadoEn: '2026-01-15T10:00:00.000Z',
  },
  {
    // Sin existencias A PROPÓSITO: así se ve en la caja cómo queda un artículo
    // agotado y en el almacén cómo avisa de que hay que reponer.
    id: 'prod-cera', codigo: 'CER', nombre: 'Vela de la Virgen',
    descripcion: 'Cera rizada, 60 cm.',
    precio: 4.5, coste: 1.9, iva: 21, stock: 0, stockMinimo: 24,
    activo: true, visibleEnWeb: false, creadoEn: '2026-01-15T10:00:00.000Z',
  },
]

/**
 * Los descuentos de ejemplo. El de costaleros va por la etiqueta «Costalero»
 * de la ficha, que es la que llevan los hermanos de la demostración: así se ve
 * que el descuento aparece solo cuando le corresponde a quien compra.
 */
export const DESCUENTOS_INICIALES: Descuento[] = [
  {
    id: 'desc-hermanos', nombre: 'Hermanos', porcentaje: 10,
    activo: true, creadoEn: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'desc-costaleros', nombre: 'Costaleros', porcentaje: 50, etiqueta: 'Costalero',
    activo: true, creadoEn: '2026-01-15T10:00:00.000Z',
  },
]

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
export function precioDeLineaCent(
  producto: Pick<Producto, 'precio'>,
  descuentoPct: number,
  precioAMano?: number | null,
): number {
  if (precioAMano != null && Number.isFinite(precioAMano) && precioAMano >= 0) {
    return Math.round(precioAMano * 100)
  }
  const pct = Number.isFinite(descuentoPct) ? Math.min(100, Math.max(0, descuentoPct)) : 0
  /*
   * TODO ENTERO, Y NO ES UNA MANÍA.
   *
   * Aquí estaba escrito `Math.round(precio * (1 - pct / 100) * 100) / 100`, que
   * es la forma natural y NO da lo mismo que el `round(numeric, 2)` de
   * Postgres. `Math.round` redondea un número binario de coma flotante y
   * `round(numeric,2)` redondea un decimal exacto, así que en los empates a
   * medio céntimo se van a lados distintos:
   *
   *     1,15 € al 50 %  →  pantalla 0,57 €  ·  base 0,58 €
   *     1,30 € al  5 %  →  pantalla 1,23 €  ·  base 1,24 €
   *     5,35 € al 10 %  →  pantalla 4,81 €  ·  base 4,82 €
   *
   * Probado contra un Postgres de verdad sobre 35.406 combinaciones de precio
   * y descuento: 500 discrepaban. Un 1,4 %, que en un besamanos de ciento
   * veinte ventas son una o dos personas a las que se les dice un precio y se
   * les cobra otro, y un descuadre de caja al final del día sin causa
   * aparente.
   *
   * `porcentaje` es `numeric(5,2)`, así que el descuento puede traer dos
   * decimales: se pasa a centésimas de punto y todo se hace con enteros.
   *
   *     céntimos = precioCent × (10000 − pctCent) / 10000
   *
   * y esa división se redondea a la mitad HACIA ARRIBA, que es lo que hace
   * `round(numeric)`. El resto y el cociente se sacan sin dividir en coma
   * flotante para que la cuenta sea exacta hasta el último céntimo.
   */
  const precioCent = Math.round(producto.precio * 100)
  const num = precioCent * (10000 - Math.round(pct * 100))
  const resto = num % 10000
  const cociente = (num - resto) / 10000
  return resto * 2 >= 10000 ? cociente + 1 : cociente
}

/** Lo mismo, en euros, que es como se enseña. */
export function precioDeLinea(
  producto: Pick<Producto, 'precio'>,
  descuentoPct: number,
  precioAMano?: number | null,
): number {
  return precioDeLineaCent(producto, descuentoPct, precioAMano) / 100
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
    const brutoCent = precioDeLineaCent(l.producto, descuentoPct, l.precioAMano) * l.cantidad
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


// ----------------------------------------------------------------------------
//   LA TIENDA EN LA WEB: RESERVAR Y RECOGER
// ----------------------------------------------------------------------------
//
// Quien entra en la web de la hermandad no compra: APARTA. Paga cuando pasa
// por la casa hermandad y se lo lleva. El porqué —que el dinero es de la
// hermandad y no de Gobergo, y que cobrar por internet arrastra obligaciones
// de comercio electrónico que una hermandad de ochenta camisetas al año no
// tiene por qué asumir— está entero en `supabase/tienda-web.sql`.

/** En qué anda una reserva. */
export type EstadoReserva = 'pendiente' | 'entregada' | 'anulada' | 'caducada'

/** Un artículo tal como lo ve quien entra en la web: sin coste y sin stock real. */
export interface ArticuloWeb {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  precio: number
  iva: number
  fotoUrl?: string
  /**
   * LO QUE SE PUEDE PROMETER, que no es lo que hay en la estantería: es el
   * stock menos lo que ya está apartado y sin recoger. Enseñar el stock a
   * secas haría que alguien apartara la última camiseta dos veces.
   */
  disponible: number
}

/** Una línea de la cesta de la web. */
export interface LineaReservaWeb {
  articulo: ArticuloWeb
  cantidad: number
}

export interface Reserva {
  id: string
  referencia: string
  nombre: string
  email: string
  telefono: string
  notas: string
  estado: EstadoReserva
  recogerAntesDe: string
  total: number
  ventaId?: string
  creadoEn: string
}

export interface LineaReserva {
  id: string
  reservaId: string
  productoId?: string
  codigo: string
  nombre: string
  cantidad: number
  precioUnitario: number
}

/**
 * El total de la cesta de la web.
 *
 * En céntimos, como todo lo demás de este archivo: sumando decimales, tres
 * artículos de 6,10 dan 18,299999999999997 y en pantalla sale «18,3 €».
 */
export function totalDeLaCesta(lineas: LineaReservaWeb[]): number {
  return lineas.reduce((n, l) => n + Math.round(l.articulo.precio * 100) * l.cantidad, 0) / 100
}

/**
 * Cuántas unidades más de un artículo caben en la cesta.
 *
 * Se mira contra lo que ya hay puesto, no solo contra lo disponible: sin eso,
 * se pueden añadir de tres en tres hasta pasarse, y el rechazo llega al final,
 * después de haber escrito el nombre y el teléfono.
 */
export function cabenTodavia(articulo: ArticuloWeb, lineas: LineaReservaWeb[]): number {
  const puestas = lineas.find((l) => l.articulo.id === articulo.id)?.cantidad ?? 0
  return Math.max(0, articulo.disponible - puestas)
}

/** Si de un artículo ya no se puede prometer ni una unidad. */
export function seAgoto(articulo: ArticuloWeb): boolean {
  return articulo.disponible <= 0
}

/**
 * Qué se le puede hacer a una reserva. Solo lo pendiente se toca: una entregada
 * ya es una venta —y se anula desde la venta, no desde aquí, para que la
 * factura no se quede en el aire— y una anulada o caducada está cerrada.
 */
export function sePuedeEntregar(r: Pick<Reserva, 'estado'>): boolean {
  return r.estado === 'pendiente'
}

/**
 * Si se le ha pasado el plazo de recogida.
 *
 * Se comparan CADENAS de fecha («2026-08-26»), no objetos `Date`. Es la misma
 * razón que llevó a `lib/hoy.ts` a existir: `new Date('2026-08-26')` se
 * interpreta en UTC y en España da las 2:00 del día 26, así que comparar con
 * `new Date()` a mediodía del 26 lo daba por vencido con horas de adelanto.
 */
export function seLePasoElPlazo(r: Pick<Reserva, 'estado' | 'recogerAntesDe'>, hoy: string): boolean {
  return r.estado === 'pendiente' && Boolean(r.recogerAntesDe) && r.recogerAntesDe < hoy
}


// ----------------------------------------------------------------------------
//   LA FACTURA
// ----------------------------------------------------------------------------

/** Una fila del desglose de IVA: todo lo que va al mismo tipo. */
export interface TramoIva {
  /** El porcentaje: 21, 10, 4 o 0. */
  tipo: number
  base: number
  cuota: number
  total: number
}

/**
 * EL DESGLOSE DE IVA DE UNA FACTURA, TIPO A TIPO.
 *
 * Una venta puede llevar una camiseta al 21 % y un libro al 4 %, y el artículo
 * 6 del Reglamento de Facturación pide que en ese caso la factura separe la
 * base y la cuota DE CADA TIPO. Un total de IVA a secas no vale: quien lo
 * recibe no puede deducirse nada, y quien lo emite no puede cuadrar el 303.
 *
 * SE CALCULA LÍNEA A LÍNEA Y LUEGO SE AGRUPA, y no al revés, aunque agrupar
 * primero sea más corto. La base la calculó `registrar_venta()` línea a línea
 * —`round(bruto / (1 + iva/100), 2)` por cada una— y la guardó sumada en
 * `ventas.base`. Agrupando antes de dividir, los redondeos caen en otro sitio
 * y el desglose de la factura suma un céntimo distinto de lo que dice la
 * cabecera. Una factura donde el desglose no cuadra con el total es una
 * factura mal hecha, y es lo primero que mira una inspección.
 *
 * Los tramos salen ordenados de mayor a menor tipo, que es como se leen.
 */
export function desgloseIvaPorTipo(lineas: readonly LineaVenta[]): TramoIva[] {
  // En céntimos enteros hasta el final: es lo que evita el 59,999999999.
  const porTipo = new Map<number, { base: number; total: number }>()
  for (const l of lineas) {
    const brutoCent = Math.round(Math.round(l.precioUnitario * 100) * l.cantidad)
    const baseCent = Math.round(brutoCent / (1 + l.iva / 100))
    const acc = porTipo.get(l.iva) ?? { base: 0, total: 0 }
    acc.base += baseCent
    acc.total += brutoCent
    porTipo.set(l.iva, acc)
  }
  return [...porTipo.entries()]
    .map(([tipo, { base, total }]) => ({
      tipo,
      base: base / 100,
      // La cuota, RESTANDO: así base + cuota da el total exacto del tramo
      // aunque el redondeo de la división haya caído a un lado.
      cuota: (total - base) / 100,
      total: total / 100,
    }))
    .sort((a, b) => b.tipo - a.tipo)
}

/**
 * Lo que suma el desglose, para poder compararlo con lo que dice la cabecera
 * de la venta. Si no cuadran, la factura lo dice en vez de callarse: ver
 * `FacturaTienda`.
 */
export function sumaDelDesglose(tramos: readonly TramoIva[]): { base: number; cuota: number; total: number } {
  const cent = (n: number) => Math.round(n * 100)
  return {
    base: tramos.reduce((n, t) => n + cent(t.base), 0) / 100,
    cuota: tramos.reduce((n, t) => n + cent(t.cuota), 0) / 100,
    total: tramos.reduce((n, t) => n + cent(t.total), 0) / 100,
  }
}

/**
 * Si esta venta lleva algo rebajado sobre la tarifa: un descuento por
 * colectivo o un precio puesto a mano. En la factura se enseña la tarifa
 * tachada al lado, que es lo que hace que quien la lee entienda por qué paga
 * menos que lo que pone en la etiqueta.
 */
export function seRebajo(l: Pick<LineaVenta, 'precioUnitario' | 'precioTarifa'>): boolean {
  return l.precioTarifa > 0 && Math.round(l.precioUnitario * 100) < Math.round(l.precioTarifa * 100)
}


// ----------------------------------------------------------------------------
//   LOS DATOS DE LA TIENDA
// ----------------------------------------------------------------------------

/** Un mes de un canal, tal como lo suma `datos_tienda()`. */
export interface MesDeTienda {
  mes: number
  canal: CanalVenta
  total: number
  base: number
  iva: number
  coste: number
  ventas: number
}

export interface ArticuloVendido {
  codigo: string
  nombre: string
  canal: CanalVenta
  unidades: number
  importe: number
  coste: number
}

export interface FormaDePagoUsada {
  forma: string
  canal: CanalVenta
  total: number
  ventas: number
}

export interface DatosTienda {
  anio: number
  anios: number[]
  meses: MesDeTienda[]
  articulos: ArticuloVendido[]
  formas: FormaDePagoUsada[]
}

/** Por qué canal se está mirando. `todos` suma los dos. */
export type FiltroCanal = 'todos' | 'fisica' | 'online'

function entra(canal: CanalVenta, filtro: FiltroCanal): boolean {
  return filtro === 'todos' || canal === filtro
}

/** Las cifras de cabecera de un canal (o de los dos juntos). */
export interface ResumenTienda {
  total: number
  base: number
  iva: number
  coste: number
  margen: number
  ventas: number
  /** Lo que se lleva de media cada venta. 0 si no hubo ninguna. */
  ticketMedio: number
}

export function resumenDeTienda(meses: readonly MesDeTienda[], filtro: FiltroCanal): ResumenTienda {
  const cent = (n: number) => Math.round(n * 100)
  let total = 0; let base = 0; let iva = 0; let coste = 0; let ventas = 0
  for (const m of meses) {
    if (!entra(m.canal, filtro)) continue
    total += cent(m.total); base += cent(m.base); iva += cent(m.iva); coste += cent(m.coste)
    ventas += m.ventas
  }
  return {
    total: total / 100,
    base: base / 100,
    iva: iva / 100,
    coste: coste / 100,
    margen: (total - coste) / 100,
    ventas,
    // Sin ventas no hay media: dividir daría NaN y la pantalla pondría «NaN €».
    ticketMedio: ventas > 0 ? Math.round(total / ventas) / 100 : 0,
  }
}

/**
 * Los doce meses, siempre los doce.
 *
 * La base solo devuelve los meses que tienen algo, que es lo correcto por la
 * red. Pero una gráfica a la que le faltan los meses vacíos MIENTE: julio y
 * agosto sin ventas tienen que verse como el hueco que son, y no desaparecer
 * dejando junio pegado a septiembre como si fueran consecutivos.
 */
export function doceMeses(meses: readonly MesDeTienda[], filtro: FiltroCanal): number[] {
  const cent = new Array<number>(12).fill(0)
  for (const m of meses) {
    if (!entra(m.canal, filtro)) continue
    if (m.mes < 1 || m.mes > 12) continue
    cent[m.mes - 1] += Math.round(m.total * 100)
  }
  return cent.map((c) => c / 100)
}

/**
 * Los artículos que más dejan, juntando canales si hace falta.
 *
 * Se corta en `cuantos` y SE DEVUELVE TAMBIÉN LO QUE SE HA DEJADO FUERA, para
 * que la pantalla pueda decirlo. Una lista de «los más vendidos» que se calla
 * que hay otros treinta se lee como si fueran todos.
 */
export function losQueMasSeVenden(
  articulos: readonly ArticuloVendido[],
  filtro: FiltroCanal,
  cuantos = 8,
): { lista: ArticuloVendido[]; resto: number; restoImporte: number } {
  const porCodigo = new Map<string, ArticuloVendido>()
  for (const a of articulos) {
    if (!entra(a.canal, filtro)) continue
    const ya = porCodigo.get(a.codigo)
    if (!ya) {
      porCodigo.set(a.codigo, { ...a, canal: 'fisica' })
      continue
    }
    ya.unidades += a.unidades
    ya.importe = (Math.round(ya.importe * 100) + Math.round(a.importe * 100)) / 100
    ya.coste = (Math.round(ya.coste * 100) + Math.round(a.coste * 100)) / 100
  }
  const todos = [...porCodigo.values()].sort((a, b) => b.importe - a.importe)
  const lista = todos.slice(0, cuantos)
  const fuera = todos.slice(cuantos)
  return {
    lista,
    resto: fuera.length,
    restoImporte: fuera.reduce((n, a) => n + Math.round(a.importe * 100), 0) / 100,
  }
}

/** Las formas de pago, juntando canales, de más a menos. */
export function comoPagaLaGente(
  formas: readonly FormaDePagoUsada[],
  filtro: FiltroCanal,
): FormaDePagoUsada[] {
  const porForma = new Map<string, FormaDePagoUsada>()
  for (const f of formas) {
    if (!entra(f.canal, filtro)) continue
    const ya = porForma.get(f.forma)
    if (!ya) { porForma.set(f.forma, { ...f, canal: 'fisica' }); continue }
    ya.total = (Math.round(ya.total * 100) + Math.round(f.total * 100)) / 100
    ya.ventas += f.ventas
  }
  return [...porForma.values()].sort((a, b) => b.total - a.total)
}

/**
 * Un techo redondo para el eje de una gráfica.
 *
 * `Math.max` a secas deja el eje en 4.317 €, y entonces lo primero que se lee
 * de la gráfica es ese número raro en vez de los datos. Se sube al siguiente
 * escalón limpio —1, 1,5, 2, 2,5, 5 o 10 por la magnitud— que es como se
 * gradúa un eje para que las líneas de la rejilla caigan en cifras que alguien
 * pueda decir en voz alta.
 *
 * Sin datos devuelve 100 y no 0: un techo de cero haría dividir por cero y
 * dejaría la gráfica llena de `NaN`.
 */
export function techoRedondo(maximo: number): number {
  if (!Number.isFinite(maximo) || maximo <= 0) return 100
  const magnitud = 10 ** Math.floor(Math.log10(maximo))
  for (const paso of [1, 1.5, 2, 2.5, 5, 10]) {
    if (maximo <= paso * magnitud) return paso * magnitud
  }
  return 10 * magnitud
}
