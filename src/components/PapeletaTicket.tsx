import { LogoMark } from './Logo'
import QrCode from './QrCode'
import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'
import type { HermandadSettings } from '../lib/hermandadSettings'
import { etiquetaTramo, type Tramo } from '../lib/tramos'
import { formatCurrency } from '../lib/format'

function estadoPillClass(estado: Papeleta['estado']) {
  if (estado === 'Entregada' || estado === 'Pagada') return 'pill--ok'
  if (estado === 'Asignada' || estado === 'Solicitada') return 'pill--warn'
  return 'pill--err'
}

interface PapeletaTicketProps {
  papeleta: Papeleta
  hermano: Hermano
  hermandad: HermandadSettings
  /** Tramo elegido para el cortejo (cruz de guía, vara, cirio…). */
  tramo?: Tramo | null
  /** Puesto dentro del tramo (1 = el hermano con el número más bajo), calculado en el momento. */
  puesto?: number | null
  /** Si el tramo elegido ya recibió más papeletas de las que caben. */
  excedeAforo?: boolean
  /** Papeleta personalizada de la hermandad (mantilla, simbólica…), cuando no va en un tramo. */
  opcion?: string | null
}

/** La papeleta de sitio, personalizada con los datos de la hermandad y del hermano. */
export default function PapeletaTicket({ papeleta, hermano, hermandad, tramo, puesto, excedeAforo, opcion }: PapeletaTicketProps) {
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

          <span className="recibo-doc__label ticket-doc__tramo-label">{tramo ? 'Tramo asignado' : opcion ? 'Papeleta' : 'Tramo asignado'}</span>
          {tramo ? (
            <>
              <b>
                {etiquetaTramo(tramo)}
                {puesto != null && <span className="table-subtle"> · puesto {puesto}</span>}
              </b>
              {tramo.tipo && <span className="pill pill--info ticket-doc__tipo">{tramo.tipo}</span>}
              {excedeAforo && <span className="pill pill--err ticket-doc__tipo">Excede aforo</span>}
            </>
          ) : opcion ? (
            <b>{opcion}</b>
          ) : (
            <span className="ticket-doc__pending">Pendiente de asignar</span>
          )}

          <div className="ticket-doc__row">
            <span className={`pill ${estadoPillClass(papeleta.estado)}`}>{papeleta.estado}</span>
            <span className="ticket-doc__importe">{formatCurrency(papeleta.importe)}</span>
          </div>
        </div>

        <div className="ticket-doc__qr">
          <QrCode
            value={`Papeleta nº ${papeleta.numero} · ${hermano.nombre} (nº ${hermano.numero}) · ${
              tramo ? etiquetaTramo(tramo) : opcion ?? 'Sin tramo'
            } · ${hermandad.nombreLegal || 'Tu hermandad'}`}
          />
          <span>Escanéalo para leer los datos</span>
        </div>
      </div>

      <div className="ticket-doc__perf" aria-hidden="true" />

      <div className="ticket-doc__foot">
        <span>Solicitada el {papeleta.fechaSolicitud}</span>
        {papeleta.fechaEntrega && <span>Entregada el {papeleta.fechaEntrega}</span>}
      </div>

      <p className="recibo-doc__note">
        Documento generado por Cabildo · el código QR es real y contiene los datos de la papeleta;
        la verificación automática al escanear llegará con la base de datos
      </p>
    </div>
  )
}
