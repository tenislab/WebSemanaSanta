/**
 * LA TIENDA CUANDO NO HAY BASE DE DATOS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Toda la aplicación se puede probar sin base de datos: el censo, las cuotas,
 * las papeletas, el cortejo, la tesorería. La tienda era la única excepción, y
 * eso la hacía parecer rota en vez de «todavía sin conectar»:
 *
 *   · El catálogo salía vacío, sin un solo artículo de ejemplo.
 *   · Si dabas uno de alta, nacía con cero existencias y en la caja aparecía
 *     «agotado», sin poder pulsarlo.
 *   · Y meterle género llamaba a `mover_stock` EN LA BASE, así que tampoco se
 *     podía. Fin del recorrido: ni carrito, ni cobro, ni factura.
 *
 * Llegó dicho como «no aparecen bien los artículos, no se puede hacer
 * facturas», y visto desde fuera es exactamente eso.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTO NO SE EJECUTA NUNCA CON BASE DE DATOS CONECTADA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Con Supabase delante manda `registrar_venta`, y no por gusto: una venta son
 * seis cosas que tienen que pasar juntas o no pasar —número de factura, venta,
 * líneas, stock, movimiento de almacén y los asientos del libro—. Hechas una a
 * una desde el navegador, una conexión que se corta a la mitad deja género
 * descontado sin venta, o dos facturas con el mismo número.
 *
 * Aquí no hay conexión que se corte ni nadie más escribiendo a la vez: es un
 * navegador enseñando cómo funciona. Por eso se puede hacer en JavaScript.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Y HACE LO MISMO QUE EL SQL, A PROPÓSITO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Los importes NO se calculan otra vez aquí: se piden a `totalesDeCesta` y a
 * `precioDeLineaCent`, que son las mismas funciones que usa la pantalla para
 * enseñar el total antes de cobrar y que están cubiertas por pruebas. Lo único
 * propio de este archivo es la fontanería —numerar, bajar existencias y dejar
 * los asientos—, y sigue paso por paso lo que hace `registrar_venta` en
 * `supabase/tienda.sql`: el ingreso por la base, el IVA en su propia partida y
 * el coste del género como gasto. Si algún día se cambia allí, hay una prueba
 * que compara las dos numeraciones.
 */
import { CLAVES_DATOS, leerPersistido } from './persistencia'
import { isSupabaseConfigured } from './supabase'
import { modoDemoActivo } from './demo'
import { nuevoId } from './supabaseSync'
import { hoyIso } from './hoy'
import {
  DESCUENTOS_INICIALES, PRODUCTOS_INICIALES, descuentosPara, precioDeLineaCent, totalesDeCesta,
  type ArticuloVendido, type DatosTienda, type Descuento, type FormaDePagoUsada, type LineaCesta,
  type LineaReserva, type LineaVenta, type MesDeTienda, type MovimientoStock,
  type Producto, type Reserva, type TipoMovimientoStock, type Venta,
} from '../data/tienda'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'
import { CLAVE_SESION_HERMANO } from './sesion'
import { agregarAvisoHermano } from './avisosHermano'
import type { Movimiento } from '../data/movimientos'
import { CATEGORIA_IVA_REPERCUTIDO, MOVIMIENTOS_INICIALES } from '../data/movimientos'

/**
 * ¿Toca trabajar en local? La misma pregunta que se hace `useSupabaseTable`
 * para decidir si lee de la base o del navegador, y por el mismo motivo: con
 * Supabase configurado NO hay demostración que valga, aunque el navegador
 * tenga la marca de una prueba vieja.
 */
export function tiendaEnLocal(): boolean {
  return !isSupabaseConfigured || modoDemoActivo()
}

function leer<T>(clave: string): T[] {
  return leerPersistido<T[]>(clave, [])
}

function guardar(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // Sin sitio o en navegación privada: se queda en memoria y ya está. No es
    // un dato de una hermandad de verdad, es una demostración.
  }
}

export function ventasLocales(): Venta[] {
  return leer<Venta>(CLAVES_DATOS.ventas)
    .slice()
    .sort((a, b) => (a.fecha === b.fecha ? b.numero - a.numero : (a.fecha < b.fecha ? 1 : -1)))
}

/**
 * Una venta suelta, la que se acaba de cobrar.
 *
 * Sin esto, `traerVenta` devolvía `null` en la demostración y el botón «Ver la
 * factura» que sale al cobrar no enseñaba nada: justo el paso que quiere ver
 * quien está probando la aplicación.
 */
