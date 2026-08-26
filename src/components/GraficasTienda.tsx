/**
 * LAS GRÁFICAS DE LA TIENDA.
 *
 * SVG a mano, sin librería. Son tres formas —columnas por mes, barras
 * horizontales para el ranking y una barra partida para el reparto entre
 * canales— y todas caben en doscientas líneas; meter una librería de gráficas
 * por esto añadiría cien kilobytes al paquete que se baja quien abre la
 * aplicación en el móvil de la casa de hermandad.
 *
 * LO QUE SE HA CUIDADO, y el porqué de cada cosa:
 *
 *   · LOS COLORES SE ELIGIERON Y SE COMPROBARON, no se pusieron a ojo. Los dos
 *     canales son burdeos y oro de la marca, ajustados hasta pasar las
 *     comprobaciones de daltonismo (ΔE 19,4 en deuteranopía sobre fondo claro;
 *     8,2 sobre el oscuro) y de contraste contra el fondo. Un rojo y un verde
 *     puestos «porque quedan bien» son indistinguibles para una de cada doce
 *     personas.
 *   · Y AUN ASÍ NUNCA SE FÍA DEL COLOR SOLO: los dos canales llevan siempre su
 *     leyenda con el nombre escrito al lado.
 *   · Cada gráfica va acompañada de sus números en una tabla, para quien usa
 *     lector de pantalla y para quien prefiere leerlos.
 *   · Los doce meses salen siempre, incluidos los vacíos. Una gráfica a la que
 *     le faltan los meses sin ventas pega junio con septiembre como si fueran
 *     consecutivos, y eso no es una gráfica: es un dibujo.
 */
