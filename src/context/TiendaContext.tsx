/**
 * LO QUE COMPARTEN LAS CINCO PESTAÑAS DE LA TIENDA.
 *
 * Antes eran cinco pantallas sueltas, y cada una montaba su propia copia de lo
 * que necesitaba: el catálogo se pedía DOS VECES —la caja y el almacén—, los
 * ajustes de la hermandad otras dos, y el censo… el censo no se pedía, se leía
 * de la copia del navegador, así que la caja de una hermandad recién montada
 * ofrecía como compradores a los hermanos de ejemplo.
 *
 * Aquí se monta una sola vez y lo ven las cinco. Cambiar de pestaña deja de
 * relanzar consultas, que es la mitad de que esto se sienta rápido.
 *
 * LO QUE NO ESTÁ AQUÍ, Y POR QUÉ. Las ventas (`useVentas`) piden la tabla
 * entera sin tope, y las reservas y los datos del ejercicio solo hacen falta en
 * su pestaña. Traerlos al abrir la caja sería pagar tres consultas grandes para
 * cobrar una camiseta. Cada uno vive en su panel, y solo se pide cuando esa
 * pestaña se visita por primera vez.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useSupabaseTable } from '../lib/supabaseSync'
import { CLAVES_DATOS } from '../lib/persistencia'
import { hermanoToRow, rowToHermano } from '../lib/db/hermanos'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'
import { useHermandadSettings } from '../lib/hermandadSettings'
import { useDescuentos, useExistencias, useProductos, type Existencia } from '../lib/tienda'
import { agotado, quedaPoco, type Descuento, type Producto } from '../data/tienda'
import type { HermandadSettings } from '../lib/hermandadSettings'

type Fijar<T> = (accion: T[] | ((prev: T[]) => T[])) => void

interface TiendaContextValue {
  productos: Producto[]
  setProductos: Fijar<Producto>
  descuentos: Descuento[]
  setDescuentos: Fijar<Descuento>
  hermanos: Hermano[]
  hermandad: HermandadSettings
  /** Lo que se puede prometer de cada artículo: el stock menos lo apartado. */
  existencias: Map<string, Existencia>
  recargarExistencias: () => void
  /** Cuántos artículos hay por debajo de su mínimo y cuántos a cero. */
  bajoMinimo: number
  agotados: number
}

const Ctx = createContext<TiendaContextValue | null>(null)

export function TiendaProvider({ children }: { children: ReactNode }) {
  const [productos, setProductos] = useProductos()
  const [descuentos, setDescuentos] = useDescuentos()
  const hermandad = useHermandadSettings()
  const { existencias, recargar: recargarExistencias } = useExistencias()

  /*
   * EL CENSO, DE LA TABLA Y NO DE LA COPIA DEL NAVEGADOR.
   *
   * La caja hacía `leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)`, que
   * lee lo que haya guardado en este ordenador y, si no hay nada, DEVUELVE LOS
   * DE EJEMPLO. En una hermandad recién montada, «Quién compra» ofrecía a
   * Manuel Ruiz Delgado y compañía, que no existen; y en una ventana privada,
   * donde no hay copia, tampoco salía el censo de verdad.
   *
   * Con el hook la lista sale de `hermanos`, con su RLS, y de paso llegan las
   * ETIQUETAS —costalero, coro—, que son las que deciden qué descuento se le
   * puede ofrecer a quien está comprando.
   */
  const [hermanos] = useSupabaseTable<Hermano>(
    'hermanos', CLAVES_DATOS.hermanos, HERMANOS_INICIALES,
    hermanoToRow, rowToHermano, 'numero',
  )

  const { bajoMinimo, agotados } = useMemo(() => {
    const activos = productos.filter((p) => p.activo)
    return {
      bajoMinimo: activos.filter(quedaPoco).length,
      agotados: activos.filter(agotado).length,
    }
  }, [productos])

  const valor = useMemo<TiendaContextValue>(() => ({
    productos, setProductos, descuentos, setDescuentos, hermanos, hermandad,
    existencias, recargarExistencias, bajoMinimo, agotados,
  }), [
    productos, setProductos, descuentos, setDescuentos, hermanos, hermandad,
    existencias, recargarExistencias, bajoMinimo, agotados,
  ])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTienda(): TiendaContextValue {
  const v = useContext(Ctx)
  // No se devuelve un objeto vacío «por si acaso»: un panel de la tienda fuera
  // de su pantalla es un error de montaje, y taparlo con datos falsos lo
  // convierte en «la caja sale vacía» tres semanas después.
  if (!v) throw new Error('Los paneles de la tienda van dentro de <TiendaProvider>.')
  return v
}

/**
 * Lo que de verdad se puede vender de un artículo.
 *
 * Si la vista de existencias todavía no ha contestado, manda el stock de la
 * ficha: es lo que había antes de todo esto y nunca es MENOS que lo real, así
 * que como mucho la base para la venta un segundo después. Al revés —enseñar 0
 * mientras carga— apagaría todos los artículos de la caja al abrirla.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function disponibleDe(existencias: Map<string, Existencia>, p: Producto): number {
  return existencias.get(p.id)?.disponible ?? p.stock
}

/** Cuántas unidades tiene apartadas la web. */
// eslint-disable-next-line react-refresh/only-export-components
export function apartadasDe(existencias: Map<string, Existencia>, p: Producto): number {
  return existencias.get(p.id)?.reservado ?? 0
}
