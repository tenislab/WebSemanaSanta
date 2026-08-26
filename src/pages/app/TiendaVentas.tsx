/**
 * LAS FACTURAS DE LA TIENDA.
 *
 * Es la pantalla a la que se viene cuando alguien vuelve al mostrador con algo
 * y hay que buscar lo que se le cobró, cuando el tesorero cuadra el trimestre,
 * o cuando alguien pide su factura tres semanas después.
 *
 * POR QUÉ NO BASTABA CON LA CAJA. Ahí se ve la venta que se acaba de hacer y
 * ya está: en cuanto se cobra la siguiente, la anterior desaparece de la
 * pantalla. Una hermandad que vende ciento veinte camisetas en un besamanos no
 * puede depender de que nadie cierre la pestaña.
 *
 * ANULAR NO BORRA. La factura se queda con su número ocupado y marcada como
 * anulada, el género vuelve al almacén y los dos asientos se contra-apuntan.
 * Una numeración con huecos es lo primero que mira una inspección, así que
 * borrar no es una opción — ni siquiera la de hace un minuto.
 */
import { useEffect, useMemo, useState } from 'react'
import Drawer from '../../components/Drawer'
import AvisoFalta from '../../components/AvisoFalta'
import FacturaTienda from '../../components/FacturaTienda'
import { requisito } from '../../lib/requisitos'
import { formatCurrency } from '../../lib/format'
import { fechaEs } from '../../lib/leerTabla'
import { hoyIso } from '../../lib/hoy'
import { llano } from '../../lib/buscar'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { anularVenta, lineasDeVenta, useVentas } from '../../lib/tienda'
import { referenciaFactura, type LineaVenta, type Venta } from '../../data/tienda'

type Filtro = 'todas' | 'fisica' | 'online' | 'anuladas'

/**
 * El día de una fecha con hora, EN HORA DE AQUÍ.
 *
 * `fecha` es un `timestamptz` y llega en UTC, así que `slice(0, 10)` daría el
 * día UTC: en España, una venta de las 00:30 aparecería en el listado con la
 * fecha del día anterior. Es el mismo fallo que `toISOString()` y por eso pasa
 * por `hoyIso`, que usa los componentes locales. Ver `lib/hoy.ts`.
 */
function dia(fecha: string): string {
  const d = new Date(fecha ?? '')
  return Number.isNaN(d.getTime()) ? '' : hoyIso(d)
}