export function ventaLocalPorId(ventaId: string): Venta | null {
  return leer<Venta>(CLAVES_DATOS.ventas).find((v) => v.id === ventaId) ?? null
}

export function lineasLocalesDe(ventaId: string): LineaVenta[] {
  return leer<LineaVenta>(CLAVES_DATOS.lineasVenta).filter((l) => l.ventaId === ventaId)
}

export function historialLocalDe(productoId: string): MovimientoStock[] {
  return leer<MovimientoStock>(CLAVES_DATOS.movimientosStock)
    .filter((m) => m.productoId === productoId)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
}

/** Apunta un movimiento de almacén y deja el stock del artículo como queda. */
function anotarMovimiento(
  producto: Producto,
  tipo: TipoMovimientoStock,
  cantidad: number,
  motivo: string,
): void {
  const movimientos = leer<MovimientoStock>(CLAVES_DATOS.movimientosStock)
  movimientos.push({
    id: nuevoId(),
    productoId: producto.id,
    tipo,
    cantidad,
    motivo,
    fecha: new Date().toISOString(),
  })
  guardar(CLAVES_DATOS.movimientosStock, movimientos)
}

/**
 * El catálogo tal como lo ve la pantalla.
 *
 * Con los artículos de ejemplo por defecto, y esto NO es un adorno: hasta que
 * alguien toca el catálogo no hay nada escrito en el navegador, así que leerlo
 * con `[]` decía que no había existencias de nada y la primera venta de la
 * demostración fallaba con «solo hay 0 de Medalla». Es el mismo valor por
 * defecto que usa `useProductos`, que es lo que hace que las dos vean lo mismo.
 */
function catalogoLocal(): Producto[] {
  return leerPersistido<Producto[]>(CLAVES_DATOS.productos, PRODUCTOS_INICIALES)
}

/**
 * EL LIBRO DE TESORERÍA, con el mismo cuidado que el catálogo de arriba y por
 * la misma razón, solo que aquí el precio de equivocarse es peor.
 *
 * `useSupabaseTable('movimientos', …, MOVIMIENTOS_INICIALES, …)` es lo que
 * pinta Tesorería, y en la demostración recién empezada esos apuntes de
 * ejemplo viven SOLO en la memoria de React: no se escriben en este navegador
 * hasta la primera vez que algo llama a `setMovimientos`. Leer el libro aquí
 * con `leer<Movimiento>(CLAVES_DATOS.movimientos)` —que por debajo es
 * `leerPersistido(clave, [])`— devolvía `[]` la primera vez, y la función que
 * cierra la venta hacía `guardar(clave, [...libro, ...nuevos])`: escribía SOLO
 * los tres apuntes de la venta encima de un libro que creía vacío, y ese
 * `[]` quedaba grabado en el navegador para siempre.
 *
 * La consecuencia no se veía en la propia venta —ahí todo cuadraba— sino en
 * la SIGUIENTE pantalla que montara `useSupabaseTable('movimientos', …)`: al
 * volver a montarse leía lo que hay guardado, que ya no eran los dieciocho
 * apuntes de ejemplo sino los tres de la venta, y los Informes de la
 * hermandad pasaban de 13.651,55 € de ingresos a 0,00 € de golpe. Se pilló
 * vendiendo una medalla en el navegador y viendo cómo el total del año se
 * borraba entero.
 */
function libroLocal(): Movimiento[] {
  return leerPersistido<Movimiento[]>(CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES)
}

/** Cambia el stock de un artículo en el catálogo guardado. */
function fijarStock(productoId: string, stock: number): void {
  const productos = catalogoLocal()
  guardar(
    CLAVES_DATOS.productos,
    productos.map((p) => (p.id === productoId ? { ...p, stock } : p)),
  )
}

function stockDe(productoId: string): number {
  return catalogoLocal().find((p) => p.id === productoId)?.stock ?? 0
}

/**
 * Meter o sacar género sin que haya venta: una entrada del proveedor, algo que
 * se rompe, un ajuste al contar el almacén.
 */
