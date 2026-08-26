/**
 * EL ALMACÉN DE LA TIENDA.
 *
 * La ficha de cada artículo y lo que queda de él. Es la pantalla que se abre
 * para dar de alta las camisetas antes de la salida, para apuntar las tres que
 * se rompieron en la caja, y para ver de un vistazo de qué hay que reponer.
 *
 * NO ES «Enseres y patrimonio». Aquel es la cruz de guía y los faldones: cosas
 * que se inventarían, se aseguran y no se venden nunca. Esto es género.
 */
import { useMemo, useRef, useState, type FormEvent } from 'react'
import Drawer from '../../components/Drawer'
import AvisoFalta from '../../components/AvisoFalta'
import { requisito } from '../../lib/requisitos'
import { formatCurrency } from '../../lib/format'
import { llano } from '../../lib/buscar'
import { nuevoId } from '../../lib/supabaseSync'
import { useProductos, moverStock, historialDeStock } from '../../lib/tienda'
import {
  agotado, margen, margenPorcentaje, quedaPoco,
  type MovimientoStock, type Producto,
} from '../../data/tienda'

/** Cómo se lee cada motivo de movimiento en el historial. */
const MOTIVO: Record<string, string> = {
  compra: 'Entrada',
  venta: 'Vendido',
  rotura: 'Roto o perdido',
  ajuste: 'Ajuste de recuento',
  devolucion: 'Devuelto',
}

type Filtro = 'todos' | 'reponer' | 'agotados' | 'web'

