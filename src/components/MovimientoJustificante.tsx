import { LogoMark } from './Logo'
import type { HermandadSettings } from '../lib/hermandadSettings'
import type { Movimiento } from '../data/movimientos'
import { formatCurrency } from '../lib/format'

/** El justificante de un movimiento de caja (ingreso o gasto), con los datos de la hermandad configurados en Configuración. */
export default function MovimientoJustificante({
  movimiento,
  hermandad,
}: {
  movimiento: Movimiento
  hermandad: HermandadSettings
}) {
  const direccionHermandad = [hermandad.direccion, hermandad.codigoPostal, hermandad.ciudad]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="recibo-doc print-doc">
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
          <p className="eyebrow">Justificante de {movimiento.tipo === 'Ingreso' ? 'ingreso' : 'gasto'}</p>
          <span className="recibo-doc__num">Nº {String(movimiento.numero).padStart(4, '0')}</span>
          <span className="recibo-doc__date">Fecha {movimiento.fecha}</span>
        </div>
      </div>

      <table className="recibo-doc__table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {movimiento.concepto}
              <br />
              <span className="table-subtle">{movimiento.categoria} · {movimiento.cuenta}</span>
            </td>
            <td className="num">
              {movimiento.tipo === 'Gasto' ? '−' : '+'}
              {formatCurrency(movimiento.importe)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="recibo-doc__total">
        <span>Total</span>
        <b>
          {movimiento.tipo === 'Gasto' ? '−' : '+'}
          {formatCurrency(movimiento.importe)}
        </b>
      </div>

      <div className="recibo-doc__foot">
        <span className={`pill ${movimiento.estado === 'Conciliado' ? 'pill--ok' : 'pill--warn'}`}>{movimiento.estado}</span>
      </div>

      <p className="recibo-doc__note">
        Documento generado por Cabildo · datos de ejemplo, sin validez fiscal
      </p>
    </div>
  )
}