export default function TiendaVentas() {
  const { ventas, cargando, recargar } = useVentas()
  const hermandad = useHermandadSettings()
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [abierta, setAbierta] = useState<Venta | null>(null)
  // `undefined` mientras se traen; `null` si no se han podido traer. Ver
  // `FacturaTienda`: de eso depende lo que se imprime.
  const [lineas, setLineas] = useState<LineaVenta[] | null | undefined>(undefined)
  const [anulando, setAnulando] = useState(false)
  const [pideMotivo, setPideMotivo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState('')

  const reqBase = requisito('supabase')

  useEffect(() => {
    if (!abierta) { setLineas(undefined); return }
    setLineas(undefined)
    let cancelado = false
    void lineasDeVenta(abierta.id).then((ls) => { if (!cancelado) setLineas(ls) })
    return () => { cancelado = true }
  }, [abierta])

  const visibles = useMemo(() => {
    const q = llano(query.trim())
    return ventas.filter((v) => {
      if (filtro === 'anuladas' && v.estado !== 'Anulada') return false
      if ((filtro === 'fisica' || filtro === 'online') && v.canal !== filtro) return false
      if (!q) return true
      return llano(referenciaFactura(v)).includes(q)
        || llano(v.compradorNombre).includes(q)
        || llano(v.compradorNif).includes(q)
    })
  }, [ventas, query, filtro])

  /*
   * LOS TOTALES SE CALCULAN SOBRE LO QUE SE ESTÁ VIENDO, no sobre todo. Es lo
   * que convierte los filtros en una herramienta de cuadre: filtrar por
   * «online» y leer arriba lo que se ha vendido por internet es la pregunta
   * que se hace de verdad. Y las anuladas NO suman: una factura anulada no ha
   * entrado en caja.
   */
  const resumen = useMemo(() => {
    const buenas = visibles.filter((v) => v.estado !== 'Anulada')
    return {
      facturas: buenas.length,
      base: buenas.reduce((n, v) => n + v.base, 0),
      iva: buenas.reduce((n, v) => n + v.ivaTotal, 0),
      total: buenas.reduce((n, v) => n + v.total, 0),
      margen: buenas.reduce((n, v) => n + (v.total - v.costeTotal), 0),
    }
  }, [visibles])

  async function anular() {
    if (!abierta || anulando) return
    setAnulando(true)
    setError('')
    const r = await anularVenta(abierta.id, motivo.trim())
    setAnulando(false)
    if (!r.ok) { setError(r.error ?? 'No se ha podido anular.'); return }
    setPideMotivo(false)
    setMotivo('')
    setAbierta(null)
    recargar()
    setHecho('Anulada. El género ha vuelto al almacén y los apuntes se han contra-apuntado.')
    setTimeout(() => setHecho(''), 6000)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Tienda</p>
          <h1>Facturas</h1>
          <p className="dash-head__lead">Lo que se ha vendido, para buscarlo, reimprimirlo o anularlo.</p>
        </div>
      </div>

      {!reqBase.listo && <AvisoFalta requisito={reqBase} />}
      {hecho && <div className="banner banner--ok" role="status">{hecho}</div>}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Facturas</span>
          <span className="stat-tile__value">{resumen.facturas}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Sin contar las anuladas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Base imponible</span>
          <span className="stat-tile__value">{formatCurrency(resumen.base)}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">De lo que se está viendo</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">IVA repercutido</span>
          <span className="stat-tile__value">{formatCurrency(resumen.iva)}</span>
          {/* No es dinero de la hermandad: se cobra y se ingresa. Decirlo aquí
              evita leerlo como recaudación. */}
          <span className="stat-tile__trend stat-tile__trend--neutral">Se cobra y se ingresa</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Margen</span>
          <span className="stat-tile__value">{formatCurrency(resumen.margen)}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Cobrado menos coste</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por número de factura, nombre o NIF"
          aria-label="Buscar facturas por número, nombre o NIF"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {([
            ['todas', 'Todas'],
            ['fisica', 'En el mostrador'],
            ['online', 'Por internet'],
            ['anuladas', 'Anuladas'],
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
              <th>Nº</th>
              <th>Fecha</th>
              <th>Quién</th>
              <th>Cómo</th>
              <th className="num">Base</th>
              <th className="num">IVA</th>
              <th className="num">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibles.map((v) => (
              <tr key={v.id} className={v.estado === 'Anulada' ? 'fila--apagada' : undefined}>
                <td><code>{referenciaFactura(v)}</code></td>
                <td>{dia(v.fecha) ? fechaEs(dia(v.fecha)) : '—'}</td>
                <td>
                  {v.compradorNombre || <span className="form-hint">Mostrador</span>}
                  {v.estado === 'Anulada' && <span className="pill pill--off">Anulada</span>}
                  {v.descuentoPct > 0 && <span className="pill pill--info">−{v.descuentoPct} %</span>}
                </td>
                <td>
                  {v.canal === 'online' ? 'Internet' : 'Mostrador'}
                  {v.formaPago && <small className="portal__card-mini__sub"> · {v.formaPago}</small>}
                </td>
                <td className="num">{formatCurrency(v.base)}</td>
                <td className="num">{formatCurrency(v.ivaTotal)}</td>
                <td className="num"><b>{formatCurrency(v.total)}</b></td>
                <td className="num">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => { setAbierta(v); setError(''); setPideMotivo(false); setMotivo('') }}
                  >
                    Factura
                  </button>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={8} className="form-hint">
                  {cargando
                    ? 'Buscando facturas…'
                    : ventas.length === 0
                      ? 'Todavía no se ha vendido nada. Las ventas se registran en la caja.'
                      : 'Ninguna factura con ese filtro.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={Boolean(abierta)}
        onClose={() => setAbierta(null)}
        title={abierta ? `Factura ${referenciaFactura(abierta)}` : 'Factura'}
        subtitle={abierta?.estado === 'Anulada' ? 'Anulada' : undefined}
        /* Una factura tiene cinco columnas: en 440 px la de artículo se parte
           en tres líneas y las de números se tocan entre sí. */
        ancho="ancho"
        footer={abierta && (
          <>
            {abierta.estado !== 'Anulada' && (
              <button className="btn btn-ghost rgpd-borrar" onClick={() => setPideMotivo(true)}>
                Anular
              </button>
            )}
            {/* Sin artículos no se deja imprimir: saldría un A4 con membrete,
                número y total, sin una sola línea y sin desglose de IVA. */}
            <button
              className="btn btn-primary"
              onClick={() => window.print()}
              disabled={!lineas || lineas.length === 0}
            >
              {lineas ? 'Imprimir / Descargar' : 'Trayendo los artículos…'}
            </button>
          </>
        )}
      >
        {abierta && (
          <div className="app-form">
            {error && <div className="banner banner--error" role="alert">{error}</div>}

            {/*
              ANULAR PIDE UN MOTIVO Y UNA CONFIRMACIÓN, y no por ceremonia: va
              a devolver género al almacén y a meter dos apuntes contrarios en
              Tesorería. Hecho por error sobre la factura de al lado, deja el
              recuento y el libro descuadrados a la vez.
            */}
            {pideMotivo && (
              <div className="banner banner--warn">
                <p>
                  Se va a anular la factura <b>{referenciaFactura(abierta)}</b> de{' '}
                  <b>{formatCurrency(abierta.total)}</b>. El género vuelve al almacén y los apuntes
                  se contra-apuntan. La factura NO se borra: su número se queda ocupado.
                </p>
                <div className="form-row">
                  <label htmlFor="motivo-anular">Por qué se anula</label>
                  <input
                    id="motivo-anular"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Devolución, se cobró de más, talla equivocada…"
                  />
                </div>
                <div className="fila-botones">
                  <button className="btn btn-primary rgpd-borrar" onClick={() => void anular()} disabled={anulando}>
                    {anulando ? 'Anulando…' : 'Sí, anular'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setPideMotivo(false)} disabled={anulando}>
                    Dejarlo
                  </button>
                </div>
              </div>
            )}

            <FacturaTienda venta={abierta} lineas={lineas} hermandad={hermandad} />
          </div>
        )}
      </Drawer>
    </div>
  )
}
