/**
 * EL GÉNERO: LA FICHA DE CADA ARTÍCULO Y LO QUE QUEDA DE ÉL.
 *
 * Es la pestaña que se abre para dar de alta las camisetas antes de la salida,
 * para apuntar las tres que se rompieron en la caja, y para ver de un vistazo
 * de qué hay que reponer.
 *
 * NO ES «Enseres y patrimonio». Aquel es la cruz de guía y los faldones: cosas
 * que se inventarían, se aseguran y no se venden nunca. Esto es género.
 *
 * TRES NÚMEROS Y NO UNO. La tabla enseña lo que hay en la estantería, lo que la
 * web tiene apartado y lo que de verdad se puede vender. Con un solo número
 * —el stock— alguien vendía en el mostrador lo que ya estaba prometido, y el
 * descuadre no aparecía hasta que la persona venía a recoger su reserva.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import Drawer from '../../../components/Drawer'
import ToolbarTienda from '../../../components/tienda/ToolbarTienda'
import { formatCurrency } from '../../../lib/format'
import { llano } from '../../../lib/buscar'
import { nuevoId } from '../../../lib/supabaseSync'
import { moverStock, historialDeStock } from '../../../lib/tienda'
import { apartadasDe, disponibleDe, useTienda } from '../../../context/TiendaContext'
import {
  agotado, margen, margenPorcentaje, quedaPoco,
  type Descuento, type MovimientoStock, type Producto,
} from '../../../data/tienda'
import type { Pestana } from '../Tienda'

/** Cómo se lee cada motivo de movimiento en el historial. */
const MOTIVO: Record<string, string> = {
  compra: 'Entrada',
  venta: 'Vendido',
  rotura: 'Roto o perdido',
  ajuste: 'Ajuste de recuento',
  devolucion: 'Devuelto',
}

type FiltroArticulos = 'todos' | 'reponer' | 'agotados' | 'apartados' | 'web'

const FILTROS = [
  ['todos', 'Todos'],
  ['reponer', 'Hay que reponer'],
  ['agotados', 'Agotados'],
  ['apartados', 'Con algo apartado'],
  ['web', 'En la web'],
] as const