export function moverStockLocal(
  producto: Producto,
  tipo: TipoMovimientoStock,
  cantidad: number,
  motivo: string,
  aunqueEsteApartado = false,
): { ok: true; stock: number } | { ok: false; error: string } {
  if (cantidad === 0) return { ok: false, error: 'No has puesto cuántas unidades.' }
  const actual = stockDe(producto.id)
  const nuevo = actual + cantidad
  // El mismo freno que la base: el almacén no puede quedar en negativo, porque
  // un negativo es un descuadre que ya nadie sabe de dónde viene.
  if (nuevo < 0) {
    return { ok: false, error: `Solo hay ${actual} de «${producto.nombre}».` }
  }
  // Y tampoco por debajo de lo que la web ya tiene prometido, salvo que se
  // insista: una rotura es un hecho, pero tiene que quedar dicho a quién deja
  // colgado.
  const apartado = apartadoDe(producto.id)
  if (cantidad < 0 && nuevo < apartado && !aunqueEsteApartado) {
    return {
      ok: false,
      error: `De «${producto.nombre}» quedarían ${nuevo} y hay ${apartado} apartadas por la web. Suelta esas reservas, o repite marcando que se hace igualmente.`,
    }
  }
  fijarStock(producto.id, nuevo)
  anotarMovimiento(producto, tipo, cantidad, motivo)
  return { ok: true, stock: nuevo }
}

/** Los apuntes del libro que deja una venta. Los mismos tres que el SQL. */
function asientosDeLaVenta(
  venta: Venta,
  formaPago: string,
  referencia: string,
): Movimiento[] {
  // Una tarjeta o una transferencia entran en el banco; el efectivo, en la caja.
  const cuenta = /efectivo/i.test(formaPago) ? 'Caja' : 'Cuenta bancaria'
  const libro = libroLocal()
  let numero = libro.reduce((mayor, m) => Math.max(mayor, m.numero), 0)
  const fecha = hoyIso()
  const nuevos: Movimiento[] = []

  const base = Math.round((venta.total - venta.ivaTotal) * 100) / 100
  nuevos.push({
    id: nuevoId(), numero: ++numero, fecha,
    concepto: `Venta en tienda ${referencia}`,
    categoria: 'Otros ingresos', tipo: 'Ingreso', importe: base,
    cuenta, estado: 'Pendiente', origen: `venta:${venta.id}`,
  })

  // Un asiento de cero euros solo ensucia el libro: si la hermandad no
  // repercute IVA, no hay segunda línea.
  if (venta.ivaTotal > 0) {
    nuevos.push({
      id: nuevoId(), numero: ++numero, fecha,
      concepto: `IVA repercutido en la venta ${referencia}`,
      categoria: CATEGORIA_IVA_REPERCUTIDO, tipo: 'Ingreso', importe: venta.ivaTotal,
      cuenta, estado: 'Pendiente', origen: `iva-venta:${venta.id}`,
    })
  }

  // Y el gasto solo si de verdad costó algo: un artículo donado cuesta cero.
  if (venta.costeTotal > 0) {
    nuevos.push({
      id: nuevoId(), numero: ++numero, fecha,
      concepto: `Coste del género vendido ${referencia}`,
      categoria: 'Gastos varios menores', tipo: 'Gasto', importe: venta.costeTotal,
      cuenta, estado: 'Pendiente', origen: `coste-venta:${venta.id}`,
    })
  }

  guardar(CLAVES_DATOS.movimientos, [...libro, ...nuevos])
  return nuevos
}

export interface VentaLocalRegistrada {
  id: string
  serie: string
  numero: number
  base: number
  iva: number
  total: number
  coste: number
  descuentoPct: number
}

