/**
 * CÓMO VA LA TIENDA.
 *
 * Tres vistas de lo mismo —el mostrador, internet, y los dos juntos— porque son
 * tres preguntas distintas: «¿ha merecido la pena poner la tienda en la web?»,
 * «¿qué hay que llevar al besamanos?» y «¿cuánto ha dejado la tienda este año?».
 * Con las tres mezcladas no se contesta ninguna.
 *
 * LO QUE SE ENSEÑA Y LO QUE NO. Aquí no está «lo facturado» a secas: está la
 * BASE, el IVA y el MARGEN por separado, porque son tres cosas que no se pueden
 * sumar. El IVA repercutido no es dinero de la hermandad —se cobra y se
 * ingresa—, y el margen no es lo cobrado —hay que descontar lo que costó el
 * género—. Un panel que enseña un solo número grande y lo llama «ingresos» es el
 * que hace que alguien crea que la tienda deja el triple de lo que deja.
 *
 * Las cifras las suma la base (`datos_tienda`), no el navegador. El porqué está
 * allí.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatCurrency } from '../../../lib/format'
import { hoyIso } from '../../../lib/hoy'
import { useDatosTienda } from '../../../lib/tienda'
import { BarrasHorizontales, ColumnasPorMes, RepartoPorCanal } from '../../../components/GraficasTienda'
import {
  comoPagaLaGente, doceMeses, losQueMasSeVenden, resumenDeTienda, type FiltroCanal,
} from '../../../data/tienda'
import type { Pestana } from '../Tienda'

/*
 * LOS DOS COLORES DE LOS CANALES, elegidos y COMPROBADOS.
 *
 * Burdeos y oro de la marca, ajustados hasta pasar las comprobaciones que
 * importan: separación en deuteranopía y protanopía, suelo de saturación —un oro
 * demasiado apagado se lee como gris— y contraste contra el fondo. Los del tema
 * oscuro NO son los mismos aclarados: se eligieron aparte y se comprobaron
 * contra el fondo oscuro, porque un color que funciona sobre blanco no tiene por
 * qué funcionar sobre carbón.
 *
 * Se leen de variables CSS para que el tema los cambie solo.
 */
const COLOR = {
  mostrador: 'var(--grafica-mostrador)',
  internet: 'var(--grafica-internet)',
}

type Vista = FiltroCanal

const VISTAS: { id: Vista; texto: string; lead: string }[] = [
  { id: 'todos', texto: 'Todo junto', lead: 'La tienda entera, por los dos canales.' },
  { id: 'fisica', texto: 'En el mostrador', lead: 'Lo que se vende en la casa de hermandad.' },
  { id: 'online', texto: 'Por internet', lead: 'Lo que se aparta en la web y se paga al recogerlo.' },
]

