/** Cuánta gente entra en la web y por dónde. */
import {
  SIN_VISITAS,
  diaCorto,
  nombreDeRuta,
  resumenDeVisitas,
  variacion,
  type ResumenDeVisitas,
} from '../../../lib/visitas'
import { useEffect, useState } from 'react'

export function VisitasTab() {
  const [dias, setDias] = useState(30)
  const [datos, setDatos] = useState<ResumenDeVisitas>(SIN_VISITAS)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    resumenDeVisitas(dias).then((r) => {
      if (!vivo) return
      setDatos(r)
      setCargando(false)
    })
    return () => { vivo = false }
  }, [dias])

  const cambio = variacion(datos.total, datos.totalAnterior)
  // El día más alto manda la altura de las barras. Con el máximo a cero —web
  // recién publicada— se dividiría por cero y no se pintaría nada.
  const techo = datos.dias.reduce((n, d) => (d.visitas > n ? d.visitas : n), 0) || 1

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Visitas</h2>
        <div className="visitas-periodo" role="group" aria-label="Periodo">
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              type="button"
              className={`chip${dias === n ? ' chip--active' : ''}`}
              aria-pressed={dias === n}
              onClick={() => setDias(n)}
            >
              {n} días
            </button>
          ))}
        </div>
      </div>

      {/*
        SE DICE LO QUE ES Y LO QUE NO. Un número sin explicar se lee como
        «personas que han entrado», y no lo es: si alguien abre tres páginas,
        son tres. Prefiero un número honesto a uno que impresione más.
      */}
      <p className="form-hint">
        Visitas a páginas, contadas por nosotros. Sin cookies, sin guardar
        direcciones IP y sin seguir a nadie — por eso vuestra web no necesita el
        cartel de las cookies. No dice cuántas personas distintas entran: eso no
        se puede saber sin seguirlas.
      </p>

      {cargando && <p className="form-hint">Contando…</p>}

      {!cargando && !datos.hayDatos && (
        <div className="banner-inline banner-inline--alerta">
          <span>
            No se ha podido leer el contador. Si es la primera vez, falta ejecutar{' '}
            <code>supabase/visitas-web.sql</code> en Supabase.
          </span>
        </div>
      )}

      {!cargando && datos.hayDatos && datos.total === 0 && (
        <p className="form-hint">
          Todavía no hay visitas en este periodo. Si acabas de publicar la web, dale unos días — o
          manda el enlace por el grupo de la hermandad, que es lo que de verdad la mueve.
        </p>
      )}

      {!cargando && datos.hayDatos && datos.total > 0 && (
        <>
          <section className="stat-grid">
            <div className="stat-tile">
              <span className="stat-tile__label">Visitas</span>
              <span className="stat-tile__value">{datos.total.toLocaleString('es-ES')}</span>
              <span className="stat-tile__trend stat-tile__trend--neutral">Últimos {dias} días</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">Respecto al periodo anterior</span>
              {/*
                Sin nada con qué comparar no se pinta un «+100%», que sería
                inventarse una subida donde solo hay un principio.
              */}
              <span className="stat-tile__value">
                {cambio === null ? '—' : `${cambio > 0 ? '+' : ''}${cambio}%`}
              </span>
              <span className={`stat-tile__trend stat-tile__trend--${cambio === null ? 'neutral' : cambio >= 0 ? 'ok' : 'warn'}`}>
                {cambio === null
                  ? 'Todavía no hay con qué comparar'
                  : `Antes: ${datos.totalAnterior.toLocaleString('es-ES')}`}
              </span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">Media al día</span>
              <span className="stat-tile__value">{Math.round(datos.total / dias).toLocaleString('es-ES')}</span>
              <span className="stat-tile__trend stat-tile__trend--neutral">{datos.paginas.length} páginas vistas</span>
            </div>
          </section>

          {/*
            El gráfico, con TODOS los días aunque estén a cero. Saltándose los
            vacíos, dos picos separados por una semana muerta se unen con una
            línea recta y parece que hubo visitas cuando no las hubo.
          */}
          <div className="visitas-grafico" role="img" aria-label={`Visitas por día de los últimos ${dias} días`}>
            {datos.dias.map((d) => (
              <span
                key={d.dia}
                className="visitas-grafico__barra"
                style={{ height: `${Math.max(2, (d.visitas / techo) * 100)}%` }}
                title={`${diaCorto(d.dia)}: ${d.visitas} ${d.visitas === 1 ? 'visita' : 'visitas'}`}
              />
            ))}
          </div>
          <p className="visitas-grafico__pie">
            <span>{diaCorto(datos.dias[0]?.dia ?? '')}</span>
            <span>Máximo en un día: {techo}</span>
            <span>{diaCorto(datos.dias[datos.dias.length - 1]?.dia ?? '')}</span>
          </p>

          <h3 className="visitas-titulo">Lo más visto</h3>
          <table className="table-card visitas-tabla">
            <thead>
              <tr><th>Página</th><th className="num">Visitas</th><th className="num">%</th></tr>
            </thead>
            <tbody>
              {/* Diez y no todas: con cuarenta noticias la tabla se come la
                  pantalla y lo que importa está en las primeras. */}
              {datos.paginas.slice(0, 10).map((p) => (
                <tr key={p.ruta}>
                  <td>
                    <b>{nombreDeRuta(p.ruta)}</b>
                    <small className="visitas-tabla__ruta">{p.ruta}</small>
                  </td>
                  <td className="num">{p.visitas.toLocaleString('es-ES')}</td>
                  <td className="num">{Math.round((p.visitas / datos.total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos.paginas.length > 10 && (
            <p className="form-hint">Y {datos.paginas.length - 10} páginas más con menos visitas.</p>
          )}
        </>
      )}
    </section>
  )
}
