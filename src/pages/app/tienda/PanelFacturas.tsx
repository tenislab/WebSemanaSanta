/**
 * LAS FACTURAS DE LA TIENDA.
 *
 * Es la pestaña a la que se viene cuando alguien vuelve al mostrador con algo y
 * hay que buscar lo que se le cobró, cuando el tesorero cuadra el trimestre, o
 * cuando alguien pide su factura tres semanas después.
 *
 * POR QUÉ NO BASTABA CON LA PESTAÑA DE VENDER. Ahí se ve la venta que se acaba
 * de hacer y ya está: en cuanto se cobra la siguiente, la anterior desaparece de
 * la pantalla. Una hermandad que vende ciento veinte camisetas en un besamanos
 * no puede depender de que nadie cierre la pestaña.
 *
 * ANULAR NO BORRA. La factura se queda con su número ocupado y marcada como
 * anulada, el género vuelve al almacén y los dos asientos se contra-apuntan. Una
 * numeración con huecos es lo primero que mira una inspección, así que borrar no
 * es una opción — ni siquiera la de hace un minuto.
 */
import { useEffect, useMemo, useState } from 'react'
import Drawer from '../../../components/Drawer'
import FacturaTienda from '../../../components/FacturaTienda'
import ToolbarTienda from '../../../components/tienda/ToolbarTienda'
import { formatCurrency } from '../../../lib/format'
import { fechaEs } from '../../../lib/leerTabla'
import { diaLocalDe } from '../../../lib/hoy'
import { llano } from '../../../lib/buscar'
import { anularVenta, lineasDeVenta, useVentas } from '../../../lib/tienda'
import { useTienda } from '../../../context/TiendaContext'
import { referenciaFactura, type LineaVenta, type Venta } from '../../../data/tienda'

type FiltroFacturas = 'todas' | 'fisica' | 'online' | 'anuladas'

const FILTROS = [
  ['todas', 'Todas'],
  ['fisica', 'En el mostrador'],
  ['online', 'Por internet'],
  ['anuladas', 'Anuladas'],
] as const

export default function PanelFacturas({ avisar }: { avisar: (t: string) => void }) {
  const { ventas, cargando, recargar } = useVentas()
  const { hermandad, recargarExistencias } = useTienda()
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<FiltroFacturas>('todas')
  const [abierta, setAbierta] = useState<Venta | null>(null)
  // `undefined` mientras se traen; `null` si no se han podido traer. Ver
  // `FacturaTienda`: de eso depende lo que se imprime.
  const [lineas, setLineas] = useState<LineaVenta[] | null | undefined>(undefined)
  const [anulando, setAnulando] = useState(false)
  const [pideMotivo, setPideMotivo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  /*
   * `undefined` = todavía preguntando · `null` = no se pudo · `[]` = sin líneas.
   * Los tres se pintan distinto, que es lo que faltaba: ver abajo.
   */
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    if (!abierta) { setLineas(undefined); return }
    setLineas(undefined)
    let cancelado = false
    void lineasDeVenta(abierta.id).then((ls) => { if (!cancelado) setLineas(ls) })
    return () => { cancelado = true }
  }, [abierta, intento])

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
   * que convierte los filtros en una herramienta de cuadre: filtrar por «online»
   * y leer arriba lo que se ha vendido por internet es la pregunta que se hace
   * de verdad. Y las anuladas NO suman: una factura anulada no ha entrado en
   * caja.
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
    recargarExistencias()
    avisar('Anulada. El género ha vuelto al almacén y los apuntes se han contra-apuntado.')
  }

  return (
    <>
      {/*
        Estas cuatro cifras son de LO QUE SE ESTÁ VIENDO, y por eso van debajo de
        los filtros y no en la cabecera de la pantalla: cambian con el filtro, y
        arriba, al lado de las tres cifras del día, se leerían como si fueran
        también del día.
      */}
      <ToolbarTienda
        busca="Buscar por número de factura, nombre o NIF"
        valor={query}
        onBuscar={setQuery}
        filtros={FILTROS}
        activo={filtro}
        onFiltrar={setFiltro}
      />

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
                <td>{diaLocalDe(v.fecha) ? fechaEs(diaLocalDe(v.fecha)) : '—'}</td>
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
                      ? 'Todavía no se ha vendido nada. Las ventas se registran en la pestaña «Vender».'
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
            {/*
              SIN ARTÍCULOS NO SE DEJA IMPRIMIR: saldría un A4 con membrete,
              número y total, sin una sola línea y sin desglose de IVA.

              PERO HAY QUE DECIR POR QUÉ. Antes el botón se quedaba apagado
              diciendo «Trayendo los artículos…» PARA SIEMPRE cuando la consulta
              fallaba —`lineasDeVenta` devuelve `null` en ese caso—, así que un
              fallo se veía exactamente igual que una carga lenta. Llegó
              reportado como «no deja imprimir factura», y desde fuera no hay
              manera de distinguirlo de que el botón esté roto.

              Son tres estados y ahora se ven los tres:
                · `undefined` — preguntando. El botón espera.
                · `null`      — no se pudo. Se dice, y se puede reintentar.
                · `[]`        — la venta no tiene líneas. Se dice también.
            */}
            {lineas === null ? (
              <button className="btn btn-outline" onClick={() => setIntento((n) => n + 1)}>
                No se pudieron traer los artículos · Reintentar
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => window.print()}
                disabled={lineas === undefined || lineas.length === 0}
              >
                {lineas === undefined
                  ? 'Trayendo los artículos…'
                  : lineas.length === 0
                    ? 'Esta factura no tiene artículos'
                    : 'Imprimir / Descargar'}
              </button>
            )}
          </>
        )}
      >
        {abierta && (
          <div className="app-form">
            {error && <div className="banner-inline banner-inline--warn" role="alert">{error}</div>}

            {/*
              ANULAR PIDE UN MOTIVO Y UNA CONFIRMACIÓN, y no por ceremonia: va a
              devolver género al almacén y a meter dos apuntes contrarios en
              Tesorería. Hecho por error sobre la factura de al lado, deja el
              recuento y el libro descuadrados a la vez.
            */}
            {pideMotivo && (
              <div className="banner-inline banner-inline--warn banner-inline--alerta">
                <div>
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
              </div>
            )}

            <FacturaTienda venta={abierta} lineas={lineas} hermandad={hermandad} />
          </div>
        )}
      </Drawer>
    </>
  )
}
