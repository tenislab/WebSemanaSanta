/**
 * LA TIENDA, DESDE LA APLICACIÓN.
 *
 * Aquí están los hooks que leen el catálogo y las llamadas a las tres
 * funciones de la base que lo escriben todo: `registrar_venta`, `mover_stock`
 * y `anular_venta`.
 *
 * POR QUÉ VENDER NO SE HACE ESCRIBIENDO TABLAS. Una venta son seis cosas que
 * tienen que pasar juntas o no pasar: coger el número de factura, guardar la
 * venta, guardar sus líneas, bajar el stock, apuntar por qué bajó, y dejar los
 * dos asientos en Tesorería. Hechas una a una desde el navegador, una conexión
 * que se corta a la mitad deja stock descontado sin venta, o una factura con
 * un número que otro ya usó. El porqué completo está en `supabase/tienda.sql`.
 *
 * PARA ENCENDERLO: ejecuta `supabase/tienda.sql` una vez (o `ACTUALIZAR.sql`,
 * que ya lo lleva).
 */
import { useEffect, useState } from 'react'
import { useSupabaseTable } from './supabaseSync'
import { CLAVES_DATOS, leerPersistido } from './persistencia'
import { diaLocalDe, hoyIso } from './hoy'
import { isSupabaseConfigured, supabase } from './supabase'
import {
  descuentoToRow, productoToRow, rowToArticuloWeb, rowToDescuento, rowToLineaReserva,
  rowToLineaVenta, rowToMovimientoStock, rowToProducto, rowToReserva, rowToVenta,
} from './db/tienda'
import type {
  ArticuloWeb, CanalVenta, DatosTienda, Descuento, LineaCesta, LineaReserva,
  LineaReservaWeb, LineaVenta, MovimientoStock, Producto, Reserva,
  TipoMovimientoStock, Venta,
} from '../data/tienda'
import { DESCUENTOS_INICIALES, PRODUCTOS_INICIALES, precioDeLineaCent } from '../data/tienda'
import {
  anularVentaLocal, apartadoDe, avisarReservaListaLocal, datosTiendaLocales, descuentoDelHermanoLocal,
  entregarReservaLocal, historialLocalDe,
  lineasDeReservaLocal, lineasLocalesDe, moverStockLocal, registrarVentaLocal,
  reservarEnLaWebLocal, reservasLocales, soltarReservaLocal, tiendaEnLocal, ventaLocalPorId,
  ventasLocales,
} from './tiendaLocal'

/**
 * QUE NO SE HAYA PODIDO PREGUNTAR NO ES LO MISMO QUE «NO HAY NADA».
 *
 * `supabase-js` no lanza: devuelve `{ error }` y sigue. Todas las lecturas de
 * aquí, ante un fallo, devolvían lista vacía y lo dejaban en la consola —que
 * en la casa de hermandad no mira nadie—. Y las pantallas de la tienda no
 * enseñan solo una lista: enseñan CIFRAS calculadas sobre ella. Con la sesión
 * caducada o el proyecto en pausa, la pantalla de facturas decía «todavía no
 * se ha vendido nada» y, encima, 0,00 € de base, de IVA y de margen. Un
 * tesorero que la abra para cuadrar el trimestre lee ceros creíbles.
 *
 * Se avisa por la misma señal que usa `useSupabaseTable` y que el marco de la
 * aplicación ya escucha para pintar la banda roja. Ver `supabaseSync.ts`.
 */
function avisarDeFallo(que: string, motivo: string) {
  console.error(`No se pudo traer «${que}»:`, motivo)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('cabildo-sync-error', {
    detail: { tabla: que, fallos: [`no se pudo cargar «${que}»: ${motivo}`] },
  }))
}

/**
 * El catálogo de la hermandad. Lo edita quien lleva el inventario.
 *
 * Los artículos de ejemplo son SOLO para la demostración: `useSupabaseTable`
 * no los usa nunca con base de datos conectada, ni siquiera si la consulta
 * falla (ver `deReserva` en `supabaseSync.ts`). Antes esta lista arrancaba
 * vacía y la tienda de la demostración salía sin un solo artículo, que se lee
 * como que está rota.
 */
export function useProductos(opciones?: { sinEspejo?: boolean }) {
  return useSupabaseTable<Producto>(
    'productos', CLAVES_DATOS.productos, PRODUCTOS_INICIALES,
    productoToRow, rowToProducto, 'codigo', opciones,
  )
}