export default function PanelArticulos({ avisar, acciones }: {
  avisar: (t: string) => void
  acciones: (p: Pestana, nodo: ReactNode) => void
}) {
  const {
    productos: productosDeLaBase, setProductos, descuentos, setDescuentos, hermanos,
    existencias, recargarExistencias,
  } = useTienda()

  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<FiltroArticulos>('todos')
  const [fichaOpen, setFichaOpen] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [error, setError] = useState('')
  const [descuentosOpen, setDescuentosOpen] = useState(false)

  // El artículo abierto en el panel de movimientos, con su historial.
  const [moviendo, setMoviendo] = useState<Producto | null>(null)
  // `null` = todavía no se ha traído (o no se ha podido). Enseñar el del
  // artículo anterior bajo el título de otro es peor que no enseñar nada.
  const [historial, setHistorial] = useState<MovimientoStock[] | null>(null)

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

  function abrirFicha(p: Producto | null) {
    setEditando(p)
    setError('')
    setFichaOpen(true)
  }

  const activos = useMemo(() => descuentos.filter((d) => d.activo).length, [descuentos])

  // Las etiquetas que la hermandad usa de verdad en las fichas. De ahí sale el
  // desplegable del cajón de descuentos: escribirlas a mano es lo que hacía que
  // el descuento no se lo llevara nadie.
  const etiquetasDelCenso = useMemo(
    () => [...new Set(hermanos.flatMap((h) => h.etiquetas ?? []))].sort((a, b) => a.localeCompare(b, 'es')),
    [hermanos],
  )

  // Los dos botones de la cabecera son de esta pestaña. Se vuelven a poner
  // cuando cambia el número de descuentos activos, que va escrito en uno.
  useEffect(() => {
    acciones('articulos', (
      <>
        <button type="button" className="btn btn-outline" onClick={() => setDescuentosOpen(true)}>
          Descuentos{activos > 0 ? ` (${activos})` : ''}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => abrirFicha(null)}>
          + Nuevo artículo
        </button>
      </>
    ))
  }, [acciones, activos])

  const visibles = useMemo(() => {
    const q = llano(query.trim())
    return productos
      .filter((p) => {
        if (filtro === 'reponer' && !quedaPoco(p)) return false
        if (filtro === 'agotados' && !agotado(p)) return false
        if (filtro === 'apartados' && apartadasDe(existencias, p) === 0) return false
        if (filtro === 'web' && !p.visibleEnWeb) return false
        if (!q) return true
        return llano(p.nombre).includes(q) || llano(p.codigo).includes(q)
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'))
  }, [productos, query, filtro, existencias])

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
    /*
     * EL STOCK SE LEE DE LO QUE HAY GUARDADO, no de `editando`.
     *
     * `editando` es la foto del artículo cuando se abrió la ficha. Si entre
     * medias se movió el almacén desde el otro cajón —entra género, se apunta
     * una rotura— y luego se guarda la ficha, ese stock viejo volvía a la
     * lista y deshacía el movimiento en pantalla. En la demostración se veía
     * clarísimo: metías cincuenta camisetas, corregías una errata del nombre,
     * y volvían a ser cero.
     */
    const guardado = productosDeLaBase.find((p) => p.id === editando?.id)
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
      stock: stockMovido[editando?.id ?? '']?.valor ?? guardado?.stock ?? editando?.stock ?? 0,
      stockMinimo: Math.round(num('stockMinimo')),
      activo: d.get('activo') === 'on',
      visibleEnWeb: d.get('visibleEnWeb') === 'on',
      fotoUrl: String(d.get('fotoUrl') ?? '').trim() || undefined,
      creadoEn: editando?.creadoEn ?? new Date().toISOString(),
    }
    setProductos((prev) =>
      editando ? prev.map((p) => (p.id === ficha.id ? ficha : p)) : [...prev, ficha],
    )
    const eraNuevo = !editando
    setFichaOpen(false)
    avisar(editando ? `Guardada la ficha de «${nombre}».` : `Dado de alta «${nombre}».`)

    /*
     * UN ARTÍCULO NUEVO NACE SIN EXISTENCIAS, y eso dejaba el recorrido a
     * medias: se daba de alta, se iba uno a la caja y allí salía «agotado»,
     * apagado y sin poder pulsarlo. Nada decía que faltaba meter el género, ni
     * dónde se hace.
     *
     * Así que se abre solo el almacén del artículo recién creado, con la
     * entrada preparada. Y NO se guarda el stock desde la ficha, que sería lo
     * cómodo: cada unidad tiene que entrar por un movimiento que diga de dónde
     * viene, o el almacén deja de poder cuadrarse.
     *
     * Se abre después de guardar, y no antes, porque con base de datos el alta
     * viaja en ese momento: cuando la persona teclee la cantidad y pulse, la
     * fila ya está. Si aun así no lo estuviera, la base contesta que ese
     * artículo no existe y se vuelve a intentar; no se estropea nada.
     */
    if (eraNuevo) void abrirMovimientos(ficha)
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
   * para siempre. El contador dice cuál es la petición vigente; las que lleguen
   * tarde se descartan.
   */
  const vezHistorial = useRef(0)

  async function abrirMovimientos(p: Producto) {
    const mia = ++vezHistorial.current
    setMoviendo(p)
    setError('')
    setInsistir(null)
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
   * Cincuenta camisetas que entran se convierten en cien, con dos apuntes en el
   * historial y nada que lo señale salvo el número.
   */
  const moviendoRef = useRef(false)
  const [apuntando, setApuntando] = useState(false)
  /*
   * LO QUE SE INTENTÓ Y CHOCÓ CON UNA RESERVA. Bajar el género por debajo de lo
   * que la web tiene prometido se para la primera vez y se dice con quién
   * choca; si de verdad se han roto, se repite pulsando aquí. Una rotura es un
   * hecho, pero tiene que quedar dicho a quién deja colgado.
   */
  const [insistir, setInsistir] = useState<{ tipo: string; cantidad: number; motivo: string } | null>(null)

  async function apuntarMovimiento(
    tipo: 'compra' | 'rotura' | 'ajuste',
    conSigno: number,
    motivo: string,
    aunqueEsteApartado: boolean,
    limpiar?: () => void,
  ) {
    if (!moviendo || moviendoRef.current) return
    moviendoRef.current = true
    setApuntando(true)
    try {
      const r = await moverStock(moviendo.id, tipo, conSigno, motivo, moviendo, aunqueEsteApartado)
      if (!r.ok) {
        // El mensaje de la base va TAL CUAL: dice «solo hay 2» y ese número es
        // justo lo que hace falta saber.
        setError(r.error)
        // Y si lo que ha chocado es una reserva, se ofrece hacerlo igualmente
        // en vez de dejar a la persona sin salida delante del almacén roto.
        setInsistir(r.error.includes('apartadas por la web') ? { tipo, cantidad: conSigno, motivo } : null)
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
      recargarExistencias()
      setInsistir(null)
      // Y se limpia el formulario: dejarlo relleno con «50» invita a volver a
      // darle, que es la otra forma de apuntar la misma entrada dos veces.
      limpiar?.()
      const mia = ++vezHistorial.current
      const h = await historialDeStock(moviendo.id)
      if (vezHistorial.current === mia) setHistorial(h)
      setError('')
      avisar(`Quedan ${r.stock} de «${moviendo.nombre}».`)
    } finally {
      moviendoRef.current = false
      setApuntando(false)
    }
  }

  async function mover(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
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
    await apuntarMovimiento(tipo, conSigno, String(d.get('motivo') ?? '').trim(), false, () => formulario.reset())
  }

  return (
    <>
      {error && !moviendo && !fichaOpen && (
        <div className="banner-inline banner-inline--warn" role="alert">{error}</div>
      )}

      <ToolbarTienda
        busca="Buscar por nombre o código"
        valor={query}
        onBuscar={setQuery}
        filtros={FILTROS}
        activo={filtro}
        onFiltrar={setFiltro}
      />

      <div className="table-card">
        <table className="tienda-articulos">
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
            {visibles.map((p) => {
              const apartadas = apartadasDe(existencias, p)
              const sePuede = disponibleDe(existencias, p)
              return (
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
                  {/*
                    UNA SOLA COLUMNA Y NO TRES.
                    El número grande es LO QUE SE PUEDE VENDER, que es la
                    pregunta del mostrador. La estantería y lo apartado salen
                    debajo SOLO CUANDO HAY ALGO APARTADO —o sea, casi nunca—,
                    porque tres columnas de números para un dato que la mayoría
                    de los días es uno solo sacaban la tabla de la pantalla y
                    dejaban los botones cortados a la derecha.

                    En negativo se pinta en rojo y no se tapa con un cero: un −2
                    significa que se ha vendido género que ya estaba prometido a
                    alguien, y es justo lo que hay que ver.
                  */}
                  <td className="num">
                    <span className="tienda-quedan">
                      <b className={sePuede < 0 ? 'tienda-sobrevendido' : undefined}>{sePuede}</b>
                      {apartadas > 0 && (
                        <small>{p.stock} en la estantería · <b>{apartadas} apartadas</b></small>
                      )}
                      {sePuede < 0 ? (
                        <span className="pill pill--warn">Prometido de más</span>
                      ) : agotado(p) ? (
                        <span className="pill pill--off">Agotado</span>
                      ) : quedaPoco(p) ? (
                        <span className="pill pill--warn">Repón (mín. {p.stockMinimo})</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="num">
                    <button className="btn btn-ghost btn-sm" onClick={() => void abrirMovimientos(p)}>
                      Movimientos
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => abrirFicha(p)}>Ficha</button>
                  </td>
                </tr>
              )
            })}
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
          {error && <div className="banner-inline banner-inline--warn" role="alert">{error}</div>}
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
        onClose={() => { setMoviendo(null); setInsistir(null); setError('') }}
        title={moviendo ? `Almacén de ${moviendo.nombre}` : ''}
        subtitle={moviendo ? `Quedan ${moviendo.stock} · código ${moviendo.codigo}` : ''}
        footer={<button className="btn btn-ghost" onClick={() => setMoviendo(null)}>Cerrar</button>}
      >
        <div className="app-form">
          {error && <div className="banner-inline banner-inline--warn" role="alert">{error}</div>}
          {insistir && (
            <button
              className="btn btn-outline"
              type="button"
              disabled={apuntando}
              onClick={() => void apuntarMovimiento(
                insistir.tipo as 'compra' | 'rotura' | 'ajuste',
                insistir.cantidad, insistir.motivo, true,
              )}
            >
              Hacerlo igualmente
            </button>
          )}
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

      <CajonDeDescuentos
        open={descuentosOpen}
        onClose={() => setDescuentosOpen(false)}
        descuentos={descuentos}
        setDescuentos={setDescuentos}
        etiquetas={etiquetasDelCenso}
        avisar={avisar}
      />
    </>
  )
}

/**
 * LOS DESCUENTOS DE HERMANO.
 *
 * Se creaban dos de ejemplo y NO HABÍA PANTALLA PARA TOCARLOS. En la
 * demostración se veían porque venían con los datos de muestra; en una
 * hermandad de verdad la tabla nacía vacía y el selector de la caja estaba
 * vacío para siempre, sin nada que dijera por qué ni dónde se arregla.
 *
 * Va aquí y no en una pantalla propia porque un descuento es un dato del
 * catálogo: se decide junto al precio, no aparte.
 *
 * LA ETIQUETA ES UN DESPLEGABLE Y NO UN TEXTO LIBRE. Quien la decide de verdad
 * es la base: al cobrar comprueba que quien compra lleve esa etiqueta en su
 * ficha, y si no coincide LETRA POR LETRA rechaza la venta. Escrito a mano,
 * «costaleros» no es «Costalero» y el descuento no se lo lleva nadie —sin un
 * solo error hasta que hay una persona esperando en el mostrador—.
 */
function CajonDeDescuentos({ open, onClose, descuentos, setDescuentos, etiquetas, avisar }: {
  open: boolean
  onClose: () => void
  descuentos: Descuento[]
  setDescuentos: (accion: Descuento[] | ((prev: Descuento[]) => Descuento[])) => void
  etiquetas: string[]
  avisar: (t: string) => void
}) {
  const [error, setError] = useState('')

  function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formulario = e.currentTarget
    const d = new FormData(formulario)
    const nombre = String(d.get('nombre') ?? '').trim()
    const porcentaje = Number(String(d.get('porcentaje') ?? '').replace(',', '.'))
    if (!nombre) { setError('Ponle un nombre: es lo que se lee en el selector del mostrador.'); return }
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      setError('El porcentaje va entre 1 y 100.')
      return
    }
    const nuevo: Descuento = {
      id: nuevoId(),
      nombre,
      porcentaje,
      etiqueta: String(d.get('etiqueta') ?? '') || undefined,
      activo: true,
      creadoEn: new Date().toISOString(),
    }
    setDescuentos((prev) => [...prev, nuevo])
    formulario.reset()
    setError('')
    avisar(`Creado el descuento «${nombre}» del ${porcentaje} %.`)
  }

  function cambiarActivo(d: Descuento, activo: boolean) {
    setDescuentos((prev) => prev.map((x) => (x.id === d.id ? { ...x, activo } : x)))
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Descuentos de hermano"
      subtitle="Un porcentaje para un grupo, solo en el mostrador"
      footer={<button className="btn btn-ghost" onClick={onClose}>Cerrar</button>}
    >
      <div className="app-form">
        {descuentos.length === 0 ? (
          <p className="form-hint">
            Todavía no hay ninguno. Un descuento es un porcentaje para un grupo —los costaleros, el
            coro— que solo se le puede aplicar a quien lleve esa etiqueta en su ficha. Sin etiqueta,
            vale para cualquier hermano.
          </p>
        ) : (
          <div className="table-card table-card--in-drawer">
            <table>
              <thead>
                <tr><th>Descuento</th><th className="num">%</th><th>A quién</th><th /></tr>
              </thead>
              <tbody>
                {descuentos.map((d) => (
                  <tr key={d.id} className={d.activo ? undefined : 'fila--apagada'}>
                    <td><b>{d.nombre}</b></td>
                    <td className="num">{d.porcentaje} %</td>
                    <td>
                      {d.etiqueta
                        ? <span className="pill pill--info">{d.etiqueta}</span>
                        : 'Cualquier hermano'}
                    </td>
                    <td className="num">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => cambiarActivo(d, !d.activo)}
                      >
                        {d.activo ? 'Apagar' : 'Encender'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/*
          NO SE BORRAN, SE APAGAN. Un descuento borrado deja las facturas que lo
          llevaban apuntando a nada, y entonces nadie puede explicar por qué
          aquella camiseta costó siete euros.
        */}
        <p className="form-hint">
          Un descuento no se borra: se apaga. Las facturas que lo llevaban tienen que poder seguir
          diciendo por qué costaron lo que costaron.
        </p>

        <form className="app-form" onSubmit={guardar}>
          <h3>Añadir uno</h3>
          {error && <div className="banner-inline banner-inline--warn" role="alert">{error}</div>}
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="d-nombre">Nombre</label>
              <input id="d-nombre" name="nombre" placeholder="Costaleros, Coro…" />
            </div>
            <div className="form-row">
              <label htmlFor="d-pct">Porcentaje</label>
              <input
                id="d-pct" name="porcentaje" type="number"
                min="0" max="100" step="0.01" inputMode="decimal" defaultValue={10}
              />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="d-etiqueta">A quién se le aplica</label>
            <select id="d-etiqueta" name="etiqueta" defaultValue="">
              <option value="">A cualquier hermano</option>
              {etiquetas.map((e) => <option key={e} value={e}>Solo a: {e}</option>)}
            </select>
            <p className="form-hint">
              {etiquetas.length === 0
                ? 'Las etiquetas se ponen en la ficha del hermano. Todavía no hay ninguna, así que de momento solo se puede hacer uno para todos.'
                : 'La etiqueta sale del censo. Solo se le puede aplicar a quien la lleve en su ficha.'}
            </p>
          </div>
          <button className="btn btn-primary" type="submit">Añadir el descuento</button>
        </form>
      </div>
    </Drawer>
  )
}
