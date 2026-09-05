/**
 * EL MOSTRADOR.
 *
 * Se teclea o se pulsa lo que lleva la persona, se dice quién es y cómo paga, y
 * se cobra. De ahí sale la factura, el género sale del almacén y los dos
 * asientos entran en Tesorería.
 *
 * ESTÁ PENSADA PARA UNA COLA, y eso manda sobre todo lo demás:
 *
 *   · el buscador tiene el foco desde el principio,
 *   · pulsar un artículo lo añade sin abrir nada,
 *   · el total se ve siempre, grande, sin bajar,
 *   · y los errores se dicen enteros («solo hay 2»), no con un «no se pudo».
 *
 * EL TOTAL QUE SE VE AQUÍ ES EL QUE COBRA LA BASE. Lo calculan las mismas
 * cuentas (`data/tienda.ts`) que aplica `registrar_venta`, y hay pruebas de que
 * coinciden. Si se separaran, se le diría un precio a alguien y se le cobraría
 * otro.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Drawer from '../../../components/Drawer'
import FacturaTienda from '../../../components/FacturaTienda'
import { formatCurrency } from '../../../lib/format'
import { llano } from '../../../lib/buscar'
import { registrarVenta, lineasDeVenta, traerVenta, type VentaRegistrada } from '../../../lib/tienda'
import { apartadasDe, disponibleDe, useTienda } from '../../../context/TiendaContext'
import {
  FORMAS_PAGO, descuentosPara, loQueQuedaPorPoner, precioDeLinea, referenciaFactura, totalesDeCesta,
  type CanalVenta, type LineaCesta, type LineaVenta, type Producto, type Venta,
} from '../../../data/tienda'
import type { Pestana } from '../Tienda'

type Props = {
  avisar: (texto: string) => void
  acciones: (p: Pestana, nodo: React.ReactNode) => void
  /** Para que la caja de hoy de la cabecera suba en el momento de cobrar. */
  alCobrar: () => void
}

