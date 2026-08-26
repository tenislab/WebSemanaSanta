/**
 * LA CAJA.
 *
 * La pantalla del mostrador: se teclea o se pulsa lo que lleva la persona, se
 * dice quién es y cómo paga, y se cobra. De ahí sale la factura, el género sale
 * del almacén y los dos asientos entran en Tesorería.
 *
 * ESTÁ PENSADA PARA UNA COLA, y eso manda sobre todo lo demás:
 *
 *   · el buscador tiene el foco desde el principio,
 *   · pulsar un artículo lo añade sin abrir nada,
 *   · el total se ve siempre, grande, sin bajar,
 *   · y los errores se dicen enteros («solo hay 2»), no con un «no se pudo».
 *
 * EL TOTAL QUE SE VE AQUÍ ES EL QUE COBRA LA BASE. Lo calculan las mismas
 * cuentas (`data/tienda.ts`) que aplica `registrar_venta`, y hay pruebas de
 * que coinciden. Si se separaran, se le diría un precio a alguien y se le
 * cobraría otro.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Drawer from '../../components/Drawer'
import AvisoFalta from '../../components/AvisoFalta'
import { requisito } from '../../lib/requisitos'
import { formatCurrency } from '../../lib/format'
import { llano } from '../../lib/buscar'
import { CLAVES_DATOS, leerDatos } from '../../lib/persistencia'
import { HERMANOS_INICIALES, type Hermano } from '../../data/hermanos'
import {
  useDescuentos, useProductos, registrarVenta, lineasDeVenta, traerVenta,
  type VentaRegistrada,
} from '../../lib/tienda'
import FacturaTienda from '../../components/FacturaTienda'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import {
  FORMAS_PAGO, agotado, descuentosPara, precioDeLinea, referenciaFactura, totalesDeCesta,
  type CanalVenta, type LineaCesta, type LineaVenta, type Producto, type Venta,
} from '../../data/tienda'

export default function TiendaCaja() {
  const [productosDeLaBase] = useProductos()
  const [descuentos] = useDescuentos()
  const hermanos = useMemo(() => leerDatos<Hermano>(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])

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

  /*
   * EL STOCK QUE ESTA PANTALLA HA IDO BAJANDO AL COBRAR, aparte de la copia
   * que se sincroniza con la base. Ver el comentario largo en `cobrar`.
   *
   * Se guarda junto con el stock que la base decía EN ESE MOMENTO (`base`), y
   * el descuento solo se aplica mientras ese número siga siendo el mismo. Sin
   * eso, una recarga que trajera existencias nuevas —porque otro ha vendido, o
   * ha entrado género— quedaría tapada por un descuento ya contado, y la
   * pantalla enseñaría menos de lo que hay para siempre.
   */
  const [vendidoAqui, setVendidoAqui] = useState<Record<string, { valor: number; base: number }>>({})
  const productos = useMemo(
    () => productosDeLaBase.map((p) => {
      const v = vendidoAqui[p.id]
      return v && v.base === p.stock ? { ...p, stock: Math.max(0, v.valor) } : p
    }),
    [productosDeLaBase, vendidoAqui],
  )

  /*
   * LA FACTURA DE LO QUE SE ACABA DE COBRAR, para poder dársela a quien está
   * delante. Se trae de la base —no se arma con lo que esta pantalla tenía en
   * la cesta— porque los importes de una factura tienen que ser los que
   * quedaron guardados. Si algún día no coincidieran, quiero que se vea.
   */
  const hermandad = useHermandadSettings()
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

  const reqBase = requisito('supabase')

  // El foco en el buscador desde el principio y después de cada cobro: con la
  // cola esperando, tener que pinchar en el campo antes de teclear es lo que
  // hace que la gente acabe apuntando en un papel.
  useEffect(() => { buscador.current?.focus() }, [])

  const hermano = hermanos.find((h) => h.id === hermanoId) ?? null

  /*
   * LOS DESCUENTOS QUE SE PUEDEN OFRECER. Si aquí se ofreciera de más, la
   * venta fallaría al cobrar y con la cola delante: quien de verdad lo decide
   * es la base (`registrar_venta`), y estas dos listas tienen que coincidir.
   */
  const aplicables = useMemo(
    () => descuentosPara(descuentos, hermano?.etiquetas, Boolean(hermano)),
    [descuentos, hermano],
  )
  // Si se cambia de comprador y el descuento que había puesto ya no le toca,
  // se quita solo. Dejarlo puesto haría que la venta fallara sin motivo visible.
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

  function anadir(p: Producto) {
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
   * LO QUE SE ESTÁ TECLEANDO EN EL CAMPO DE UNIDADES, mientras no sea un
   * número válido.
   *
   * Hace falta porque el campo es controlado: si al borrar el dígito el
   * componente vuelve a pintar la cantidad de antes, no hay forma de dejarlo
   * vacío para escribir otra cosa —el número reaparece bajo el cursor—. Aquí
   * se guarda el texto en crudo, se pinta ese, y en cuanto llega a ser un
   * número se manda a la cesta. Al salir del campo se olvida y vuelve a
   * mandar la cantidad de verdad, así que un campo dejado a medias no puede
   * quedarse enseñando algo que no es.
   */
  const [tecleando, setTecleando] = useState<Record<string, string>>({})

  function tecleanUnidades(id: string, texto: string) {
    setTecleando((t) => ({ ...t, [id]: texto }))
    const t = texto.trim()
    // Vacío, o un «-» a medio escribir: todavía no ha dicho nada.
    if (t === '' || t === '-') return
    const n = Math.round(Number(t))
    if (!Number.isFinite(n) || n < 1) return
    cambiarCantidad(id, n)
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
     * `false`. Y a continuación el código hacía exactamente eso: `if
     * (cobrando) return`. Lo único que protegía de verdad era el `disabled`
     * del botón.
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
     * El almacén de la pantalla se baja también, para que la siguiente venta
     * de la cola vea lo que queda de verdad. Sin esto, con dos camisetas se
     * podrían meter tres en la cesta siguiente y el error saltaría al cobrar.
     *
     * PERO NO TOCANDO `productos`, y esto costó encontrarlo. `setProductos` no
     * es un `setState` normal: es el de `useSupabaseTable`, que sincroniza, y
     * manda a Supabase un `update` por cada fila cuyo JSON haya cambiado. O
     * sea que bajar el stock aquí disparaba, DESPUÉS DE CADA COBRO, un update
     * de la ficha entera —código, nombre, precio, coste, IVA…— de cada
     * artículo de la cesta, con los valores que este navegador tuviera en
     * memoria. Y eso es un último-que-escribe-gana con datos viejos: si desde
     * el móvil se sube el precio de la camiseta a 15 € mientras esta pestaña
     * lleva abierta desde la mañana con 12 €, la primera camiseta que se cobre
     * aquí devuelve el precio a 12 € en la base.
     *
     * Así que el descuento vive aparte, solo para pintar. `stock` no viaja
     * nunca desde el navegador (ver `productoToRow`): quien lo mueve es la
     * base.
     */
    setVendidoAqui((prev) => {
      const n = { ...prev }
      for (const l of cesta) {
        const deLaBase = productosDeLaBase.find((p) => p.id === l.producto.id)
        if (!deLaBase) continue
        const ahora = n[l.producto.id]?.base === deLaBase.stock ? n[l.producto.id].valor : deLaBase.stock
        n[l.producto.id] = { valor: Math.max(0, ahora - l.cantidad), base: deLaBase.stock }
      }
      return n
    })
    setUltima(r.venta)
    vaciar()
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Tienda</p>
          <h1>Caja</h1>
          <p className="dash-head__lead">Cobra, descuenta del almacén y apunta en el libro, de una vez.</p>
        </div>
        <div className="dash-head__actions">
          <div className="filters">
            {([['fisica', 'Mostrador'], ['online', 'Online']] as [CanalVenta, string][]).map(([id, t]) => (
              <button
                key={id}
                type="button"
                className={`chip${canal === id ? ' chip--active' : ''}`}
                onClick={() => setCanal(id)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!reqBase.listo && <AvisoFalta requisito={reqBase} />}

      {ultima && (
        <div className="banner banner--ok" role="status">
          <b>Cobrado {formatCurrency(ultima.total)}.</b>{' '}
          Factura {referenciaFactura(ultima)} · base {formatCurrency(ultima.base)} + IVA {formatCurrency(ultima.iva)}
          {ultima.descuentoPct > 0 ? ` · descuento del ${ultima.descuentoPct} %` : ''}
          {' '}
          <button className="btn btn-outline btn-sm" onClick={() => void verFactura(ultima.id)}>
            Ver la factura
          </button>
        </div>
      )}
      {error && <div className="banner banner--error" role="alert">{error}</div>}

      <div className="caja__mesa">
        {/* ------------------------------------------------------------ */}
        {/* Lo que se puede vender                                        */}
        {/* ------------------------------------------------------------ */}
        <section className="portal__section">
          <h2>Artículos</h2>
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
                const p = encontrados[0]
                if (!agotado(p)) anadir(p)
              }
            }}
          />
          <div className="caja__articulos">
            {encontrados.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`portal__card-mini portal__card-mini--boton${agotado(p) ? ' portal__card-mini--warn' : ''}`}
                disabled={agotado(p)}
                onClick={() => anadir(p)}
              >
                <span className="portal__card-mini__label">{p.codigo}</span>
                <span className="portal__card-mini__value">{p.nombre}</span>
                <span className="portal__card-mini__sub">
                  {formatCurrency(p.precio)} · {agotado(p) ? 'agotado' : `quedan ${p.stock}`}
                </span>
              </button>
            ))}
            {encontrados.length === 0 && (
              <p className="form-hint">
                {productos.length === 0
                  ? 'No hay artículos dados de alta. Créalos en «Almacén y artículos».'
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
                          value={tecleando[l.producto.id] ?? String(l.cantidad)}
                          aria-label={`Unidades de ${l.producto.nombre}`}
                          onChange={(e) => tecleanUnidades(l.producto.id, e.target.value)}
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
                  {hermano ? 'A este hermano no le toca ninguno.' : 'Los descuentos son para hermanos.'}
                </p>
              )}
            </div>
          </div>

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

          <button className="btn btn-outline btn-sm" type="button" onClick={() => setDatosOpen(true)}>
            Datos para la factura{comprador.nif ? ` · ${comprador.nif}` : ''}
          </button>

          <div className="stat-grid">
            <div className="stat-tile">
              <span className="stat-tile__label">Base</span>
              <span className="stat-tile__value">{formatCurrency(totales.base)}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">IVA</span>
              <span className="stat-tile__value">{formatCurrency(totales.iva)}</span>
            </div>
            <div className="stat-tile stat-tile--destacada">
              <span className="stat-tile__label">Total a cobrar</span>
              <span className="stat-tile__value">{formatCurrency(totales.total)}</span>
              <span className="stat-tile__trend stat-tile__trend--neutral">
                {descuentoPct > 0 ? `Con el ${descuentoPct} % aplicado` : `${totales.unidades} unidades`}
              </span>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={() => void cobrar()}
            disabled={cobrando || cesta.length === 0 || !reqBase.listo}
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
        onClose={() => setFacturaOpen(false)}
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
            No se ha podido traer la factura ahora mismo. La venta está registrada: la tienes en
            Tienda → Facturas de la tienda.
          </p>
        )}
        {!traendo && factura && (
          <FacturaTienda venta={factura.venta} lineas={factura.lineas} hermandad={hermandad} />
        )}
      </Drawer>
    </div>
  )
}
