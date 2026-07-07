import { LogoMark } from './Logo'
import type { Hermano } from '../data/hermanos'
import type { HermandadSettings } from '../lib/hermandadSettings'
import type { Cuota } from '../data/cuotas'
import { formatCurrency, maskIban } from '../lib/format'

function estadoPillClass(estado: Cuota['estado']) {
  if (estado === 'Pagada') return 'pill--ok'
  if (estado === 'Pendiente') return 'pill--warn'
  return 'pill--err'
}

interface ReciboProps {
  cuota: Cuota
  hermano: Hermano
  hermandad: HermandadSettings
}

/**
 * El recibo/factura de una cuota, personalizado con los datos de la
 * hermandad (logo, nombre legal, CIF, dirección, IBAN) configurados en
 * Configuración, y los del hermano al que se emite.
 */
export default function Recibo({ cuota, hermano, hermandad }: ReciboProps) {
  const direccionHermandad = [hermandad.direccion, hermandad.codigoPostal, hermandad.ciudad]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="recibo-doc print-doc">
      <div className="recibo-doc__head">
        <div className="recibo-doc__brand">
          <span className="recibo-doc__logo">
            {hermandad.logoDataUrl ? (
              <img src={hermandad.logoDataUrl} alt="" />
            ) : (
              <LogoMark size={30} />
            )}
          </span>
          <div className="recibo-doc__brand-text">
            <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
            {hermandad.cif && <span>CIF {hermandad.cif}</span>}
            {direccionHermandad && <span>{direccionHermandad}</span>}
            {hermandad.email && <span>{hermandad.email}</span>}
          </div>
        </div>
        <div className="recibo-doc__meta">
          <p className="eyebrow">Recibo de cuota</p>
          <span className="recibo-doc__num">Nº {String(cuota.numero).padStart(4, '0')}</span>
          <span className="recibo-doc__date">Emitido el {cuota.fechaEmision}</span>
        </div>
      </div>

      <div className="recibo-doc__to">
        <span className="recibo-doc__label">Emitido a</span>
        <b>{hermano.nombre}</b>
        <span>Hermano nº {hermano.numero}</span>
        {hermano.direccion && <span>{hermano.direccion}</span>}
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
            <td>{cuota.concepto}</td>
            <td className="num">{formatCurrency(cuota.importe)}</td>
          </tr>
        </tbody>
      </table>

      <div className="recibo-doc__total">
        <span>Total</span>
        <b>{formatCurrency(cuota.importe)}</b>
      </div>

      <div className="recibo-doc__foot">
        <span className={`pill ${estadoPillClass(cuota.estado)}`}>
          {cuota.estado}
          {cuota.fechaPago ? ` · ${cuota.fechaPago}` : ''}
        </span>
        {cuota.domiciliada && hermano.iban && (
          <span className="recibo-doc__iban">
            Domiciliado en tu cuenta {maskIban(hermano.iban)} · cobro previsto el {cuota.fechaCobro}
          </span>
        )}
        {cuota.domiciliada && !hermano.iban && (
          <span className="recibo-doc__iban recibo-doc__iban--warn">
            Marcada como domiciliada, pero {hermano.nombre.split(' ')[0]} no tiene cuenta bancaria
            registrada
          </span>
        )}
        {!cuota.domiciliada && hermandad.iban && (
          <span className="recibo-doc__iban">
            Pago manual · puedes transferir a {maskIban(hermandad.iban)}
          </span>
        )}
        {!cuota.domiciliada && !hermandad.iban && (
          <span className="recibo-doc__iban">Pago manual · previsto el {cuota.fechaCobro}</span>
        )}
      </div>

      <p className="recibo-doc__note">
        Documento generado por Cabildo · datos de ejemplo, sin validez fiscal
      </p>
    </div>
  )
}