export default function PanelVender({ avisar, acciones, alCobrar }: Props) {
  const {
    productos: productosDeLaBase, descuentos, hermanos, hermandad,
    existencias, recargarExistencias,
  } = useTienda()

  const [cesta, setCesta] = useState<LineaCesta[]>([])
  const [query, setQuery] = useState('')
  const [hermanoId, setHermanoId] = useState('')
  const [descuentoId, setDescuentoId] = useState('')
  const [formaPago, setFormaPago] = useState<string>(FORMAS_PAGO[0])
  const [canal, setCanal] = useState<CanalVenta>('fisica')
  const [cobrando, setCobrando] = useState(false)
  const [error, setError] = useState('')
  const [ultima, setUltima] = useState<VentaRegistrada | null>(null)
  const [datosOpen, setDatosOpen] = useState(false)
  const [comprador, setComprador] = useState({ nombre: '', nif: '', direccion: '' })
  const buscador = useRef<HTMLInputElement>(null)
  const cobrandoRef = useRef(false)

  // Esta pestaña no pone nada en la cabecera: el botón que importa —cobrar—
  // está al final de la cesta, que es donde se mira al terminar.
  useEffect(() => { acciones('vender', null) }, [acciones])

  /*
   * LO QUE ESTA PANTALLA HA IDO BAJANDO AL COBRAR, aparte de lo que traen la
   * tabla y la vista de existencias. Ver el comentario largo en `cobrar`.
   *
   * De cada artículo se guardan DOS NÚMEROS Y SUS DOS ORIGINALES: el stock de
   * la estantería y lo que se puede vender. Y cada uno solo manda MIENTRAS SU
   * ORIGINAL SIGA DICIENDO LO MISMO que decía al cobrar.
   *
   * Esa condición es toda la gracia, y hacia los dos lados:
   *
   *   · Si llegan existencias nuevas —otro ha vendido, ha entrado género, ha
   *     entrado una reserva por la web—, el número de aquí se descarta y manda
   *     el de verdad. Sin eso, la pantalla se quedaría enseñando menos de lo que
   *     hay para siempre.
   *
   *   · Y si NO han llegado todavía —la consulta va por el camino—, se sigue
   *     descontando aquí, que es lo que impide meter en la cesta siguiente algo
   *     que se acaba de vender.
   *
   * La primera versión de esto descontaba las unidades ENCIMA del disponible
   * recién traído, sin comprobar si ya venían descontadas. Y venían: al cobrar
   * se recarga la vista. Así que cada venta bajaba el contador el doble —una
   * medalla vendida y dos menos en la tarjeta—, que es exactamente la clase de
   * número que hace que alguien deje de fiarse del almacén entero.
   */
  type Contado = { stock: number; stockBase: number; disp: number; dispBase: number }
  const [vendidoAqui, setVendidoAqui] = useState<Record<string, Contado>>({})
  const productos = useMemo(
    () => productosDeLaBase.map((p) => {
      const v = vendidoAqui[p.id]
      return v && v.stockBase === p.stock ? { ...p, stock: Math.max(0, v.stock) } : p
    }),
    [productosDeLaBase, vendidoAqui],
  )

  /*
   * LO QUE DE VERDAD SE PUEDE VENDER DE CADA ARTÍCULO.
   *
   * No es `p.stock`: hay que descontar lo que la web ya tiene apartado y sin
   * recoger. El mostrador miraba el stock a secas y vendía sin pestañear las dos
   * camisetas que alguien había reservado para pasar a por ellas el sábado; esa
   * persona venía con su resguardo y no había nada, y encima su reserva se
   * quedaba imposible de entregar.
   */
  function disponibleDeLaBase(p: Producto): number {
    const original = productosDeLaBase.find((x) => x.id === p.id) ?? p
    return disponibleDe(existencias, original)
  }
  function disponible(p: Producto): number {
    const v = vendidoAqui[p.id]
    const base = disponibleDeLaBase(p)
    return v && v.dispBase === base ? Math.max(0, v.disp) : base
  }

  /*
   * LA FACTURA DE LO QUE SE ACABA DE COBRAR, para poder dársela a quien está
   * delante. Se trae de la base —no se arma con lo que esta pantalla tenía en
   * la cesta— porque los importes de una factura tienen que ser los que
   * quedaron guardados. Si algún día no coincidieran, quiero que se vea.
   */
  const [facturaOpen, setFacturaOpen] = useState(false)
  const [factura, setFactura] = useState<{ venta: Venta; lineas: LineaVenta[] | null } | null>(null)
  const [traendo, setTraendo] = useState(false)

  async function verFactura(ventaId: string) {
    setTraendo(true)
    setFacturaOpen(true)
    const [venta, lineas] = await Promise.all([traerVenta(ventaId), lineasDeVenta(ventaId)])
    setTraendo(false)
    // Sin venta no se abre una factura vacía: se dice que no se ha podido
    // traer y se manda al listado, donde sigue estando.
    if (!venta) { setFactura(null); return }
    setFactura({ venta, lineas })
  }

  // El foco en el buscador desde el principio y después de cada cobro: con la
  // cola esperando, tener que pinchar en el campo antes de teclear es lo que
  // hace que la gente acabe apuntando en un papel.
  useEffect(() => { buscador.current?.focus() }, [])

  const hermano = hermanos.find((h) => h.id === hermanoId) ?? null

  /*
   * LOS DESCUENTOS QUE SE PUEDEN OFRECER. Si aquí se ofreciera de más, la venta
   * fallaría al cobrar y con la cola delante: quien de verdad lo decide es la
   * base (`registrar_venta`), y estas dos listas tienen que coincidir.
   */
  const aplicables = useMemo(
    () => descuentosPara(descuentos, hermano?.etiquetas, Boolean(hermano)),
    [descuentos, hermano],
  )
  // Si se cambia de comprador y el descuento que había puesto ya no le toca, se
  // quita solo. Dejarlo puesto haría que la venta fallara sin motivo visible.
  useEffect(() => {
    if (descuentoId && !aplicables.some((d) => d.id === descuentoId)) setDescuentoId('')
  }, [aplicables, descuentoId])

  const descuentoPct = aplicables.find((d) => d.id === descuentoId)?.porcentaje ?? 0
  const totales = useMemo(() => totalesDeCesta(cesta, descuentoPct), [cesta, descuentoPct])

  const encontrados = useMemo(() => {
    const q = llano(query.trim())
    const alaVenta = productos.filter((p) => p.activo)
    if (!q) return alaVenta.slice(0, 12)
    return alaVenta
      .filter((p) => llano(p.nombre).includes(q) || llano(p.codigo).includes(q))
      .slice(0, 12)
  }, [productos, query])

  /** Cuántas unidades más de este artículo caben en la cesta. */
  function cabenTodavia(p: Producto): number {
    const puestas = cesta.find((l) => l.producto.id === p.id)?.cantidad ?? 0
    return loQueQuedaPorPoner(disponible(p), puestas)
  }

  function anadir(p: Producto) {
    /*
     * NO SE DEJA METER MÁS DE LO QUE HAY. Antes se podía llenar la cesta con
     * cinco de un artículo del que quedaban dos, y el rechazo llegaba AL
     * COBRAR, con la persona delante y la cola detrás. La misma cuenta que ya
     * hacía la tienda de la web (`loQueQuedaPorPoner`), ahora también aquí.
     */
    if (cabenTodavia(p) <= 0) {
      const apartadas = apartadasDe(existencias, p)
      setError(
        apartadas > 0
          ? `De «${p.nombre}» no queda ninguna sin apartar: hay ${p.stock} y ${apartadas} están comprometidas por la web.`
          : `De «${p.nombre}» ya has puesto todo lo que hay.`,
      )
      return
    }
    setError('')
    setCesta((prev) => {
      const ya = prev.find((l) => l.producto.id === p.id)
      // Sumar en la misma línea y no añadir otra: dos líneas del mismo artículo
      // se leen como un error al repasar el ticket con el cliente delante.
      if (ya) return prev.map((l) => (l.producto.id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l))
      return [...prev, { producto: p, cantidad: 1 }]
    })
    setQuery('')
    buscador.current?.focus()
  }

  /**
   * Cambiar las unidades de una línea. Poner cero o menos la quita.
   *
   * SE LLAMA DESDE EL BOTÓN ✕, y desde el campo solo con un número escrito.
   * Al principio el campo llamaba aquí con `Math.round(Number(e.target.value))`
   * directamente, y en un `input type="number"` borrar el contenido da `''`,
   * que `Number` convierte en 0: la línea desaparecía. En el mostrador, con
   * cola, seleccionar el campo para cambiar 1 por 12 hacía desaparecer el
   * artículo antes de teclear el 1 —y con él el precio rebajado a mano, porque
   * ese `input` es no controlado y se desmonta con la línea—. Quitar es el
   * botón ✕, que para eso está.
   */
  function cambiarCantidad(id: string, cantidad: number) {
    setCesta((prev) =>
      cantidad <= 0
        ? prev.filter((l) => l.producto.id !== id)
        : prev.map((l) => (l.producto.id === id ? { ...l, cantidad } : l)),
    )
  }

  /**
   * LO QUE SE ESTÁ TECLEANDO EN EL CAMPO DE UNIDADES, mientras no sea un número
   * válido.
   *
   * Hace falta porque el campo es controlado: si al borrar el dígito el
   * componente vuelve a pintar la cantidad de antes, no hay forma de dejarlo
   * vacío para escribir otra cosa —el número reaparece bajo el cursor—. Aquí se
   * guarda el texto en crudo, se pinta ese, y en cuanto llega a ser un número
   * se manda a la cesta. Al salir del campo se olvida y vuelve a mandar la
   * cantidad de verdad, así que un campo dejado a medias no puede quedarse
   * enseñando algo que no es.
   */
  const [tecleando, setTecleando] = useState<Record<string, string>>({})

  function tecleanUnidades(p: Producto, texto: string) {
    setTecleando((t) => ({ ...t, [p.id]: texto }))
    const t = texto.trim()
    // Vacío, o un «-» a medio escribir: todavía no ha dicho nada.
    if (t === '' || t === '-') return
    const n = Math.round(Number(t))
    if (!Number.isFinite(n) || n < 1) return
    // Y tampoco por aquí se cuela un 99 de algo de lo que quedan 3: el campo
    // era la otra puerta por la que se pasaba el freno de arriba.
    const tope = disponible(p)
    if (n > tope) {
      setError(`De «${p.nombre}» solo se pueden vender ${tope}.`)
      cambiarCantidad(p.id, tope)
      setTecleando((t2) => ({ ...t2, [p.id]: String(tope) }))
      return
    }
    setError('')
    cambiarCantidad(p.id, n)
  }

  function sueltanElCampo(id: string) {
    setTecleando((t) => {
      const { [id]: _, ...resto } = t
      return resto
    })
  }

  function rebajar(id: string, texto: string) {
    const v = texto.trim() === '' ? null : Number(texto.replace(',', '.'))
    setCesta((prev) =>
      prev.map((l) =>
        l.producto.id === id
          ? { ...l, precioAMano: v != null && Number.isFinite(v) && v >= 0 ? v : null }
          : l,
      ),
    )
  }

  function vaciar() {
    setCesta([])
    setDescuentoId('')
    setHermanoId('')
    setComprador({ nombre: '', nif: '', direccion: '' })
    setError('')
    buscador.current?.focus()
  }

  async function cobrar() {
    if (cesta.length === 0) {
      setError('No has puesto nada en la cesta.')
      return
    }
    /*
     * LA GUARDA VA EN UN `useRef`, y esto es un arreglo de algo que estaba mal.
     *
     * El comentario que había aquí explicaba —correctamente— que mirar
     * `cobrando` del estado no basta, porque no cambia hasta el siguiente
     * pintado y un segundo clic dentro del mismo instante leería el mismo
     * `false`. Y a continuación el código hacía exactamente eso: `if (cobrando)
     * return`. Lo único que protegía de verdad era el `disabled` del botón.
     *
     * Un `ref` cambia en el acto, sin esperar a ningún pintado. Y aquí importa
     * porque detrás hay dos facturas emitidas y dos descuentos de género.
     */
    if (cobrandoRef.current) return
    cobrandoRef.current = true
    setCobrando(true)
    setError('')
    const r = await registrarVenta({
      lineas: cesta,
      canal,
      formaPago,
      hermanoId: hermanoId || null,
      descuentoId: descuentoId || null,
      // Solo lo usa la demostración: con base de datos, el porcentaje lo decide
      // ella mirando las etiquetas del hermano. Ver `DatosDeVenta`.
      descuentoPct,
      compradorNombre: comprador.nombre || hermano?.nombre || '',
      compradorNif: comprador.nif || hermano?.dni || '',
      compradorDireccion: comprador.direccion || hermano?.direccion || '',
    })
    cobrandoRef.current = false
    setCobrando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    /*
     * El almacén de la pantalla se baja también, para que la siguiente venta de
     * la cola vea lo que queda de verdad. Sin esto, con dos camisetas se
     * podrían meter tres en la cesta siguiente y el error saltaría al cobrar.
     *
     * PERO NO TOCANDO `productos`, y esto costó encontrarlo. `setProductos` no
     * es un `setState` normal: es el de `useSupabaseTable`, que sincroniza, y
     * manda a Supabase un `update` por cada fila cuyo JSON haya cambiado. O sea
     * que bajar el stock aquí disparaba, DESPUÉS DE CADA COBRO, un update de la
     * ficha entera —código, nombre, precio, coste, IVA…— de cada artículo de la
     * cesta, con los valores que este navegador tuviera en memoria. Y eso es un
     * último-que-escribe-gana con datos viejos: si desde el móvil se sube el
     * precio de la camiseta a 15 € mientras esta pestaña lleva abierta desde la
     * mañana con 12 €, la primera camiseta que se cobre aquí devuelve el precio
     * a 12 € en la base.
     *
     * Así que el descuento vive aparte, solo para pintar. `stock` no viaja
     * nunca desde el navegador (ver `productoToRow`): quien lo mueve es la base.
     */
    setVendidoAqui((prev) => {
      const n = { ...prev }
      for (const l of cesta) {
        const deLaBase = productosDeLaBase.find((p) => p.id === l.producto.id)
        if (!deLaBase) continue
        const previo = n[l.producto.id]
        const stockAhora = previo?.stockBase === deLaBase.stock ? previo.stock : deLaBase.stock
        const dispBase = disponibleDe(existencias, deLaBase)
        const dispAhora = previo?.dispBase === dispBase ? previo.disp : dispBase
        n[l.producto.id] = {
          stock: Math.max(0, stockAhora - l.cantidad), stockBase: deLaBase.stock,
          disp: Math.max(0, dispAhora - l.cantidad), dispBase,
        }
      }
      return n
    })
    setUltima(r.venta)
    // Y las existencias de verdad, por si mientras tanto ha entrado una reserva
    // por la web: la cabecera y el resto de pestañas tienen que verlo.
    recargarExistencias()
    alCobrar()
    vaciar()
  }

  return (
    <>
      {/*
        EL AVISO DE LO COBRADO. Iba con `banner banner--ok`, que son las clases
        de la PORTADA —cristal oscuro, texto casi blanco— y sobre el marfil del
        panel se leían fatal. `banner-inline` usa los mismos tokens que el resto
        de la pantalla, y con un `.btn` dentro se coloca solo (ver global.css).
      */}
      {ultima && (
        <div className="banner-inline banner-inline--ok" role="status">
          <span>
            <b>Cobrado {formatCurrency(ultima.total)}.</b>{' '}
            Factura {referenciaFactura(ultima)} · base {formatCurrency(ultima.base)} + IVA {formatCurrency(ultima.iva)}
            {ultima.descuentoPct > 0 ? ` · descuento del ${ultima.descuentoPct} %` : ''}
          </span>
          <button className="btn btn-outline btn-sm" onClick={() => void verFactura(ultima.id)}>
            Ver la factura
          </button>
        </div>
      )}
      {error && <div className="banner-inline banner-inline--warn" role="alert">{error}</div>}

      <div className="caja__mesa">
        {/* ------------------------------------------------------------ */}
        {/* Lo que se puede vender                                        */}
        {/* ------------------------------------------------------------ */}
        <section className="portal__section">
          {/* No se llama «Artículos»: así se llama la pestaña de al lado, y dos
              cosas distintas con el mismo nombre en la misma pantalla es lo que
              hace que alguien busque la ficha de un artículo aquí. */}
          <h2>Añadir a la cesta</h2>
          <input
            ref={buscador}
            className="search-box"
            placeholder="Código o nombre…"
            aria-label="Buscar artículo por código o nombre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter añade el primero de la lista: con un lector de códigos de
              // barras, que teclea el código y da a Enter, esto es toda la venta.
              if (e.key === 'Enter' && encontrados.length > 0) {
                e.preventDefault()
                anadir(encontrados[0])
              }
            }}
          />
          <div className="caja__articulos">
            {encontrados.map((p) => {
              const quedan = disponible(p)
              const apartadas = apartadasDe(existencias, p)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`portal__card-mini portal__card-mini--boton${quedan <= 0 ? ' portal__card-mini--warn' : ''}`}
                  disabled={quedan <= 0}
                  onClick={() => anadir(p)}
                >
                  <span className="portal__card-mini__label">{p.codigo}</span>
                  <span className="portal__card-mini__value">{p.nombre}</span>
                  <span className="portal__card-mini__sub">
                    {formatCurrency(p.precio)} · {quedan <= 0 ? 'agotado' : `quedan ${quedan}`}
                  </span>
                  {/* Lo apartado se dice aquí y no en una nota aparte: es la
                      diferencia entre «quedan 2» y «quedan 2 de las 5 que
                      ves en la estantería», y explica el número raro antes
                      de que nadie tenga que preguntarlo. */}
                  {apartadas > 0 && (
                    <span className="caja__apartadas">{apartadas} apartadas por la web</span>
                  )}
                </button>
              )
            })}
            {encontrados.length === 0 && (
              <p className="form-hint">
                {productos.length === 0
                  ? 'No hay artículos dados de alta. Créalos en la pestaña «Artículos».'
                  : 'Nada con ese nombre ni ese código.'}
              </p>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* La cesta                                                      */}
        {/* ------------------------------------------------------------ */}
        <section className="portal__section">
          <div className="portal__avisos-head">
            <h2>La cesta{totales.unidades > 0 && <span className="portal__avisos-badge">{totales.unidades}</span>}</h2>
            {cesta.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={vaciar}>Vaciar</button>
            )}
          </div>

          {cesta.length === 0 ? (
            <p className="form-hint">Pulsa un artículo para añadirlo.</p>
          ) : (
            <ul className="caja__lineas">
              {cesta.map((l) => {
                const precio = precioDeLinea(l.producto, descuentoPct, l.precioAMano)
                const rebajado = precio !== l.producto.precio
                return (
                  <li key={l.producto.id} className="caja__linea">
                    <div className="caja__linea-cabeza">
                      <span>
                        <b>{l.producto.nombre}</b>{' '}
                        <small className="portal__card-mini__sub">{l.producto.codigo}</small>
                      </span>
                      <b>{formatCurrency(precio * l.cantidad)}</b>
                    </div>
                    <div className="caja__linea-mandos">
                      <label>
                        <span className="portal__card-mini__label">Uds.</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          max={disponible(l.producto)}
                          value={tecleando[l.producto.id] ?? String(l.cantidad)}
                          aria-label={`Unidades de ${l.producto.nombre}`}
                          onChange={(e) => tecleanUnidades(l.producto, e.target.value)}
                          onBlur={() => sueltanElCampo(l.producto.id)}
                        />
                      </label>
                      <label>
                        <span className="portal__card-mini__label">Precio</span>
                        {/* Rebajar a mano: «te lo dejo en diez». Vacío = el de
                            la ficha, con su descuento si lo hay. */}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={precio.toFixed(2)}
                          aria-label={`Precio de ${l.producto.nombre}`}
                          defaultValue={l.precioAMano ?? ''}
                          onChange={(e) => rebajar(l.producto.id, e.target.value)}
                        />
                      </label>
                      {rebajado && (
                        <span className="pill pill--info">antes {formatCurrency(l.producto.precio)}</span>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        title={`Quitar ${l.producto.nombre}`}
                        aria-label={`Quitar ${l.producto.nombre} de la cesta`}
                        onClick={() => cambiarCantidad(l.producto.id, 0)}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="hermano">Quién compra</label>
              <select id="hermano" value={hermanoId} onChange={(e) => setHermanoId(e.target.value)}>
                <option value="">Alguien de fuera</option>
                {hermanos
                  .filter((h) => h.estado !== 'Baja')
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nombre}{h.numero > 0 ? ` · nº ${h.numero}` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="descuento">Descuento</label>
              <select
                id="descuento"
                value={descuentoId}
                onChange={(e) => setDescuentoId(e.target.value)}
                disabled={aplicables.length === 0}
              >
                <option value="">Sin descuento</option>
                {aplicables.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre} · {d.porcentaje} %</option>
                ))}
              </select>
              {aplicables.length === 0 && (
                <p className="form-hint">
                  {descuentos.length === 0
                    ? 'Todavía no hay descuentos. Se crean en la pestaña «Artículos».'
                    : hermano ? 'A este hermano no le toca ninguno.' : 'Los descuentos son para hermanos.'}
                </p>
              )}
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="pago">Forma de pago</label>
              <select id="pago" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                {FORMAS_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              {/* Importa de verdad: el efectivo entra en Caja y lo demás en el
                  banco, y de eso depende que el tesorero pueda conciliar. */}
              <p className="form-hint">
                {formaPago === 'Efectivo' ? 'Entrará en Caja.' : 'Entrará en la cuenta bancaria.'}
              </p>
            </div>
            {/*
              MOSTRADOR U ONLINE. Baja aquí desde la cabecera de la pantalla
              vieja: es un dato de ESTA venta —de dónde salió—, no un modo de la
              tienda, y arriba, al lado del título, se leía como si cambiara la
              pantalla entera.
            */}
            <div className="form-row">
              <label htmlFor="canal">Dónde se ha vendido</label>
              <select id="canal" value={canal} onChange={(e) => setCanal(e.target.value as CanalVenta)}>
                <option value="fisica">En el mostrador</option>
                <option value="online">Por internet</option>
              </select>
              <p className="form-hint">Separa las dos cifras en «Cómo va».</p>
            </div>
          </div>

          <button className="btn btn-outline btn-sm" type="button" onClick={() => setDatosOpen(true)}>
            Datos para la factura{comprador.nif ? ` · ${comprador.nif}` : ''}
          </button>

          <div className="stat-grid stat-grid--cesta">
            <div className="stat-tile">
              <span className="stat-tile__label">Base</span>
              <span className="stat-tile__value">{formatCurrency(totales.base)}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">IVA</span>
              <span className="stat-tile__value">{formatCurrency(totales.iva)}</span>
            </div>
            <div className="stat-tile stat-tile--destacada">
              <span className="stat-tile__label">A cobrar</span>
              <span className="stat-tile__value">{formatCurrency(totales.total)}</span>
              <span className="stat-tile__trend stat-tile__trend--neutral">
                {descuentoPct > 0 ? `Con el ${descuentoPct} % aplicado` : `${totales.unidades} unidades`}
              </span>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={() => void cobrar()}
            /*
             * SIN BASE DE DATOS TAMBIÉN SE COBRA, y esto estaba al revés.
             *
             * El botón se apagaba con `!reqBase.listo`, así que en la
             * demostración se podía llenar la cesta, se veía el total con su
             * IVA… y ahí se acababa el recorrido: ni factura, ni almacén, ni
             * apunte en el libro. La tienda era el único módulo que no se podía
             * probar entero, y desde fuera eso no se lee como «falta conectar
             * la base» sino como «esto no funciona».
             *
             * Ahora la venta se registra en el navegador (ver
             * `lib/tiendaLocal.ts`), que es lo que ya hacen el censo, las
             * cuotas y las papeletas. El aviso rojo de arriba sigue diciendo
             * que esos datos no salen de este ordenador.
             */
            disabled={cobrando || cesta.length === 0}
          >
            {cobrando ? 'Cobrando…' : `Cobrar ${formatCurrency(totales.total)}`}
          </button>
        </section>
      </div>

      <Drawer
        open={datosOpen}
        onClose={() => setDatosOpen(false)}
        title="Datos para la factura"
        subtitle="Solo si hace falta factura con NIF"
        footer={<button className="btn btn-primary" onClick={() => setDatosOpen(false)}>Listo</button>}
      >
        <div className="app-form">
          <p className="form-hint">
            Si quien compra es hermano y no pones nada, se usan los datos de su ficha. Los datos se
            copian en la factura: si la ficha cambia mañana, la factura no cambia con ella.
          </p>
          <div className="form-row">
            <label htmlFor="cnombre">Nombre o razón social</label>
            <input
              id="cnombre"
              value={comprador.nombre}
              placeholder={hermano?.nombre ?? ''}
              onChange={(e) => setComprador((c) => ({ ...c, nombre: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label htmlFor="cnif">NIF</label>
            <input
              id="cnif"
              value={comprador.nif}
              placeholder={hermano?.dni ?? ''}
              onChange={(e) => setComprador((c) => ({ ...c, nif: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label htmlFor="cdir">Dirección</label>
            <input
              id="cdir"
              value={comprador.direccion}
              placeholder={hermano?.direccion ?? ''}
              onChange={(e) => setComprador((c) => ({ ...c, direccion: e.target.value }))}
            />
          </div>
        </div>
      </Drawer>

      {/* ---------------------------------------------------------------- */}
      {/* La factura de lo que se acaba de cobrar                          */}
      {/* ---------------------------------------------------------------- */}
      <Drawer
        open={facturaOpen}
        onClose={() => { setFacturaOpen(false); avisar('') }}
        title={factura ? `Factura ${referenciaFactura(factura.venta)}` : 'Factura'}
        ancho="ancho"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFacturaOpen(false)}>Cerrar</button>
            {factura && (
              <button
                className="btn btn-primary"
                onClick={() => window.print()}
                /* Sin artículos saldría un A4 con membrete, número y total y
                   sin una sola línea ni desglose de IVA. */
                disabled={!factura.lineas || factura.lineas.length === 0}
              >
                Imprimir / Descargar
              </button>
            )}
          </>
        }
      >
        {traendo && <p className="form-hint">Trayendo la factura…</p>}
        {!traendo && !factura && (
          <p className="form-hint">
            No se ha podido traer la factura ahora mismo. La venta está registrada: la tienes en la
            pestaña «Ventas y facturas».
          </p>
        )}
        {!traendo && factura && (
          <FacturaTienda venta={factura.venta} lineas={factura.lineas} hermandad={hermandad} />
        )}
      </Drawer>
    </>
  )
}