/** Cobra una cesta: factura, líneas, almacén y los asientos del libro. */
export function registrarVentaLocal(d: {
  lineas: LineaCesta[]
  canal: 'fisica' | 'online'
  formaPago: string
  hermanoId?: string | null
  descuentoId?: string | null
  descuentoPct?: number
  compradorNombre?: string
  compradorNif?: string
  compradorDireccion?: string
  notas?: string
  serie?: string
}): { ok: true; venta: VentaLocalRegistrada } | { ok: false; error: string } {
  if (d.lineas.length === 0) return { ok: false, error: 'No has puesto nada en la cesta.' }

  /*
   * No se vende lo que no hay Y TAMPOCO LO QUE ESTÁ APARTADO, igual que en la
   * base. Se mira ANTES de tocar nada: media venta apuntada es peor que
   * ninguna.
   *
   * Miraba solo el stock, y con eso el mostrador de la demostración vendía las
   * camisetas que la web tenía prometidas — el mismo fallo que en la base, y
   * enseñado además a quien está probando la aplicación por primera vez.
   */
  for (const l of d.lineas) {
    const hay = stockDe(l.producto.id)
    const apartado = apartadoDe(l.producto.id)
    const disponible = hay - apartado
    if (l.cantidad > disponible) {
      return {
        ok: false,
        error: apartado > 0
          ? `De «${l.producto.nombre}» solo quedan ${Math.max(disponible, 0)} sin apartar: hay ${hay} y ${apartado} están comprometidas por la web.`
          : `Solo hay ${hay} de «${l.producto.nombre}».`,
      }
    }
  }

  const descuentoPct = d.descuentoPct ?? 0
  const t = totalesDeCesta(d.lineas, descuentoPct)
  const serie = d.serie ?? 'A'
  const ventas = leer<Venta>(CLAVES_DATOS.ventas)
  // Correlativa y sin huecos dentro de su serie, como manda la numeración de
  // facturas: una serie con saltos es lo primero que mira una inspección.
  const numero = ventas.filter((v) => v.serie === serie)
    .reduce((mayor, v) => Math.max(mayor, v.numero), 0) + 1

  const venta: Venta = {
    id: nuevoId(),
    serie,
    numero,
    canal: d.canal,
    formaPago: d.formaPago,
    hermanoId: d.hermanoId ?? undefined,
    compradorNombre: d.compradorNombre ?? '',
    compradorNif: d.compradorNif ?? '',
    compradorDireccion: d.compradorDireccion ?? '',
    descuentoId: d.descuentoId ?? undefined,
    descuentoPct,
    base: t.base,
    ivaTotal: t.iva,
    total: t.total,
    costeTotal: t.coste,
    estado: 'Cobrada',
    fecha: hoyIso(),
    notas: d.notas ?? '',
  }

  /*
   * La línea guarda lo mismo que guarda la base: lo que se cobró por unidad,
   * lo que ponía en la ficha y el IVA que le toca. La base imponible y la
   * cuota NO se guardan: las saca `desgloseIvaPorTipo` al pintar la factura,
   * y tenerlas escritas aquí sería un segundo sitio donde pueden dejar de
   * cuadrar con lo que se cobró.
   */
  const lineas: LineaVenta[] = d.lineas.map((l) => {
    const unitarioCent = precioDeLineaCent(l.producto, descuentoPct, l.precioAMano)
    return {
      id: nuevoId(),
      ventaId: venta.id,
      productoId: l.producto.id,
      codigo: l.producto.codigo,
      nombre: l.producto.nombre,
      cantidad: l.cantidad,
      precioUnitario: unitarioCent / 100,
      // Lo que costaría sin descuento: es lo que deja ver en la factura que se
      // ha rebajado, y sin ello «15 €» y «15 € con el 0 %» son lo mismo.
      precioTarifa: l.producto.precio,
      costeUnitario: l.producto.coste,
      iva: l.producto.iva,
    }
  })

  guardar(CLAVES_DATOS.ventas, [...ventas, venta])
  guardar(CLAVES_DATOS.lineasVenta, [...leer<LineaVenta>(CLAVES_DATOS.lineasVenta), ...lineas])

  for (const l of d.lineas) {
    const queda = stockDe(l.producto.id) - l.cantidad
    fijarStock(l.producto.id, queda)
    anotarMovimiento(l.producto, 'venta', -l.cantidad, `Venta ${serie}-${numero}`)
  }

  asientosDeLaVenta(venta, d.formaPago, `${serie}-${numero}`)

  return {
    ok: true,
    venta: {
      id: venta.id, serie, numero,
      base: t.base, iva: t.iva, total: t.total, coste: t.coste, descuentoPct,
    },
  }
}

/**
 * Anular una factura: el género vuelve y los asientos se contra-apuntan.
 *
 * La factura NO se borra y su número se queda ocupado. Es lo mismo que hace la
 * base, y por el mismo motivo: una numeración con huecos no hay quien la
 * explique.
 */