/** Los descuentos por colectivo. */
export function useDescuentos(opciones?: { sinEspejo?: boolean }) {
  return useSupabaseTable<Descuento>(
    'descuentos', CLAVES_DATOS.descuentos, DESCUENTOS_INICIALES,
    descuentoToRow, rowToDescuento, 'nombre', opciones,
  )
}

/**
 * LO QUE SE HA VENDIDO. Solo lectura, y por eso no es `useSupabaseTable`.
 *
 * Ese hook está hecho para tablas que la pantalla edita: guarda una copia en el
 * navegador y la sincroniza en los dos sentidos. Las ventas no se editan nunca
 * —se registran con una función y se anulan con otra—, así que una copia local
 * solo serviría para enseñar un total que ya no es el de la base.
 */
export function useVentas(): { ventas: Venta[]; cargando: boolean; recargar: () => void } {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [cargando, setCargando] = useState(true)
  const [vez, setVez] = useState(0)

  useEffect(() => {
    // Sin base de datos las ventas viven en el navegador: es la demostración.
    if (tiendaEnLocal()) { setVentas(ventasLocales()); setCargando(false); return }
    if (!isSupabaseConfigured || !supabase) { setCargando(false); return }
    let cancelado = false
    setCargando(true)
    void supabase
      .from('ventas')
      .select('*')
      .order('fecha', { ascending: false })
      .then(({ data, error }) => {
        if (cancelado) return
        // `supabase-js` no lanza: devuelve `{ error }` y sigue. Sin mirarlo,
        // un fallo de permisos dejaría la pantalla en «no hay ventas», que es
        // una respuesta muy distinta de «no se ha podido preguntar».
        if (error) avisarDeFallo('ventas', error.message)
        setVentas(error || !data ? [] : (data as Record<string, unknown>[]).map(rowToVenta))
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [vez])

  return { ventas, cargando, recargar: () => setVez((v) => v + 1) }
}

/**
 * UNA VENTA SUELTA, por su identificador.
 *
 * La usa la caja para enseñar la factura de lo que se acaba de cobrar. Se
 * trae de la base en vez de armarla con lo que la pantalla ya tiene a mano,
 * que sería más rápido: los importes de la factura tienen que ser los que
 * QUEDARON GUARDADOS, no los que la pantalla creía estar cobrando. Si algún
 * día los dos números dejan de coincidir, quiero que se vea en la factura y
 * no que la pantalla tape el descuadre enseñando su propia cuenta.
 */
export async function traerVenta(ventaId: string): Promise<Venta | null> {
  if (tiendaEnLocal()) return ventaLocalPorId(ventaId)
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.from('ventas').select('*').eq('id', ventaId).maybeSingle()
  if (error || !data) {
    if (error) avisarDeFallo('la venta', error.message)
    return null
  }
  return rowToVenta(data as Record<string, unknown>)
}

/**
 * Las líneas de una venta, para la factura y para el detalle.
 *
 * DEVUELVE `null` CUANDO NO SE HAN PODIDO TRAER, y no una lista vacía. La
 * diferencia decide lo que se imprime: sin líneas no hay desglose de IVA, y
 * una factura sin desglose no le sirve a quien la recibe ni a quien la emite.
 * Devolviendo `[]` en los dos casos, un fallo de red producía un A4 con
 * membrete, número de factura, NIF y total, sin un solo artículo y sin base ni
 * cuota — con toda la pinta de un documento bueno.
 */
export async function lineasDeVenta(ventaId: string): Promise<LineaVenta[] | null> {
  if (tiendaEnLocal()) return lineasLocalesDe(ventaId)
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.from('lineas_venta').select('*').eq('venta_id', ventaId)
  if (error || !data) {
    if (error) avisarDeFallo('líneas de la venta', error.message)
    return null
  }
  return (data as Record<string, unknown>[]).map(rowToLineaVenta)
}

/**
 * El historial de un artículo: por qué subió y bajó su stock.
 *
 * `null` cuando no se ha podido preguntar, y lista vacía cuando de verdad no
 * se ha movido nada. Con `[]` para las dos cosas, un fallo de permisos decía
 * «todavía no se ha movido nada» sobre un artículo con veinte movimientos.
 */
export async function historialDeStock(productoId: string): Promise<MovimientoStock[] | null> {
  if (tiendaEnLocal()) return historialLocalDe(productoId)
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase
    .from('movimientos_stock').select('*').eq('producto_id', productoId)
    .order('fecha', { ascending: false })
  if (error || !data) {
    if (error) avisarDeFallo('historial del artículo', error.message)
    return null
  }
  return (data as Record<string, unknown>[]).map(rowToMovimientoStock)
}

/** Lo que devuelve la base al cobrar. */
export interface VentaRegistrada {
  id: string
  serie: string
  numero: number
  base: number
  iva: number
  total: number
  coste: number
  descuentoPct: number
}

export interface DatosDeVenta {
  lineas: LineaCesta[]
  canal: CanalVenta
  formaPago: string
  hermanoId?: string | null
  descuentoId?: string | null
  /**
   * El porcentaje que la pantalla está enseñando.
   *
   * CON BASE DE DATOS NO SE MANDA, a propósito: quien decide si a este hermano
   * le toca el 50 % de costaleros es `registrar_venta`, mirando las etiquetas
   * de su ficha. Aceptarlo desde el navegador sería dejar que cualquiera con
   * la consola abierta se aplicara el descuento que quisiera.
   *
   * Hace falta solo en la demostración, donde no hay base que lo decida.
   */
  descuentoPct?: number
  compradorNombre?: string
  compradorNif?: string
  compradorDireccion?: string
  notas?: string
  serie?: string
}

/**
 * COBRAR. Devuelve la factura, o el porqué de que no se haya podido.
 *
 * El mensaje de la base se devuelve TAL CUAL y sin traducir: los que puede dar
 * están escritos para que los lea quien está en el mostrador con la cola
 * esperando —«No quedan suficientes Camiseta: hay 2 y se piden 3»—, y
 * cambiarlos aquí por un «no se pudo completar la operación» sería quitarle la
 * única pista que tiene.
 */
export async function registrarVenta(d: DatosDeVenta): Promise<
  { ok: true; venta: VentaRegistrada } | { ok: false; error: string }
> {
  if (tiendaEnLocal()) return registrarVentaLocal({ ...d, descuentoPct: d.descuentoPct ?? 0 })
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Sin base de datos conectada no se pueden registrar ventas.' }
  }
  if (d.lineas.length === 0) return { ok: false, error: 'No has puesto nada en la cesta.' }

  /*
   * Se manda el precio a mano SOLO si de verdad se ha tocado. Mandándolo
   * siempre —calculado aquí con el descuento— la base dejaría de aplicar el
   * suyo, y entonces el descuento no lo estaría comprobando nadie: cualquiera
   * con la consola abierta se pondría el 50 % de costaleros sin serlo.
   */
  const lineas = d.lineas.map((l) => ({
    producto_id: l.producto.id,
    cantidad: l.cantidad,
    ...(l.precioAMano != null ? { precio_unitario: l.precioAMano } : {}),
  }))

  try {
    const { data, error } = await supabase.rpc('registrar_venta', {
      p_lineas: lineas,
      p_canal: d.canal,
      p_forma_pago: d.formaPago,
      p_hermano_id: d.hermanoId ?? null,
      p_descuento_id: d.descuentoId ?? null,
      p_comprador_nombre: d.compradorNombre ?? '',
      p_comprador_nif: d.compradorNif ?? '',
      p_comprador_direccion: d.compradorDireccion ?? '',
      p_notas: d.notas ?? '',
      p_serie: d.serie ?? 'A',
    })
    if (error) return { ok: false, error: error.message }
    const r = (data ?? {}) as Record<string, unknown>
    return {
      ok: true,
      venta: {
        id: String(r.id ?? ''),
        serie: String(r.serie ?? 'A'),
        numero: Number(r.numero ?? 0),
        base: Number(r.base ?? 0),
        iva: Number(r.iva ?? 0),
        total: Number(r.total ?? 0),
        coste: Number(r.coste ?? 0),
        descuentoPct: Number(r.descuento_pct ?? 0),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido cobrar.' }
  }
}

/**
 * Mover género sin que haya venta: una entrada del proveedor, algo que se
 * rompe, un ajuste tras contar el almacén.
 */
export async function moverStock(
  productoId: string,
  tipo: TipoMovimientoStock,
  cantidad: number,
  motivo = '',
  /** Hace falta solo en la demostración, para el nombre en los mensajes. */
  producto?: Producto,
  /**
   * Bajar el género por debajo de lo que la web ya tiene apartado. Se pide
   * expresamente y en un segundo intento: la primera vez se para y se dice con
   * quién choca, para que quien apunta la rotura sepa a quién va a dejar sin
   * su reserva.
   */
  aunqueEsteApartado = false,
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  if (tiendaEnLocal()) {
    const p = producto ?? leerPersistido<Producto[]>(CLAVES_DATOS.productos, PRODUCTOS_INICIALES)
      .find((x) => x.id === productoId)
    if (!p) return { ok: false, error: 'Ese artículo ya no está en el catálogo.' }
    return moverStockLocal(p, tipo, cantidad, motivo, aunqueEsteApartado)
  }
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Sin base de datos conectada no se puede mover el almacén.' }
  }
  try {
    const { data, error } = await supabase.rpc('mover_stock', {
      p_producto_id: productoId,
      p_tipo: tipo,
      p_cantidad: cantidad,
      p_motivo: motivo,
      p_aunque_este_apartado: aunqueEsteApartado,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, stock: Number(data ?? 0) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido mover el almacén.' }
  }
}

/**
 * Anular una venta: el género vuelve y los asientos se contra-apuntan.
 *
 * La factura NO se borra y su número se queda ocupado: una numeración con
 * huecos es lo primero que mira una inspección.
 */
export async function anularVenta(ventaId: string, motivo = ''): Promise<{ ok: boolean; error?: string }> {
  if (tiendaEnLocal()) return anularVentaLocal(ventaId, motivo)
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Sin base de datos conectada no se puede anular.' }
  }
  try {
    const { data, error } = await supabase.rpc('anular_venta', { p_venta_id: ventaId, p_motivo: motivo })
    if (error) return { ok: false, error: error.message }
    // `false` = ya estaba anulada. No es un error, pero tampoco es lo que la
    // pantalla iba a anunciar: el género NO ha vuelto al almacén otra vez.
    if (data !== true) {
      return { ok: false, error: 'Esa factura ya estaba anulada. Recarga para ver cómo está.' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido anular.' }
  }
}

/** El total de una cesta tal como lo va a cobrar la base, para enseñarlo al teclear. */
export function loQueSeVaACobrar(lineas: LineaCesta[], descuentoPct: number): number {
  return lineas.reduce(
    (n, l) => n + precioDeLineaCent(l.producto, descuentoPct, l.precioAMano) * l.cantidad,
    0,
  ) / 100
}

// ----------------------------------------------------------------------------
//   LAS RESERVAS DE LA WEB
// ----------------------------------------------------------------------------

/**
 * EL CATÁLOGO QUE VE QUIEN ENTRA EN LA WEB, sin cuenta de ninguna clase.
 *
 * Va por SLUG y no por identificador porque el slug es lo que hay en la barra
 * de direcciones. Y no lee la tabla: llama a `catalogo_web()`, que devuelve
 * uno a uno los campos que ya salen impresos en la página. Leer `productos`
 * directamente traería el `coste` dentro, y lo que la hermandad paga por cada
 * medalla no es asunto de quien pasa por la web.
 */
export function useCatalogoWeb(slug: string): { articulos: ArticuloWeb[]; cargando: boolean; recargar: () => void } {
  const [articulos, setArticulos] = useState<ArticuloWeb[]>([])
  const [cargando, setCargando] = useState(true)
  const [vez, setVez] = useState(0)

  useEffect(() => {
    /*
     * SIN BASE DE DATOS —modo local, y la vista previa del panel de quien
     * todavía no la ha conectado— el catálogo sale de lo guardado en el
     * navegador. Sin esto, montar la web en local enseñaba una tienda vacía
     * aunque hubiera artículos dados de alta, y no había forma de ver cómo
     * quedaba la sección antes de conectar nada.
     *
     * `disponible` es aquí el stock a secas: sin base no hay reservas que
     * descontar, porque tampoco se puede reservar.
     */
    if (!isSupabaseConfigured || !supabase) {
      // Y el descuento del hermano que esté navegando, igual que hace
      // `catalogo_web` con la sesión: sin esto, la demostración enseñaría una
      // tienda que no se parece a la de verdad justo en lo que se ve.
      const suyo = descuentoDelHermanoLocal()
      setArticulos(
        // Con los de ejemplo por defecto, igual que `useProductos`: si no, la
        // tienda de la web salía vacía en la demostración aunque el panel
        // enseñara seis artículos.
        leerPersistido<Producto[]>(CLAVES_DATOS.productos, PRODUCTOS_INICIALES)
          .filter((p) => p.activo && p.visibleEnWeb)
          .map((p) => ({
            id: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio: p.precio,
            iva: p.iva,
            fotoUrl: p.fotoUrl,
            // Lo que se puede prometer, no lo que hay en la estantería: el
            // stock menos lo ya apartado y sin recoger. Es lo mismo que
            // devuelve `catalogo_web()`.
            disponible: Math.max(0, p.stock - apartadoDe(p.id)),
            // Con `precioDeLineaCent`, que es la misma cuenta que aplica la
            // caja: si aquí saliera un céntimo distinto, la web habría mentido.
            precioHermano: suyo ? precioDeLineaCent(p, suyo.porcentaje, null) / 100 : undefined,
            descuentoPct: suyo?.porcentaje,
          })),
      )
      setCargando(false)
      return
    }
    if (!slug) { setCargando(false); return }
    let cancelado = false
    setCargando(true)
    void supabase.rpc('catalogo_web', { p_slug: slug }).then(({ data, error }) => {
      if (cancelado) return
      if (error) avisarDeFallo('catálogo de la tienda', error.message)
      setArticulos(error || !data ? [] : (data as Record<string, unknown>[]).map(rowToArticuloWeb))
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [slug, vez])

  return { articulos, cargando, recargar: () => setVez((v) => v + 1) }
}

/** Lo que se le enseña a quien acaba de apartar algo. */
export interface ResguardoReserva {
  referencia: string
  total: number
  recogerAntesDe: string
}

export interface DatosDeReserva {
  slug: string
  lineas: LineaReservaWeb[]
  nombre: string
  email?: string
  telefono?: string
  notas?: string
}

/**
 * APARTAR DESDE LA WEB.
 *
 * Solo se mandan el artículo y la cantidad. EL PRECIO NO VIAJA: lo pone la
 * base al escribir la línea. Mandándolo desde aquí, cualquiera con la consola
 * abierta apartaría la medalla de cuarenta euros por cero — y como quien
 * reserva no tiene sesión, no hay ninguna otra puerta donde pararlo.
 *
 * El mensaje de la base se devuelve tal cual: los que puede dar están escritos
 * para leerlos en pantalla («De "Medalla" ya solo quedan 2 sin apartar»), y
 * cambiarlos por un «no se ha podido» sería quitarle a esa persona la única
 * pista de qué hacer.
 */
export async function reservarEnLaWeb(d: DatosDeReserva): Promise<
  { ok: true; resguardo: ResguardoReserva } | { ok: false; error: string }
> {
  if (tiendaEnLocal()) return reservarEnLaWebLocal(d)
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'La tienda de esta web todavía no está conectada.' }
  }
  if (d.lineas.length === 0) return { ok: false, error: 'No has apartado nada.' }
  if (!d.nombre.trim()) return { ok: false, error: 'Hace falta un nombre para poder llamarte.' }

  try {
    const { data: hermandad, error: eh } = await supabase.rpc('hermandad_de_la_tienda', { p_slug: d.slug })
    if (eh) return { ok: false, error: eh.message }
    if (!hermandad) return { ok: false, error: 'Esta hermandad no tiene tienda publicada.' }

    const { data, error } = await supabase.rpc('crear_reserva_web', {
      p_hermandad_id: hermandad,
      p_lineas: d.lineas.map((l) => ({ producto_id: l.articulo.id, cantidad: l.cantidad })),
      p_nombre: d.nombre.trim(),
      p_email: d.email?.trim() ?? '',
      p_telefono: d.telefono?.trim() ?? '',
      p_notas: d.notas?.trim() ?? '',
    })
    if (error) return { ok: false, error: error.message }
    const r = (data ?? {}) as Record<string, unknown>
    const referencia = String(r.referencia ?? '')

    /*
     * Y SE LE MANDA EL RESGUARDO, sin esperarlo y sin que pueda tumbar nada.
     * La reserva ya está hecha: si el correo no sale, esta persona sigue
     * teniendo su referencia en pantalla, y avisarla de que «no se ha podido
     * mandar un correo» solo la asustaría con algo que no le afecta.
     *
     * Aquí NO va la dirección de nadie. Solo se dice qué reserva; el correo lo
     * lee el servidor de la fila que se acaba de crear. Mandándolo desde aquí,
     * esto sería una forma de enviarle a cualquiera un correo con el membrete
     * de la hermandad.
     */
    void supabase.functions
      .invoke('enviar-correo', { body: { reserva: { hermandadId: hermandad, referencia } } })
      .catch(() => {})

    return {
      ok: true,
      resguardo: {
        referencia,
        total: Number(r.total ?? 0),
        recogerAntesDe: String(r.recoger_antes_de ?? ''),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido apartar.' }
  }
}

/**
 * LO QUE DE VERDAD SE PUEDE VENDER DE CADA ARTÍCULO.
 *
 * `productos.stock` es lo que hay en la estantería. Eso no es lo que se puede
 * prometer: hay que descontar lo que la web ya tiene apartado y sin recoger.
 *
 * La vista `existencias_tienda` calcula justamente eso y estaba escrita desde
 * el primer día SIN QUE LA MIRARA NADIE — ni el mostrador, ni el almacén—. Este
 * hook es lo que la pone a trabajar.
 *
 * `disponible` PUEDE SER NEGATIVO, y entonces no es un error de cuentas: es que
 * se ha vendido algo que ya estaba prometido. En el panel se enseña tal cual,
 * en rojo, porque es exactamente lo que hay que ver.
 */
export type Existencia = { id: string; stock: number; reservado: number; disponible: number }

export function useExistencias(): { existencias: Map<string, Existencia>; recargar: () => void } {
  const [existencias, setExistencias] = useState<Map<string, Existencia>>(new Map())
  const [vez, setVez] = useState(0)

  useEffect(() => {
    if (tiendaEnLocal()) {
      const mapa = new Map<string, Existencia>()
      for (const p of leerPersistido<Producto[]>(CLAVES_DATOS.productos, PRODUCTOS_INICIALES)) {
        const reservado = apartadoDe(p.id)
        mapa.set(p.id, { id: p.id, stock: p.stock, reservado, disponible: p.stock - reservado })
      }
      setExistencias(mapa)
      return
    }
    if (!isSupabaseConfigured || !supabase) return
    let cancelado = false
    void supabase.from('existencias_tienda').select('id, stock, reservado, disponible')
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) { avisarDeFallo('existencias', error.message); return }
        const mapa = new Map<string, Existencia>()
        for (const f of (data ?? []) as Record<string, unknown>[]) {
          mapa.set(String(f.id), {
            id: String(f.id),
            stock: Number(f.stock ?? 0),
            reservado: Number(f.reservado ?? 0),
            disponible: Number(f.disponible ?? 0),
          })
        }
        setExistencias(mapa)
      })
    return () => { cancelado = true }
  }, [vez])

  return { existencias, recargar: () => setVez((v) => v + 1) }
}

/**
 * LO QUE HA ENTRADO HOY EN LA TIENDA.
 *
 * Va aparte de `useVentas()` a propósito. Ese pide `ventas` ENTERA y sin tope:
 * una hermandad con cinco años de besamanos son miles de filas, y traerlas
 * todas para poner un número en la cabecera —que se ve nada más abrir la
 * tienda, antes de cobrar nada— es hacer esperar a quien tiene la cola delante.
 *
 * Aquí se pregunta solo por las de hoy, y con la hora de aquí: `fecha` es un
 * `timestamptz`, así que el corte del día tiene que ser la medianoche LOCAL. Con
 * la medianoche UTC, en verano las ventas de después de las diez de la noche
 * contarían como del día siguiente y la caja de hoy saldría corta.
 */
export function useCajaDeHoy(): { total: number; ventas: number; recargar: () => void } {
  const [caja, setCaja] = useState({ total: 0, ventas: 0 })
  const [vez, setVez] = useState(0)

  useEffect(() => {
    const hoy = hoyIso()
    const cuentan = (v: Venta) => v.estado !== 'Anulada' && diaLocalDe(v.fecha) >= hoy

    if (tiendaEnLocal()) {
      const suyas = ventasLocales().filter(cuentan)
      setCaja({ total: suyas.reduce((n, v) => n + v.total, 0), ventas: suyas.length })
      return
    }
    if (!isSupabaseConfigured || !supabase) return
    let cancelado = false
    const [a, m, d] = hoy.split('-').map(Number)
    const desde = new Date(a, m - 1, d).toISOString()
    void supabase.from('ventas').select('total, estado').gte('fecha', desde)
      .then(({ data, error }) => {
        if (cancelado) return
        // Un fallo aquí NO se pinta como «hoy no se ha cobrado nada»: se deja
        // lo que hubiera y se avisa por el canal de siempre, que es el que
        // enciende la banda roja del marco.
        if (error) { avisarDeFallo('la caja de hoy', error.message); return }
        const suyas = (data ?? []).filter((f) => (f as { estado?: string }).estado !== 'Anulada')
        setCaja({
          total: suyas.reduce((n, f) => n + Number((f as { total?: unknown }).total ?? 0), 0),
          ventas: suyas.length,
        })
      })
    return () => { cancelado = true }
  }, [vez])

  return { ...caja, recargar: () => setVez((v) => v + 1) }
}

/** Lo que ha apartado la gente. Solo lectura, como las ventas y por lo mismo. */
export function useReservas(): { reservas: Reserva[]; cargando: boolean; recargar: () => void } {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [cargando, setCargando] = useState(true)
  const [vez, setVez] = useState(0)

  useEffect(() => {
    if (tiendaEnLocal()) { setReservas(reservasLocales()); setCargando(false); return }
    if (!isSupabaseConfigured || !supabase) { setCargando(false); return }
    let cancelado = false
    setCargando(true)
    void supabase.from('reservas_tienda').select('*').order('creado_en', { ascending: false })
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) avisarDeFallo('reservas', error.message)
        setReservas(error || !data ? [] : (data as Record<string, unknown>[]).map(rowToReserva))
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [vez])

  return { reservas, cargando, recargar: () => setVez((v) => v + 1) }
}

/** Lo que lleva dentro una reserva. `null` = no se ha podido preguntar. */
export async function lineasDeReserva(reservaId: string): Promise<LineaReserva[] | null> {
  if (tiendaEnLocal()) return lineasDeReservaLocal(reservaId)
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.from('lineas_reserva').select('*').eq('reserva_id', reservaId)
  if (error || !data) {
    if (error) avisarDeFallo('líneas de la reserva', error.message)
    return null
  }
  return (data as Record<string, unknown>[]).map(rowToLineaReserva)
}

/**
 * COBRAR Y ENTREGAR. Aquí es donde la reserva se convierte en venta: sale la
 * factura, baja el almacén y entran los dos asientos en Tesorería. Ni un
 * minuto antes.
 */
export async function entregarReserva(reservaId: string, formaPago: string): Promise<
  { ok: true; venta: VentaRegistrada } | { ok: false; error: string }
> {
  if (tiendaEnLocal()) return entregarReservaLocal(reservaId, formaPago)
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Sin base de datos conectada no se pueden entregar reservas.' }
  }
  try {
    const { data, error } = await supabase.rpc('entregar_reserva', {
      p_reserva_id: reservaId, p_forma_pago: formaPago,
    })
    if (error) return { ok: false, error: error.message }
    const r = (data ?? {}) as Record<string, unknown>
    return {
      ok: true,
      venta: {
        id: String(r.id ?? ''),
        serie: String(r.serie ?? 'A'),
        numero: Number(r.numero ?? 0),
        base: Number(r.base ?? 0),
        iva: Number(r.iva ?? 0),
        total: Number(r.total ?? 0),
        coste: Number(r.coste ?? 0),
        descuentoPct: Number(r.descuento_pct ?? 0),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido entregar.' }
  }
}

/**
 * Soltar una reserva que no se va a recoger. No se borra: se marca, y el
 * género vuelve a estar disponible. Una reserva borrada es una llamada de
 * teléfono que nadie puede explicar.
 *
 * SE MIRA LO QUE CONTESTA, no solo si hubo error. La función devuelve `false`
 * cuando no ha soltado nada —porque ya estaba entregada, o porque otro la
 * anuló desde el ordenador de al lado hace un segundo—, y eso NO llega como
 * error: llega como un `false` que, sin mirarlo, la pantalla enseñaría como
 * «anulada, el género vuelve a estar disponible».
 */
/**
 * «TU RESERVA ESTÁ LISTA».
 *
 * Lo que faltaba del circuito y lo que más se nota: quien aparta algo por la web
 * recibe su resguardo y luego NO VUELVE A SABER NADA. Si el género hay que
 * pedirlo, o hay que grabar la medalla, la persona se planta un martes por la
 * tarde a por algo que todavía no está.
 *
 * Lo dispara una persona desde el panel y no un reloj: quien prepara la reserva
 * es quien sabe que está lista. Y llega por dos sitios porque los dos hacen
 * falta — el aviso en su área del hermano queda escrito aunque el correo se
 * pierda, y el correo es lo único que le llega a quien no es hermano.
 *
 * EL CORREO SE MANDA «A VER SI SUENA», sin esperarlo y sin que su fallo estropee
 * nada: la reserva ya ha quedado marcada como lista y el aviso del área ya está
 * puesto. Es lo mismo que hace `reservarEnLaWeb` con el resguardo.
 */
export async function avisarReservaLista(reservaId: string): Promise<
  { ok: true; hayCorreo: boolean; esHermano: boolean; yaAvisada: boolean } | { ok: false; error: string }
> {
  if (tiendaEnLocal()) return avisarReservaListaLocal(reservaId)
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Sin base de datos conectada no se puede avisar.' }
  }
  try {
    const { data, error } = await supabase.rpc('avisar_reserva_lista', { p_reserva_id: reservaId })
    if (error) return { ok: false, error: error.message }
    const r = (data ?? {}) as Record<string, unknown>
    const yaAvisada = r.ya_avisada === true
    const hayCorreo = r.hay_correo === true

    if (hayCorreo && !yaAvisada) {
      void supabase.functions
        .invoke('enviar-correo', {
          body: { reservaLista: { hermandadId: r.hermandad_id, referencia: r.referencia } },
        })
        .catch(() => {})
    }
    return { ok: true, hayCorreo, esHermano: r.es_hermano === true, yaAvisada }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido avisar.' }
  }
}

export async function soltarReserva(
  reservaId: string, motivo = '', estado: 'anulada' | 'caducada' = 'anulada',
): Promise<{ ok: boolean; error?: string }> {
  if (tiendaEnLocal()) return soltarReservaLocal(reservaId, estado)
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Sin base de datos conectada no se pueden soltar reservas.' }
  }
  try {
    const { data, error } = await supabase.rpc('soltar_reserva', {
      p_reserva_id: reservaId, p_motivo: motivo, p_estado: estado,
    })
    if (error) return { ok: false, error: error.message }
    if (data !== true) {
      return {
        ok: false,
        error: 'Esa reserva ya no estaba pendiente: puede que la acaben de entregar o de anular. '
          + 'Recarga para ver cómo está.',
      }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido soltar.' }
  }
}


// ----------------------------------------------------------------------------
//   LOS DATOS, PARA LAS GRÁFICAS
// ----------------------------------------------------------------------------

/**
 * Lo vendido en un ejercicio, ya sumado por la base.
 *
 * Una sola llamada que devuelve los tres bloques —meses, artículos y formas de
 * pago—, cada uno separado por canal. Se suma allí y no aquí porque para saber
 * qué artículo se vende más hay que recorrer TODAS las líneas del año, y
 * bajarlas por la red para sumarlas en una tabla de doce filas es tirar los
 * datos de quien mira esto desde el teléfono. El porqué entero está en
 * `datos_tienda()`, en `supabase/tienda.sql`.
 */
export function useDatosTienda(anio: number): {
  datos: DatosTienda | null
  cargando: boolean
  error: string
  recargar: () => void
} {
  const [datos, setDatos] = useState<DatosTienda | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [vez, setVez] = useState(0)

  useEffect(() => {
    // En la demostración se cuenta lo vendido en el navegador. Sin esto, la
    // pantalla decía «no hay datos» justo después de cobrar tres facturas.
    if (tiendaEnLocal()) {
      setDatos(datosTiendaLocales(anio))
      setCargando(false)
      setError('')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setCargando(false)
      setError('Sin base de datos conectada no hay datos de la tienda que enseñar.')
      return
    }
    let cancelado = false
    setCargando(true)
    setError('')
    void supabase.rpc('datos_tienda', { p_anio: anio }).then(({ data, error: e }) => {
      if (cancelado) return
      setCargando(false)
      if (e) {
        /*
         * El fallo SE ENSEÑA, no se deja en la consola. Esta pantalla es toda
         * cifras: quedándose en blanco con «0,00 €» por todas partes, quien
         * viene a cuadrar el trimestre lee ceros creíbles.
         */
        avisarDeFallo('datos de la tienda', e.message)
        setError(e.message)
        setDatos(null)
        return
      }
      const d = (data ?? {}) as Record<string, unknown>
      setDatos({
        anio: Number(d.anio ?? anio),
        anios: Array.isArray(d.anios) ? (d.anios as unknown[]).map(Number) : [],
        meses: (Array.isArray(d.meses) ? d.meses : []).map((m) => {
          const r = m as Record<string, unknown>
          return {
            mes: Number(r.mes ?? 0),
            canal: (r.canal === 'online' ? 'online' : 'fisica') as CanalVenta,
            total: Number(r.total ?? 0),
            base: Number(r.base ?? 0),
            iva: Number(r.iva ?? 0),
            coste: Number(r.coste ?? 0),
            ventas: Number(r.ventas ?? 0),
          }
        }),
        articulos: (Array.isArray(d.articulos) ? d.articulos : []).map((a) => {
          const r = a as Record<string, unknown>
          return {
            codigo: String(r.codigo ?? ''),
            nombre: String(r.nombre ?? ''),
            canal: (r.canal === 'online' ? 'online' : 'fisica') as CanalVenta,
            unidades: Number(r.unidades ?? 0),
            importe: Number(r.importe ?? 0),
            coste: Number(r.coste ?? 0),
          }
        }),
        formas: (Array.isArray(d.formas) ? d.formas : []).map((f) => {
          const r = f as Record<string, unknown>
          return {
            forma: String(r.forma ?? ''),
            canal: (r.canal === 'online' ? 'online' : 'fisica') as CanalVenta,
            total: Number(r.total ?? 0),
            ventas: Number(r.ventas ?? 0),
          }
        }),
      })
    })
    return () => { cancelado = true }
  }, [anio, vez])

  return { datos, cargando, error, recargar: () => setVez((v) => v + 1) }
}