export default function PanelDatos({ acciones }: { acciones: (p: Pestana, nodo: ReactNode) => void }) {
  const [anio, setAnio] = useState(() => Number(hoyIso().slice(0, 4)))
  const [vista, setVista] = useState<Vista>('todos')
  const { datos, cargando, error } = useDatosTienda(anio)

  const resumen = useMemo(() => resumenDeTienda(datos?.meses ?? [], vista), [datos, vista])
  const ranking = useMemo(() => losQueMasSeVenden(datos?.articulos ?? [], vista), [datos, vista])
  const pagos = useMemo(() => comoPagaLaGente(datos?.formas ?? [], vista), [datos, vista])

  const series = useMemo(() => {
    if (vista === 'fisica') {
      return [{ nombre: 'En el mostrador', color: COLOR.mostrador, valores: doceMeses(datos?.meses ?? [], 'fisica') }]
    }
    if (vista === 'online') {
      return [{ nombre: 'Por internet', color: COLOR.internet, valores: doceMeses(datos?.meses ?? [], 'online') }]
    }
    return [
      { nombre: 'En el mostrador', color: COLOR.mostrador, valores: doceMeses(datos?.meses ?? [], 'fisica') },
      { nombre: 'Por internet', color: COLOR.internet, valores: doceMeses(datos?.meses ?? [], 'online') },
    ]
  }, [datos, vista])

  const laDeAhora = VISTAS.find((v) => v.id === vista) ?? VISTAS[0]

  /*
   * Los años que ofrecer. Salen de lo que hay vendido, más el actual: sin él,
   * una hermandad que todavía no ha vendido nada este año no podría ni mirar su
   * año en blanco, que es una respuesta perfectamente válida.
   */
  const anios = useMemo(() => {
    const deAhora = Number(hoyIso().slice(0, 4))
    return [...new Set([deAhora, ...(datos?.anios ?? []), anio])].sort((a, b) => b - a)
  }, [datos, anio])

  // El selector de ejercicio es la acción de esta pestaña: sube a la cabecera,
  // donde están las acciones de todas.
  useEffect(() => {
    acciones('datos', (
      <label className="dash-head__campo" htmlFor="tienda-anio">
        <span className="stat-tile__label">Ejercicio</span>
        <select
          id="tienda-anio"
          className="search-box"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
        >
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
    ))
  }, [acciones, anio, anios])

  return (
    <>
      {error && (
        <div className="banner-inline banner-inline--warn" role="alert">
          No se han podido traer los datos de la tienda: {error}. Las cifras de abajo NO son ceros
          de verdad, es que no se ha podido preguntar.
        </div>
      )}

      <div className="toolbar">
        <p className="dash-head__lead">{laDeAhora.lead}</p>
        <div className="filters">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`chip${vista === v.id ? ' chip--active' : ''}`}
              aria-pressed={vista === v.id}
              onClick={() => setVista(v.id)}
            >
              {v.texto}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <p className="form-hint">Sumando lo del ejercicio…</p>
      ) : (
        <>
          <section className="stat-grid">
            <div className="stat-tile">
              <span className="stat-tile__label">Cobrado</span>
              <span className="stat-tile__value">{formatCurrency(resumen.total)}</span>
              <span className="stat-tile__trend stat-tile__trend--neutral">
                {resumen.ventas} factura{resumen.ventas === 1 ? '' : 's'}, sin las anuladas
              </span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">Margen</span>
              <span className="stat-tile__value">{formatCurrency(resumen.margen)}</span>
              {/* Lo que de verdad le queda a la hermandad. Va al lado de lo
                  cobrado para que no se confundan: entre los dos está lo que
                  costó el género. */}
              <span className="stat-tile__trend stat-tile__trend--neutral">
                Cobrado menos {formatCurrency(resumen.coste)} de coste
              </span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">IVA repercutido</span>
              <span className="stat-tile__value">{formatCurrency(resumen.iva)}</span>
              <span className="stat-tile__trend stat-tile__trend--neutral">
                No es de la hermandad: se ingresa
              </span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">Se lleva cada uno</span>
              <span className="stat-tile__value">{formatCurrency(resumen.ticketMedio)}</span>
              <span className="stat-tile__trend stat-tile__trend--neutral">De media, por factura</span>
            </div>
          </section>

          <ColumnasPorMes titulo={`Lo cobrado mes a mes en ${anio}`} series={series} />

          {vista === 'todos' && (
            <RepartoPorCanal
              mostrador={resumenDeTienda(datos?.meses ?? [], 'fisica').total}
              internet={resumenDeTienda(datos?.meses ?? [], 'online').total}
              colores={{ mostrador: COLOR.mostrador, internet: COLOR.internet }}
            />
          )}

          <div className="datos-tienda__par">
            <BarrasHorizontales
              titulo="Lo que más se vende"
              color={vista === 'online' ? COLOR.internet : COLOR.mostrador}
              filas={ranking.lista.map((a) => ({
                etiqueta: a.nombre || a.codigo,
                nota: `${a.unidades} ud.`,
                valor: a.importe,
              }))}
              /* Se dice lo que se ha dejado fuera. Una lista de «los que más se
                 venden» que se calla que hay otros treinta se lee como si fueran
                 todos los que hay. */
              pie={ranking.resto > 0
                ? (ranking.resto === 1
                    ? `Y otro artículo más, por ${formatCurrency(ranking.restoImporte)}.`
                    : `Y otros ${ranking.resto} artículos más, por ${formatCurrency(ranking.restoImporte)}.`)
                : undefined}
            />
            <BarrasHorizontales
              titulo="Cómo paga la gente"
              color={vista === 'online' ? COLOR.internet : COLOR.mostrador}
              filas={pagos.map((f) => ({
                etiqueta: f.forma,
                nota: `${f.ventas} venta${f.ventas === 1 ? '' : 's'}`,
                valor: f.total,
              }))}
            />
          </div>
        </>
      )}
    </>
  )
}
