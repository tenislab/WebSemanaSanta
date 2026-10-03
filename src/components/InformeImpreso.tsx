/**
 * EL MARCO DE UN INFORME IMPRESO: la cabecera con el escudo y el pie legal.
 *
 * Envuelve el contenido de cualquier informe de `pages/app/Informes.tsx` para
 * que todos salgan con la misma cara. Y la cara importa: el estado de cuentas y
 * la memoria anual se entregan en la diócesis.
 *
 * ----------------------------------------------------------------------------
 * LO QUE SE REPITE EN CADA HOJA, QUE ES LA PARTE DIFÍCIL
 * ----------------------------------------------------------------------------
 *
 * Un informe son varias hojas, y cada una tiene que llevar de quién es.
 * `.print-hoja` va con `position: fixed`, que es lo único que el navegador
 * repite en todas las páginas al imprimir — pero entonces el navegador lo clava
 * encima del contenido, así que hace falta reservarle el hueco (ver
 * `print-pie-hueco` y el comentario de abajo).
 *
 * El tema oscuro deja el papel en blanco si los colores se heredan: aquí se
 * fuerzan. Y el escudo y el CIF salen de `HermandadSettings`, de la hermandad
 * de verdad, no de los de fábrica.
 */
import { LogoMark } from './Logo'
import { direccionEnUnaLinea, type HermandadSettings } from '../lib/hermandadSettings'
import { hayDatosDeEjemplo } from '../lib/demo'

export default function InformeImpreso({
  hermandad,
  titulo,
  generadoEl,
  resumen,
  columnas,
  filas,
  className = '',
}: {
  hermandad: HermandadSettings
  titulo: string
  generadoEl: string
  resumen: { etiqueta: string; valor: string }[]
  columnas: string[]
  filas: (string | number)[][]
  className?: string
}) {
  const direccionHermandad = direccionEnUnaLinea(hermandad)

  return (
    <div className={`recibo-doc print-doc informe-doc ${className}`.trim()}>
      {/* Se repite en cada hoja impresa (ver .print-hoja). */}
      <div className="print-hoja">
        {hermandad.nombreLegal || 'Tu hermandad'} · {titulo}
      </div>
      <div className="recibo-doc__head">
        <div className="recibo-doc__brand">
          <span className="recibo-doc__logo">
            {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={30} />}
          </span>
          <div className="recibo-doc__brand-text">
            <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
            {hermandad.cif && <span>CIF {hermandad.cif}</span>}
            {direccionHermandad && <span>{direccionHermandad}</span>}
          </div>
        </div>
        <div className="recibo-doc__meta">
          <p className="eyebrow">Informe</p>
          <span className="recibo-doc__num">{titulo}</span>
          <span className="recibo-doc__date">Generado el {generadoEl}</span>
        </div>
      </div>

      <div className="informe-doc__resumen">
        {resumen.map((r) => (
          <div key={r.etiqueta}>
            <span className="table-subtle">{r.etiqueta}</span>
            <b>{r.valor}</b>
          </div>
        ))}
      </div>

      <table className="recibo-doc__table informe-doc__table">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {/*
          Hueco para el pie que se repite en cada hoja.

          `.print-hoja` va con `position: fixed`, y el navegador lo clava al
          fondo del área de contenido SIN quitarle sitio a nada: cuando la
          tabla llenaba la hoja justa, el pie se pintaba encima de la última
          fila y ese hermano salía tachado por una raya gris. En un padrón que
          se lleva al cabildo de cuentas, una línea ilegible es una línea que
          hay que ir a buscar a mano.

          Un `tfoot` es lo único que Chrome repite en todas las hojas Y le
          reserva su alto. No lleva nada dentro: el hueco es todo su trabajo.
        */}
        <tfoot className="print-pie-hueco">
          <tr>
            <td colSpan={columnas.length} />
          </tr>
        </tfoot>
      </table>

      <p className="recibo-doc__note">
        Documento generado por Gobergo
        {hayDatosDeEjemplo() && ' · datos de ejemplo, sin validez oficial'}
      </p>
    </div>
  )
}