export function anularVentaLocal(ventaId: string, motivo: string): { ok: boolean; error?: string } {
  const ventas = leer<Venta>(CLAVES_DATOS.ventas)
  const venta = ventas.find((v) => v.id === ventaId)
  if (!venta) return { ok: false, error: 'Esa factura ya no está.' }
  if (venta.estado === 'Anulada') {
    return { ok: false, error: 'Esa factura ya estaba anulada. Recarga para ver cómo está.' }
  }

  guardar(CLAVES_DATOS.ventas, ventas.map((v) => (
    v.id === ventaId
      ? { ...v, estado: 'Anulada' as const, notas: [v.notas, motivo].filter(Boolean).join(' · ') }
      : v
  )))

  // El género vuelve al almacén, con su movimiento: sin él, el stock sube y
  // nadie sabe por qué.
  const productos = catalogoLocal()
  for (const l of lineasLocalesDe(ventaId)) {
    if (!l.productoId) continue
    const producto = productos.find((p) => p.id === l.productoId)
    if (!producto) continue
    const queda = stockDe(producto.id) + l.cantidad
    fijarStock(producto.id, queda)
    anotarMovimiento(
      producto, 'devolucion', l.cantidad,
      `Anulada la factura ${venta.serie}-${venta.numero}`,
    )
  }

  // Y los asientos contrarios, uno por cada uno de los que dejó la venta.
  const libro = libroLocal()
  const suyos = libro.filter((m) => (m.origen ?? '').endsWith(`venta:${ventaId}`))
  let numero = libro.reduce((mayor, m) => Math.max(mayor, m.numero), 0)
  const contrarios: Movimiento[] = suyos.map((m) => ({
    ...m,
    id: nuevoId(),
    numero: ++numero,
    fecha: hoyIso(),
    concepto: `Anulación · ${m.concepto}`,
    tipo: m.tipo === 'Ingreso' ? 'Gasto' : 'Ingreso',
    estado: 'Pendiente',
    origen: `anulacion-${m.origen ?? ''}`,
  }))
  guardar(CLAVES_DATOS.movimientos, [...libro, ...contrarios])

  return { ok: true }
}

// ----------------------------------------------------------------------------
//   LAS RESERVAS DE LA WEB
// ----------------------------------------------------------------------------
//
// Apartar por internet y pagar al recogerlo. Sin base de datos tampoco se
// podía probar, y es la mitad de la tienda: sin ello la sección de la web
// pública es un escaparate con un botón que contesta «todavía no está
// conectada».
//
// LO QUE SE PUEDE PROMETER NO ES LO QUE HAY EN LA ESTANTERÍA: es el stock
// menos lo que ya está apartado y sin recoger. Enseñar el stock a secas hace
// que alguien aparte la última camiseta dos veces.

/**
 * EL DESCUENTO QUE LE TOCA AL HERMANO QUE ESTÁ NAVEGANDO, en la demostración.
 *
 * Con base de datos esto lo decide `mejor_descuento_para` y el precio lo
 * calcula `catalogo_web`; aquí hay que hacer lo mismo a mano, y con el MISMO
 * criterio, o la demostración enseñaría una tienda que no se parece a la de
 * verdad.
 *
 * Quién está mirando sale de la sesión del área del hermano —la misma que usa
 * `/hermano`—, no de un parámetro: es lo más cerca que se puede estar aquí de
 * «el navegador no dice quién es».
 */
export function hermanoLocalDeLaSesion(): string | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE_SESION_HERMANO)
    if (!crudo) return null
    return String((JSON.parse(crudo) as { hermanoId?: unknown }).hermanoId ?? '') || null
  } catch {
    // Sin sessionStorage, o con algo que no es JSON: no hay sesión y ya está.
    return null
  }
}

export function descuentoDelHermanoLocal(): { id: string; porcentaje: number } | null {
  const hermanoId = hermanoLocalDeLaSesion()
  if (!hermanoId) return null

  const hermano = leerPersistido<Hermano[]>(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
    .find((h) => h.id === hermanoId)
  if (!hermano || hermano.estado === 'Baja') return null

  // Uno solo, el mayor: la factura guarda un descuento, no una lista. Mismo
  // criterio que `mejor_descuento_para`.
  const suyos = descuentosPara(
    leerPersistido<Descuento[]>(CLAVES_DATOS.descuentos, DESCUENTOS_INICIALES),
    hermano.etiquetas,
    true,
  )
  const mejor = suyos.reduce<Descuento | null>(
    (m, d) => (m === null || d.porcentaje > m.porcentaje ? d : m), null,
  )
  return mejor ? { id: mejor.id, porcentaje: mejor.porcentaje } : null
}

/** Lo apartado y todavía sin recoger de un artículo. */
export function apartadoDe(productoId: string): number {
  const vivas = new Set(
    leer<Reserva>(CLAVES_DATOS.reservas)
      .filter((r) => r.estado === 'pendiente')
      .map((r) => r.id),
  )
  return leer<LineaReserva>(CLAVES_DATOS.lineasReserva)
    .filter((l) => l.productoId && vivas.has(l.reservaId))
    .filter((l) => l.productoId === productoId)
    .reduce((n, l) => n + l.cantidad, 0)
}

export function reservasLocales(): Reserva[] {
  return leer<Reserva>(CLAVES_DATOS.reservas)
    .slice()
    .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1))
}

export function lineasDeReservaLocal(reservaId: string): LineaReserva[] {
  return leer<LineaReserva>(CLAVES_DATOS.lineasReserva).filter((l) => l.reservaId === reservaId)
}