export default function TiendaInventario() {
  const [productosDeLaBase, setProductos] = useProductos()
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [fichaOpen, setFichaOpen] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState('')

  // El artículo abierto en el panel de movimientos, con su historial.
  const [moviendo, setMoviendo] = useState<Producto | null>(null)
  // `null` = todavía no se ha traído (o no se ha podido). Enseñar el del
  // artículo anterior bajo el título de otro es peor que no enseñar nada.
  const [historial, setHistorial] = useState<MovimientoStock[] | null>(null)

  const reqBase = requisito('supabase')

  /*
   * El stock que la base ha devuelto al mover algo, encima de lo que trajo la
   * consulta. Vive aparte de `productos` a propósito: ver el comentario en
   * `mover()`.
   */
  const [stockMovido, setStockMovido] = useState<Record<string, { valor: number; base: number }>>({})
  const productos = useMemo(
    () => productosDeLaBase.map((p) => {
      const m = stockMovido[p.id]
      // Solo mientras la base siga diciendo lo mismo que decía cuando se movió:
      // si trae existencias nuevas, mandan las suyas y esto se aparta.
      return m && m.base === p.stock ? { ...p, stock: m.valor } : p
    }),
    [productosDeLaBase, stockMovido],
  )

  const visibles = useMemo(() => {
    const q = llano(query.trim())
    return productos
      .filter((p) => {
        if (filtro === 'reponer' && !quedaPoco(p)) return false
        if (filtro === 'agotados' && !agotado(p)) return false
        if (filtro === 'web' && !p.visibleEnWeb) return false
        if (!q) return true
        return llano(p.nombre).includes(q) || llano(p.codigo).includes(q)
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'))
  }, [productos, query, filtro])

  const resumen = useMemo(() => {
    const activos = productos.filter((p) => p.activo)
    return {
      articulos: activos.length,
      unidades: activos.reduce((n, p) => n + p.stock, 0),
      // Lo que vale el almacén A COSTE, no a precio de venta: es lo que la
      // hermandad tiene puesto ahí, y es la cifra que le interesa al tesorero.
      valor: activos.reduce((n, p) => n + p.coste * p.stock, 0),
      reponer: activos.filter(quedaPoco).length,
    }
  }, [productos])

  function abrirFicha(p: Producto | null) {
    setEditando(p)
    setError('')
    setFichaOpen(true)
  }

  function guardarFicha(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = new FormData(e.currentTarget)
    const codigo = String(d.get('codigo') ?? '').trim()
    const nombre = String(d.get('nombre') ?? '').trim()
    if (!codigo || !nombre) {
      setError('Hacen falta el código y el nombre: son lo que se busca en el mostrador.')
      return
    }
    // El código identifica el artículo, así que no puede haber dos iguales: en
    // el mostrador se teclea el código, y con dos iguales se cobra el que no es.
    const repetido = productos.some(
      (p) => p.id !== editando?.id && llano(p.codigo) === llano(codigo),
    )
    if (repetido) {
      setError(`Ya hay un artículo con el código «${codigo}».`)
      return
    }
    const num = (k: string, porDefecto = 0) => {
      const v = Number(String(d.get(k) ?? '').replace(',', '.'))
      return Number.isFinite(v) && v >= 0 ? v : porDefecto
    }
    const ficha: Producto = {
      id: editando?.id ?? nuevoId(),
      codigo,
      nombre,
      descripcion: String(d.get('descripcion') ?? '').trim(),
      precio: num('precio'),
      coste: num('coste'),
      iva: num('iva', 21),
      // El stock NO se toca desde la ficha: se mueve con entradas, ventas y
      // roturas, que dejan dicho POR QUÉ. Un stock editable a mano es un
      // almacén que nadie puede cuadrar.
      stock: editando?.stock ?? 0,
      stockMinimo: Math.round(num('stockMinimo')),
      activo: d.get('activo') === 'on',
      visibleEnWeb: d.get('visibleEnWeb') === 'on',
      fotoUrl: String(d.get('fotoUrl') ?? '').trim() || undefined,
      creadoEn: editando?.creadoEn ?? new Date().toISOString(),
    }
    setProductos((prev) =>
      editando ? prev.map((p) => (p.id === ficha.id ? ficha : p)) : [...prev, ficha],
    )
    setFichaOpen(false)
    setHecho(editando ? `Guardada la ficha de «${nombre}».` : `Dado de alta «${nombre}».`)
    setTimeout(() => setHecho(''), 4000)
  }

  /*
   * EL HISTORIAL SE VACÍA AL ABRIR, y la petición lleva su número de vez.
   *
   * Sin lo primero, abrir «Movimientos» de la Medalla después de haber mirado
   * los de la Camiseta enseñaba, bajo el título «Almacén de Medalla», los
   * movimientos de la camiseta hasta que llegara la respuesta. Con la conexión
   * lenta se leen tranquilamente y se dan por buenos.
   *
   * Y sin lo segundo hay una carrera: si la consulta de la camiseta va lenta y
   * la de la medalla llega antes, la de la camiseta resuelve después y pisa el
   * estado — dejando el panel de la medalla con el historial de la camiseta
   * para siempre. El contador dice cuál es la petición vigente; las que
   * lleguen tarde se descartan.
   */
  const vezHistorial = useRef(0)

  async function abrirMovimientos(p: Producto) {
    const mia = ++vezHistorial.current
    setMoviendo(p)
    setError('')
    setHistorial(null)
    const h = await historialDeStock(p.id)
    if (vezHistorial.current === mia) setHistorial(h)
  }

  /*
   * LA GUARDA CONTRA EL DOBLE CLIC va en un `useRef` y no en el estado.
   *
   * El estado no cambia hasta el siguiente pintado, así que dos clics dentro
   * del mismo instante —o dos Enter en el campo de unidades, que envía el
   * formulario— leerían los dos el mismo `false` y entrarían los dos. Y aquí
   * eso no es un botón que parpadea: son DOS MOVIMIENTOS REALES de almacén.
   * Cincuenta camisetas que entran se convierten en cien, con dos apuntes en
   * el historial y nada que lo señale salvo el número.
   */
  const moviendoRef = useRef(false)
  const [apuntando, setApuntando] = useState(false)

  async function mover(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!moviendo || moviendoRef.current) return
    const formulario = e.currentTarget
    const d = new FormData(formulario)
    const tipo = String(d.get('tipo') ?? 'compra') as 'compra' | 'rotura' | 'ajuste'
    const cantidad = Math.round(Number(d.get('cantidad') ?? 0))
    if (!Number.isFinite(cantidad) || cantidad === 0) {
      setError('Pon cuántas unidades.')
      return
    }
    // Una entrada suma; lo roto resta. El ajuste va con el signo que se teclee,
    // porque un recuento puede salir por arriba o por abajo.
    const conSigno = tipo === 'compra' ? Math.abs(cantidad) : tipo === 'rotura' ? -Math.abs(cantidad) : cantidad
    moviendoRef.current = true
    setApuntando(true)
    try {
      const r = await moverStock(moviendo.id, tipo, conSigno, String(d.get('motivo') ?? '').trim())
      if (!r.ok) {
        // El mensaje de la base va TAL CUAL: dice «solo hay 2» y ese número es
        // justo lo que hace falta saber.
        setError(r.error)
        return
      }
      /*
       * El stock nuevo se guarda APARTE y no en `productos`. `setProductos`
       * sincroniza con la base, y bajar el stock aquí marcaba la fila como
       * cambiada: se mandaba un `update` de la ficha entera —código, nombre,
       * precio, coste, IVA— con lo que este navegador tuviera en memoria. Si
       * otro había cambiado el precio entretanto, se lo pisaba con el viejo.
       *
       * `stock` no viaja nunca desde el navegador (ver `productoToRow`): lo
       * mueve la base, y aquí solo se refleja lo que ella acaba de decir.
       */
      setStockMovido((prev) => ({
        ...prev,
        [moviendo.id]: {
          valor: r.stock,
          base: productosDeLaBase.find((p) => p.id === moviendo.id)?.stock ?? r.stock,
        },
      }))
      setMoviendo((m) => (m ? { ...m, stock: r.stock } : m))
      // Y se limpia el formulario: dejarlo relleno con «50» invita a volver a
      // darle, que es la otra forma de apuntar la misma entrada dos veces.
      formulario.reset()
      const mia = ++vezHistorial.current
      const h = await historialDeStock(moviendo.id)
      if (vezHistorial.current === mia) setHistorial(h)
      setError('')
      setHecho(`Quedan ${r.stock} de «${moviendo.nombre}».`)
      setTimeout(() => setHecho(''), 4000)
    } finally {
      moviendoRef.current = false
      setApuntando(false)
    }
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Tienda</p>
          <h1>Almacén y artículos</h1>
          <p className="dash-head__lead">
            {resumen.articulos} artículo{resumen.articulos === 1 ? '' : 's'} · {resumen.unidades} unidades en el almacén
          </p>
        </div>
        <div className="dash-head__actions">
          <button className="btn btn-primary" onClick={() => abrirFicha(null)}>+ Nuevo artículo</button>
        </div>
      </div>

      {!reqBase.listo && <AvisoFalta requisito={reqBase} />}
      {hecho && <div className="banner banner--ok" role="status">{hecho}</div>}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Artículos</span>
          <span className="stat-tile__value">{resumen.articulos}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">En catálogo</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Unidades</span>
          <span className="stat-tile__value">{resumen.unidades}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Lo que hay ahora</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Valor del almacén</span>
          <span className="stat-tile__value">{formatCurrency(resumen.valor)}</span>
          {/* A coste y no a precio de venta: es lo que la hermandad tiene
              puesto ahí, no lo que espera sacar. */}
          <span className="stat-tile__trend stat-tile__trend--neutral">A precio de coste</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Hay que reponer</span>
          <span className="stat-tile__value">{resumen.reponer}</span>
          <span className={`stat-tile__trend stat-tile__trend--${resumen.reponer > 0 ? 'warn' : 'ok'}`}>
            {resumen.reponer > 0 ? 'Por debajo del mínimo' : 'Todo con existencias'}
          </span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por nombre o código"
          aria-label="Buscar artículos por nombre o código"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {([
            ['todos', 'Todos'],
            ['reponer', 'Hay que reponer'],
            ['agotados', 'Agotados'],
            ['web', 'En la web'],
          ] as [Filtro, string][]).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              className={`chip${filtro === id ? ' chip--active' : ''}`}
              onClick={() => setFiltro(id)}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Artículo</th>
              <th className="num">Precio</th>
              <th className="num">Coste</th>
              <th className="num">Margen</th>
              <th className="num">Quedan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id} className={p.activo ? undefined : 'fila--apagada'}>
                <td><code>{p.codigo}</code></td>
                <td>
                  <b>{p.nombre}</b>
                  {p.visibleEnWeb && <span className="pill pill--info">En la web</span>}
                  {!p.activo && <span className="pill pill--off">Retirado</span>}
                </td>
                <td className="num">{formatCurrency(p.precio)}</td>
                <td className="num">{formatCurrency(p.coste)}</td>
                <td className="num">
                  {formatCurrency(margen(p))}
                  <small className="portal__card-mini__sub"> ({margenPorcentaje(p)} %)</small>
                </td>
                <td className="num">
                  <b>{p.stock}</b>
                  {agotado(p) ? (
                    <span className="pill pill--off">Agotado</span>
                  ) : quedaPoco(p) ? (
                    <span className="pill pill--warn">Repón (mín. {p.stockMinimo})</span>
                  ) : null}
                </td>
                <td className="num">
                  <button className="btn btn-ghost btn-sm" onClick={() => void abrirMovimientos(p)}>
                    Movimientos
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => abrirFicha(p)}>Ficha</button>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="form-hint">
                  {productos.length === 0
                    ? 'Todavía no hay ningún artículo. Da de alta el primero para poder vender.'
                    : 'Nada con ese filtro.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* La ficha del artículo                                            */}
      {/* ---------------------------------------------------------------- */}
      <Drawer
        open={fichaOpen}
        onClose={() => setFichaOpen(false)}
        title={editando ? editando.nombre : 'Nuevo artículo'}
        subtitle={editando ? `Código ${editando.codigo}` : 'La ficha con la que se vende'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFichaOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="ficha-producto">Guardar</button>
          </>
        }
      >
        <form className="app-form" id="ficha-producto" onSubmit={guardarFicha}>
          {error && <div className="banner banner--error" role="alert">{error}</div>}
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="codigo">Código</label>
              <input id="codigo" name="codigo" defaultValue={editando?.codigo ?? ''} />
              <p className="form-hint">El de vuestra etiqueta. Es lo que se teclea al cobrar.</p>
            </div>
            <div className="form-row">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" defaultValue={editando?.nombre ?? ''} />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="descripcion">Descripción</label>
            <textarea id="descripcion" name="descripcion" rows={2} defaultValue={editando?.descripcion ?? ''} />
            <p className="form-hint">Sale en la tienda de la web, si el artículo se publica ahí.</p>
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="precio">Precio de venta</label>
              <input id="precio" name="precio" type="number" step="0.01" min="0" defaultValue={editando?.precio ?? 0} />
              {/* Con IVA incluido a propósito: es lo que se dice en el
                  mostrador y lo que va en la etiqueta. La base y la cuota se
                  calculan solas para la factura. */}
              <p className="form-hint">Con IVA incluido: lo que paga quien compra.</p>
            </div>
            <div className="form-row">
              <label htmlFor="coste">Coste</label>
              <input id="coste" name="coste" type="number" step="0.01" min="0" defaultValue={editando?.coste ?? 0} />
              <p className="form-hint">Lo que os cuesta a vosotros. De aquí sale el gasto en Tesorería.</p>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="iva">IVA (%)</label>
              <input id="iva" name="iva" type="number" step="0.01" min="0" max="100" defaultValue={editando?.iva ?? 21} />
              <p className="form-hint">Ponlo a 0 si la hermandad no repercute IVA.</p>
            </div>
            <div className="form-row">
              <label htmlFor="stockMinimo">Avisar cuando queden menos de</label>
              <input id="stockMinimo" name="stockMinimo" type="number" min="0" step="1" defaultValue={editando?.stockMinimo ?? 0} />
              <p className="form-hint">
                Cuando el almacén baje de aquí, se avisa a quien lleva el inventario. 0 = no avisar.
              </p>
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="fotoUrl">Foto (dirección)</label>
            <input id="fotoUrl" name="fotoUrl" defaultValue={editando?.fotoUrl ?? ''} placeholder="https://…" />
          </div>
          <label className="checkbox">
            <input type="checkbox" name="activo" defaultChecked={editando ? editando.activo : true} />
            <span>
              A la venta
              <small className="portal__pref-explica">Si lo apagas deja de salir en la caja, pero su historial se conserva.</small>
            </span>
          </label>
          <label className="checkbox">
            <input type="checkbox" name="visibleEnWeb" defaultChecked={editando?.visibleEnWeb ?? false} />
            <span>
              Publicarlo en la tienda de la web
              <small className="portal__pref-explica">Sale en la web pública para que lo pueda comprar cualquiera.</small>
            </span>
          </label>
          {editando && (
            <p className="form-hint">
              Quedan <b>{editando.stock}</b> unidades. El almacén no se toca desde aquí: se mueve con
              entradas, ventas y roturas, que dejan dicho por qué. Usa «Movimientos».
            </p>
          )}
        </form>
      </Drawer>

      {/* ---------------------------------------------------------------- */}
      {/* Mover el almacén, y por qué                                      */}
      {/* ---------------------------------------------------------------- */}
      <Drawer
        open={moviendo !== null}
        onClose={() => setMoviendo(null)}
        title={moviendo ? `Almacén de ${moviendo.nombre}` : ''}
        subtitle={moviendo ? `Quedan ${moviendo.stock} · código ${moviendo.codigo}` : ''}
        footer={<button className="btn btn-ghost" onClick={() => setMoviendo(null)}>Cerrar</button>}
      >
        <div className="app-form">
          {error && <div className="banner banner--error" role="alert">{error}</div>}
          <form className="app-form" onSubmit={mover}>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="tipo">Qué ha pasado</label>
                <select id="tipo" name="tipo" defaultValue="compra">
                  <option value="compra">Ha entrado género</option>
                  <option value="rotura">Se ha roto o perdido</option>
                  <option value="ajuste">Ajuste tras contar</option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="cantidad">Unidades</label>
                <input id="cantidad" name="cantidad" type="number" step="1" defaultValue={1} />
                <p className="form-hint">En un ajuste puedes poner un número negativo si sobran menos.</p>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="motivo">Motivo</label>
              <input id="motivo" name="motivo" placeholder="Pedido a la imprenta, se cayó la caja…" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={apuntando}>
              {apuntando ? 'Apuntando…' : 'Apuntar'}
            </button>
          </form>

          <h3>Lo que ha pasado con este artículo</h3>
          {historial === null ? (
            <p className="form-hint">
              Trayendo lo que ha pasado con este artículo… Si se queda así, es que no se ha podido
              preguntar: mira el aviso de arriba.
            </p>
          ) : historial.length === 0 ? (
            <p className="form-hint">Todavía no se ha movido nada.</p>
          ) : (
            <ul className="portal__avisos">
              {historial.map((m) => (
                <li key={m.id} className="portal__aviso">
                  <div>
                    <strong className="portal__aviso-titulo">
                      {MOTIVO[m.tipo] ?? m.tipo}: {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                    </strong>
                    {m.motivo && <p>{m.motivo}</p>}
                    <small>{new Date(m.fecha).toLocaleString('es-ES')}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Drawer>
    </div>
  )
}
