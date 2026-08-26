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
import { CLAVES_DATOS } from './persistencia'
import { isSupabaseConfigured, supabase } from './supabase'
import {
  descuentoToRow, productoToRow, rowToDescuento, rowToLineaVenta,
  rowToMovimientoStock, rowToProducto, rowToVenta,
} from './db/tienda'
import type {
  CanalVenta, Descuento, LineaCesta, LineaVenta, MovimientoStock, Producto,
  TipoMovimientoStock, Venta,
} from '../data/tienda'
import { precioDeLinea } from '../data/tienda'

/** El catálogo de la hermandad. Lo edita quien lleva el inventario. */
export function useProductos(opciones?: { sinEspejo?: boolean }) {
  return useSupabaseTable<Producto>(
    'productos', CLAVES_DATOS.productos, [], productoToRow, rowToProducto, 'codigo', opciones,
  )
}

/** Los descuentos por colectivo. */
export function useDescuentos(opciones?: { sinEspejo?: boolean }) {
  return useSupabaseTable<Descuento>(
    'descuentos', CLAVES_DATOS.descuentos, [], descuentoToRow, rowToDescuento, 'nombre', opciones,
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
        if (error) console.error('No se pudieron traer las ventas:', error.message)
        setVentas(error || !data ? [] : (data as Record<string, unknown>[]).map(rowToVenta))
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [vez])

  return { ventas, cargando, recargar: () => setVez((v) => v + 1) }
}

/** Las líneas de una venta, para la factura y para el detalle. */
export async function lineasDeVenta(ventaId: string): Promise<LineaVenta[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase.from('lineas_venta').select('*').eq('venta_id', ventaId)
  if (error || !data) {
    if (error) console.error('No se pudieron traer las líneas de la venta:', error.message)
    return []
  }
  return (data as Record<string, unknown>[]).map(rowToLineaVenta)
}

/** El historial de un artículo: por qué subió y bajó su stock. */
export async function historialDeStock(productoId: string): Promise<MovimientoStock[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('movimientos_stock').select('*').eq('producto_id', productoId)
    .order('fecha', { ascending: false })
  if (error || !data) {
    if (error) console.error('No se pudo traer el historial del artículo:', error.message)
    return []
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
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Sin base de datos conectada no se puede mover el almacén.' }
  }
  try {
    const { data, error } = await supabase.rpc('mover_stock', {
      p_producto_id: productoId, p_tipo: tipo, p_cantidad: cantidad, p_motivo: motivo,
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
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Sin base de datos conectada no se puede anular.' }
  }
  try {
    const { error } = await supabase.rpc('anular_venta', { p_venta_id: ventaId, p_motivo: motivo })
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido anular.' }
  }
}

/** El total de una cesta tal como lo va a cobrar la base, para enseñarlo al teclear. */
export function loQueSeVaACobrar(lineas: LineaCesta[], descuentoPct: number): number {
  return lineas.reduce(
    (n, l) => n + Math.round(precioDeLinea(l.producto, descuentoPct, l.precioAMano) * 100) * l.cantidad,
    0,
  ) / 100
}