/** Los días que se guarda lo apartado, los mismos que pone la base. */
const DIAS_PARA_RECOGER = 14

export function reservarEnLaWebLocal(d: {
  lineas: { articulo: { id: string; nombre: string }; cantidad: number }[]
  nombre: string
  email?: string
  telefono?: string
  notas?: string
}): { ok: true; resguardo: { referencia: string; total: number; recogerAntesDe: string } }
  | { ok: false; error: string } {
  if (d.lineas.length === 0) return { ok: false, error: 'No has apartado nada.' }
  if (!d.nombre.trim()) return { ok: false, error: 'Hace falta un nombre para poder llamarte.' }

  const catalogo = catalogoLocal()
  const lineas: LineaReserva[] = []
  let total = 0
  const reservaId = nuevoId()
  // El descuento del hermano que esté navegando, resuelto aquí y no recibido:
  // igual que en la base, donde `crear_reserva_web` lo saca de la sesión y
  // nunca de un parámetro.
  const suyo = descuentoDelHermanoLocal()

  for (const l of d.lineas) {
    const p = catalogo.find((x) => x.id === l.articulo.id)
    if (!p) return { ok: false, error: `«${l.articulo.nombre}» ya no está a la venta.` }
    // Un tope por línea: nadie aparta doscientas camisetas desde la web.
    if (l.cantidad <= 0 || l.cantidad > 50) {
      return { ok: false, error: 'Esa cantidad no se puede apartar.' }
    }
    const libres = p.stock - apartadoDe(p.id)
    if (l.cantidad > libres) {
      return { ok: false, error: `De «${p.nombre}» ya solo quedan ${Math.max(0, libres)} sin apartar.` }
    }
    // El precio con su descuento, con la misma cuenta que aplica la caja al
    // cobrar. Si aquí saliera un céntimo distinto, el resguardo mentiría.
    const cent = precioDeLineaCent(p, suyo?.porcentaje ?? 0, null)
    total += cent * l.cantidad
    lineas.push({
      id: nuevoId(), reservaId, productoId: p.id, codigo: p.codigo,
      nombre: p.nombre, cantidad: l.cantidad, precioUnitario: cent / 100,
    })
  }

  const reservas = leer<Reserva>(CLAVES_DATOS.reservas)
  const anio = new Date().getFullYear()
  const n = reservas.filter((r) => r.referencia.startsWith(`R-${anio}-`))
    .reduce((mayor, r) => Math.max(mayor, Number(r.referencia.split('-').pop()) || 0), 0) + 1
  /*
   * La fecha límite se saca con `hoyIso`, no con `toISOString()`.
   *
   * `toISOString()` da el día EN UTC: en Sevilla, una reserva hecha a las once
   * y media de la noche de un viernes se guardaba con fecha del sábado, y la
   * de recogida salía un día corrida. Hay una prueba que lo vigila en todo el
   * proyecto, y me ha pillado escribiéndolo aquí.
   */
  const limite = new Date()
  limite.setDate(limite.getDate() + DIAS_PARA_RECOGER)

  const reserva: Reserva = {
    id: reservaId,
    referencia: `R-${anio}-${n}`,
    nombre: d.nombre.trim(),
    email: (d.email ?? '').trim(),
    telefono: (d.telefono ?? '').trim(),
    notas: (d.notas ?? '').trim(),
    estado: 'pendiente',
    recogerAntesDe: hoyIso(limite),
    total: total / 100,
    creadoEn: new Date().toISOString(),
    hermanoId: hermanoLocalDeLaSesion() ?? undefined,
    descuentoId: suyo?.id,
    descuentoPct: suyo?.porcentaje ?? 0,
  }
  guardar(CLAVES_DATOS.reservas, [...reservas, reserva])
  guardar(CLAVES_DATOS.lineasReserva, [...leer<LineaReserva>(CLAVES_DATOS.lineasReserva), ...lineas])

  return {
    ok: true,
    resguardo: { referencia: reserva.referencia, total: reserva.total, recogerAntesDe: reserva.recogerAntesDe },
  }
}

/**
 * COBRAR Y ENTREGAR: aquí es donde la reserva se convierte en venta. Sale la
 * factura, baja el almacén y entran los asientos. Ni un minuto antes: lo
 * apartado no es dinero cobrado.
 */
