import { LogoMark } from './Logo'
import QrPreview from './QrPreview'
import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'
import type { HermandadSettings } from '../lib/hermandadSettings'

const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

function estadoPillClass(estado: Papeleta['estado']) {
  if (estado === 'Entregada' || estado === 'Pagada') return 'pill--ok'
  if (estado === 'Asignada' || estado === 'Solicitada') return 'pill--warn'
  return 'pill--err'
}

interface PapeletaTicketProps {
  papeleta: Papeleta
  hermano: Hermano
  hermandad: HermandadSettings
}

/** La papeleta de sitio, personalizada con los datos de la hermandad y del hermano. */
export default function PapeletaTicket({ papeleta, hermano, hermandad }: PapeletaTicketProps) {
  return (
    <div className="ticket-doc print-doc">
      <div className="ticket-doc__head">
        <span className="ticket-doc__logo">
          {hermandad.logoDataUrl ? (
            <img src={hermandad.logoDataUrl} alt="" />
          ) : (
            <LogoMark size={26} />
          )}
        </span>
        <div className="ticket-doc__brand-text">
          <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
          <span>Papeleta de sitio</span>
        </div>
        <span className="ticket-doc__num">Nº {String(papeleta.numero).padStart(4, '0')}</span>
      </div>

      <div className="ticket-doc__body">
        <div className="ticket-doc__info">
          <span className="recibo-doc__label">Titular</span>
          <b>{hermano.nombre}</b>
          <span>Hermano nº {hermano.numero} · Hermano desde {hermano.antiguedad}</span>

          <span className="recibo-doc__label ticket-doc__tramo-label">Tramo asignado</span>
          {papeleta.tramo ? (
            <b>{papeleta.tramo}</b>
          ) : (
            <span className="ticket-doc__pending">Pendiente de asignar</span>
          )}

          <div className="ticket-doc__row">
            <span className={`pill ${estadoPillClass(papeleta.estado)}`}>{papeleta.estado}</span>
            <span className="ticket-doc__importe">{currency.format(papeleta.importe)}</span>
          </div>
        </div>

        <div className="ticket-doc__qr">
          <QrPreview seed={`PAP-${papeleta.numero}`} />
          <span>Vista previa</span>
        </div>
      </div>

      <div className="ticket-doc__perf" aria-hidden="true" />

      <div className="ticket-doc__foot">
        <span>Solicitada el {papeleta.fechaSolicitud}</span>
        {papeleta.fechaEntrega && <span>Entregada el {papeleta.fechaEntrega}</span>}
      </div>

      <p className="recibo-doc__note">
        Documento generado por Cabildo · el código QR verificable se activará con la base de
        datos
      </p>
    </div>
  )
}