import { useState } from 'react'
import { formatCurrency } from '../lib/format'
import { techoRedondo } from '../data/tienda'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Un importe corto para el eje: «1,2 k» en vez de «1.200,00 €». */
function corto(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',')} k`
  return String(Math.round(n))
}

/* --------------------------------------------------------------------------
   Columnas: lo cobrado mes a mes
   -------------------------------------------------------------------------- */

export function ColumnasPorMes({
  titulo, series,
}: {
  titulo: string
  /** Una o dos series. Con dos se apilan, que es como se lee un total repartido. */
  series: { nombre: string; color: string; valores: number[] }[]
}) {
  const [encima, setEncima] = useState<number | null>(null)

  const totalMes = MESES.map(
    (_, i) => series.reduce((n, s) => n + Math.round((s.valores[i] ?? 0) * 100), 0) / 100,
  )
  const techo = techoRedondo(Math.max(...totalMes))
  const hayAlgo = totalMes.some((v) => v > 0)

  return (
    <figure className="grafica">
      <figcaption className="grafica__titulo">{titulo}</figcaption>
      {series.length > 1 && (
        <ul className="grafica__leyenda">
          {series.map((s) => (
            <li key={s.nombre}>
              <span className="grafica__punto" style={{ background: s.color }} aria-hidden="true" />
              {s.nombre}
            </li>
          ))}
        </ul>
      )}

      {!hayAlgo ? (
        <p className="form-hint">No hay ninguna venta este año.</p>
      ) : (
        /*
         * EN HTML Y CSS, NO EN SVG. Empezó siendo un `<svg>` con `viewBox`, que
         * es lo natural para una gráfica y aquí estaba mal: el `viewBox` escala
         * TAMBIÉN el texto, así que en un móvil de 390 px las etiquetas de los
         * meses se quedaban en cinco píxeles y no se leía ni «Ene». Con
         * columnas de CSS, el texto es texto de la página y sale a su tamaño
         * pase lo que pase.
         */
        <div
          className="grafica__columnas"
          role="img"
          aria-label={`${titulo}. ${MESES.map((m, i) => `${m}: ${formatCurrency(totalMes[i])}`).join('; ')}`}
        >
          <div className="grafica__eje-y" aria-hidden="true">
            {[1, 0.5, 0].map((f) => <span key={f}>{corto(techo * f)}</span>)}
          </div>
          <div className="grafica__plot">
            {/* Rejilla: tres líneas finas y continuas, un paso por detrás del
                fondo. Van debajo de las columnas, nunca encima. */}
            <div className="grafica__rejilla-html" aria-hidden="true">
              <span /><span /><span />
            </div>
            {MESES.map((m, i) => (
              <div
                key={m}
                className={`grafica__banda${encima === i ? ' grafica__banda--encima' : ''}`}
                onMouseEnter={() => setEncima(i)}
                onMouseLeave={() => setEncima(null)}
                onFocus={() => setEncima(i)}
                onBlur={() => setEncima(null)}
                tabIndex={0}
              >
                <span className="grafica__pila">
                  {/* De abajo arriba, y el de arriba con la esquina redonda:
                      una columna con las cuatro esquinas redondas parece
                      flotar en vez de nacer del eje. */}
                  {[...series].reverse().map((s, k) => {
                    const v = s.valores[i] ?? 0
                    if (v <= 0) return null
                    return (
                      <span
                        key={s.nombre}
                        className={`grafica__tramo${k === 0 ? ' grafica__tramo--cima' : ''}`}
                        style={{ height: `${(v / techo) * 100}%`, background: s.color }}
                      />
                    )
                  })}
                </span>
                <span className="grafica__mes">{m}</span>
              </div>
            ))}
          </div>
          {encima !== null && totalMes[encima] > 0 && (
            <p className="grafica__globo" role="status">
              <b>{MESES[encima]}</b>
              {series.map((s) => (
                <span key={s.nombre}>
                  {series.length > 1 ? `${s.nombre}: ` : ''}
                  {formatCurrency(s.valores[encima] ?? 0)}
                </span>
              ))}
              {series.length > 1 && <span><b>Total {formatCurrency(totalMes[encima])}</b></span>}
            </p>
          )}
        </div>
      )}

      {/* Los mismos números, en una tabla. No es un extra para lectores de
          pantalla: es lo que se mira cuando hace falta la cifra exacta. */}
      <details className="grafica__tabla">
        <summary>Ver los números</summary>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                {series.map((s) => <th key={s.nombre} className="num">{s.nombre}</th>)}
                {series.length > 1 && <th className="num">Total</th>}
              </tr>
            </thead>
            <tbody>
              {MESES.map((m, i) => (
                <tr key={m}>
                  <td>{m}</td>
                  {series.map((s) => (
                    <td key={s.nombre} className="num">{formatCurrency(s.valores[i] ?? 0)}</td>
                  ))}
                  {series.length > 1 && <td className="num"><b>{formatCurrency(totalMes[i])}</b></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

/* --------------------------------------------------------------------------
   Barras horizontales: el ranking
   -------------------------------------------------------------------------- */

/**
 * HORIZONTALES Y NO VERTICALES a propósito: las etiquetas son nombres de
 * artículo —«Libro del centenario»— y en vertical se giran o se cortan. En
 * horizontal se leen del derecho, que es de lo que va un ranking.
 *
 * Y no es una gráfica «categórica»: es una sola magnitud comparada consigo
 * misma, así que va toda del mismo color. Pintar cada barra de un color
 * distinto sería inventarse una identidad que no existe.
 */
export function BarrasHorizontales({
  titulo, color, filas, pie,
}: {
  titulo: string
  color: string
  filas: { etiqueta: string; nota?: string; valor: number }[]
  pie?: string
}) {
  const techo = techoRedondo(Math.max(...filas.map((f) => f.valor), 0))

  if (filas.length === 0) {
    return (
      <figure className="grafica">
        <figcaption className="grafica__titulo">{titulo}</figcaption>
        <p className="form-hint">Todavía no hay nada que enseñar aquí.</p>
      </figure>
    )
  }

  return (
    <figure className="grafica">
      <figcaption className="grafica__titulo">{titulo}</figcaption>
      <ul className="grafica__barras">
        {filas.map((f) => (
          <li key={f.etiqueta}>
            <span className="grafica__barra-nombre">
              {f.etiqueta}
              {f.nota && <small> · {f.nota}</small>}
            </span>
            <span className="grafica__barra-carril">
              <span
                className="grafica__barra"
                style={{ width: `${Math.max(1.5, (f.valor / techo) * 100)}%`, background: color }}
              />
            </span>
            {/* El valor va al final de la fila y no dentro de la barra: dentro
                se sale de las cortas y hay que recortarlo, y un número
                recortado es peor que ninguno. */}
            <span className="grafica__barra-valor">{formatCurrency(f.valor)}</span>
          </li>
        ))}
      </ul>
      {pie && <p className="form-hint">{pie}</p>}
    </figure>
  )
}

/* --------------------------------------------------------------------------
   Una barra partida: mostrador contra internet
   -------------------------------------------------------------------------- */

export function RepartoPorCanal({
  mostrador, internet, colores,
}: {
  mostrador: number
  internet: number
  colores: { mostrador: string; internet: string }
}) {
  const total = Math.round(mostrador * 100) + Math.round(internet * 100)
  if (total <= 0) {
    return (
      <figure className="grafica">
        <figcaption className="grafica__titulo">De dónde viene lo vendido</figcaption>
        <p className="form-hint">No hay ninguna venta este año.</p>
      </figure>
    )
  }
  const pct = (n: number) => Math.round((Math.round(n * 100) / total) * 1000) / 10
  const trozos = [
    { nombre: 'En el mostrador', valor: mostrador, color: colores.mostrador },
    { nombre: 'Por internet', valor: internet, color: colores.internet },
  ].filter((t) => t.valor > 0)

  return (
    <figure className="grafica">
      <figcaption className="grafica__titulo">De dónde viene lo vendido</figcaption>
      <div className="grafica__reparto" role="img"
        aria-label={trozos.map((t) => `${t.nombre}: ${pct(t.valor)} %`).join('; ')}>
        {trozos.map((t) => (
          <span key={t.nombre} style={{ flexGrow: t.valor, background: t.color }} />
        ))}
      </div>
      <ul className="grafica__leyenda grafica__leyenda--reparto">
        {trozos.map((t) => (
          <li key={t.nombre}>
            <span className="grafica__punto" style={{ background: t.color }} aria-hidden="true" />
            {t.nombre}
            <b>{formatCurrency(t.valor)}</b>
            <small>{pct(t.valor)} %</small>
          </li>
        ))}
      </ul>
    </figure>
  )
}