export function entregarReservaLocal(
  reservaId: string,
  formaPago: string,
): { ok: true; venta: VentaLocalRegistrada } | { ok: false; error: string } {
  const reservas = leer<Reserva>(CLAVES_DATOS.reservas)
  const reserva = reservas.find((r) => r.id === reservaId)
  if (!reserva) return { ok: false, error: 'Esa reserva ya no está.' }
  if (reserva.estado !== 'pendiente') {
    return { ok: false, error: 'Esa reserva ya no está pendiente. Recarga para ver cómo está.' }
  }

  const catalogo = catalogoLocal()
  const cesta: LineaCesta[] = []
  for (const l of lineasDeReservaLocal(reservaId)) {
    const p = l.productoId ? catalogo.find((x) => x.id === l.productoId) : undefined
    if (!p) return { ok: false, error: `«${l.nombre}» ya no está en el catálogo.` }
    // El precio que se apartó manda sobre el de hoy: si la hermandad subió el
    // precio entretanto, a quien reservó se le cobra lo que se le dijo.
    cesta.push({ producto: p, cantidad: l.cantidad, precioAMano: l.precioUnitario })
  }

  /*
   * LA RESERVA SE MARCA ENTREGADA **ANTES** DE COBRARLA, y el orden es toda la
   * trampa de esto.
   *
   * Desde que la venta mira lo disponible y no el stock a secas, las líneas de
   * esta misma reserva cuentan como apartadas mientras siga «pendiente». Con el
   * marcado detrás, la reserva SE BLOQUEABA A SÍ MISMA: entregar una reserva
   * perfectamente válida contestaba «de "Camiseta" solo quedan 0 sin apartar»,
   * y quedaba pendiente para siempre.
   *
   * Y si la venta no sale, se deshace: aquí no hay transacción que lo haga
   * sola, así que se escribe a mano y se comprueba en las pruebas.
   */
  guardar(CLAVES_DATOS.reservas, reservas.map((r) => (
    r.id === reservaId ? { ...r, estado: 'entregada' as const } : r
  )))

  const venta = registrarVentaLocal({
    lineas: cesta,
    canal: 'online',
    formaPago,
    compradorNombre: reserva.nombre,
    notas: `Reserva ${reserva.referencia}`,
  })
  if (!venta.ok) {
    guardar(CLAVES_DATOS.reservas, leer<Reserva>(CLAVES_DATOS.reservas).map((r) => (
      r.id === reservaId ? { ...r, estado: 'pendiente' as const } : r
    )))
    return venta
  }

  guardar(CLAVES_DATOS.reservas, leer<Reserva>(CLAVES_DATOS.reservas).map((r) => (
    r.id === reservaId ? { ...r, ventaId: venta.venta.id } : r
  )))
  return venta
}

/**
 * «TU RESERVA ESTÁ LISTA», en la demostración.
 *
 * Hace lo mismo que la base salvo el correo, que aquí no existe —y se dice—.
 * Lo que sí se hace es empujar el aviso en el área del hermano, que es lo que
 * se puede enseñar: quien esté probando la aplicación pulsa el botón en la
 * pestaña de reservas y ve aparecer el aviso en la otra pantalla.
 */
export function avisarReservaListaLocal(reservaId: string):
  { ok: true; hayCorreo: boolean; esHermano: boolean; yaAvisada: boolean } | { ok: false; error: string } {
  const reservas = leer<Reserva>(CLAVES_DATOS.reservas)
  const reserva = reservas.find((r) => r.id === reservaId)
  if (!reserva) return { ok: false, error: 'Esa reserva ya no está.' }
  if (reserva.estado !== 'pendiente') {
    return { ok: false, error: `Esa reserva ya está ${reserva.estado}, así que no hay nada que avisar.` }
  }

  // Avisar dos veces el mismo día no es insistir, es molestar.
  const hace24h = Date.now() - 24 * 60 * 60 * 1000
  const yaAvisada = Boolean(reserva.avisadaEn) && new Date(reserva.avisadaEn ?? '').getTime() > hace24h

  const ahora = new Date().toISOString()
  guardar(CLAVES_DATOS.reservas, reservas.map((r) => (
    r.id === reservaId
      ? { ...r, listaEn: r.listaEn ?? ahora, avisadaEn: yaAvisada ? r.avisadaEn : ahora }
      : r
  )))

  if (reserva.hermanoId && !yaAvisada) {
    // La fecha como se lee, no como se guarda: «2026-12-31» en medio de una
    // frase es de las cosas que hacen que un aviso parezca un error.
    const [a, m2, d2] = (reserva.recogerAntesDe ?? '').split('-')
    const plazo = a && m2 && d2 ? `, y te lo guardamos hasta el ${d2}/${m2}/${a}` : ''
    agregarAvisoHermano(
      reserva.hermanoId,
      `Ya puedes pasar a recoger lo que apartaste (${reserva.referencia}). `
        + `Son ${reserva.total.toFixed(2).replace('.', ',')} €, que se pagan al recogerlo${plazo}.`,
      'tienda',
      'Tu reserva está lista',
    )
  }

  // `hayCorreo: false` siempre: sin base de datos no hay función de envío que
  // llamar, y decir que se ha mandado un correo que no existe es peor que no
  // mandarlo.
  return { ok: true, hayCorreo: false, esHermano: Boolean(reserva.hermanoId), yaAvisada }
}

/**
 * Soltar una reserva que no se va a recoger. NO se borra: se marca, y el
 * género vuelve a estar disponible. Una reserva borrada es una llamada de
 * teléfono que nadie puede explicar.
 */
export function soltarReservaLocal(
  reservaId: string,
  estado: 'anulada' | 'caducada',
): { ok: boolean; error?: string } {
  const reservas = leer<Reserva>(CLAVES_DATOS.reservas)
  const reserva = reservas.find((r) => r.id === reservaId)
  if (!reserva) return { ok: false, error: 'Esa reserva ya no está.' }
  if (reserva.estado !== 'pendiente') {
    return { ok: false, error: 'Esa reserva ya no estaba pendiente. Recarga para ver cómo está.' }
  }
  guardar(CLAVES_DATOS.reservas, reservas.map((r) => (r.id === reservaId ? { ...r, estado } : r)))
  return { ok: true }
}

// ----------------------------------------------------------------------------
//   LOS NÚMEROS DE LA TIENDA
// ----------------------------------------------------------------------------

/**
 * Lo mismo que `datos_tienda()` en el SQL, contado sobre lo que hay en el
 * navegador: por meses, por artículo y por forma de pago, cada uno separado
 * por canal.
 *
 * LAS ANULADAS NO CUENTAN. Es lo que hace la base, y es lo que hay que hacer:
 * una factura anulada no es dinero que haya entrado, y meterla en el resumen
 * infla el año entero.
 */
export function datosTiendaLocales(anio: number): DatosTienda {
  const ventas = leer<Venta>(CLAVES_DATOS.ventas).filter((v) => v.estado !== 'Anulada')
  const lineas = leer<LineaVenta>(CLAVES_DATOS.lineasVenta)
  const delAnio = ventas.filter((v) => v.fecha.slice(0, 4) === String(anio))

  const meses = new Map<string, MesDeTienda>()
  const formas = new Map<string, FormaDePagoUsada>()
  for (const v of delAnio) {
    const mes = Number(v.fecha.slice(5, 7))
    const km = `${mes}|${v.canal}`
    const m = meses.get(km) ?? { mes, canal: v.canal, total: 0, base: 0, iva: 0, coste: 0, ventas: 0 }
    m.total += v.total; m.base += v.base; m.iva += v.ivaTotal; m.coste += v.costeTotal; m.ventas += 1
    meses.set(km, m)

    const forma = v.formaPago || 'Sin indicar'
    const kf = `${forma}|${v.canal}`
    const f = formas.get(kf) ?? { forma, canal: v.canal, total: 0, ventas: 0 }
    f.total += v.total; f.ventas += 1
    formas.set(kf, f)
  }

  const porVenta = new Map(delAnio.map((v) => [v.id, v.canal]))
  const articulos = new Map<string, ArticuloVendido>()
  for (const l of lineas) {
    const canal = porVenta.get(l.ventaId)
    if (!canal) continue
    const k = `${l.codigo}|${canal}`
    const a = articulos.get(k)
      ?? { codigo: l.codigo, nombre: l.nombre, canal, unidades: 0, importe: 0, coste: 0 }
    a.unidades += l.cantidad
    a.importe += l.precioUnitario * l.cantidad
    a.coste += l.costeUnitario * l.cantidad
    articulos.set(k, a)
  }

  const redondear = (n: number) => Math.round(n * 100) / 100
  return {
    anio,
    anios: [...new Set(ventas.map((v) => Number(v.fecha.slice(0, 4))))].sort((a, b) => b - a),
    meses: [...meses.values()].map((m) => ({
      ...m, total: redondear(m.total), base: redondear(m.base),
      iva: redondear(m.iva), coste: redondear(m.coste),
    })),
    articulos: [...articulos.values()].map((a) => ({
      ...a, importe: redondear(a.importe), coste: redondear(a.coste),
    })),
    formas: [...formas.values()].map((f) => ({ ...f, total: redondear(f.total) })),
  }
}
