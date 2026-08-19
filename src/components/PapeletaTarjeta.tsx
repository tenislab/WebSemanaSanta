import QrCode from './QrCode'
import { formatCurrency } from '../lib/format'
import { datosVerificacionDe, urlVerificacion } from '../lib/verificacion'
import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'

/**
 * La papeleta **en la pantalla**, no en un folio.
 *
 * Antes, el área del hermano pintaba el documento de imprimir a tamaño real
 * metido dentro de la página: en un móvil era un ladrillo que había que ampliar
 * con dos dedos para leer en qué tramo vas. Y eso es justo lo único que se mira
 * el día antes de la salida.
 *
 * Aquí van los cuatro datos que se consultan de verdad —dónde vas, qué puesto,
 * a qué hora y cuánto— grandes y legibles, más el QR para que lo lean en la
 * puerta. El documento entero sigue existiendo, pero solo al imprimir.
 */
/** «Domingo, 28 de marzo» a partir de una fecha ISO. Si no se entiende, se devuelve tal cual. */
function fechaLegible(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const t = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default function PapeletaTarjeta({
  papeleta,
  hermano,
  hermandadNombre,
  tramoEtiqueta,
  puesto,
  fechaSalida,
  excedeAforo,
}: {
  papeleta: Papeleta
  hermano: Hermano
  hermandadNombre: string
  tramoEtiqueta: string | null
  puesto?: number | null
  fechaSalida?: string
  excedeAforo?: boolean
}) {
  const sitio = tramoEtiqueta || papeleta.opcion || 'Sin sitio asignado todavía'
  const enlace = urlVerificacion(
    datosVerificacionDe(papeleta, hermano, sitio, hermandadNombre),
  )
  const pagada = papeleta.estado === 'Pagada' || papeleta.estado === 'Entregada'
  // La fecha en cristiano: «Domingo, 28 de marzo». En ISO («2027-03-28») nadie
  // sabe de un vistazo qué día de la semana cae, que es lo que se pregunta.
  const dia = fechaLegible(fechaSalida)

  return (
    <div className="pap-tarjeta">
      <div className="pap-tarjeta__cabeza">
        <span className="pap-tarjeta__ante">Papeleta de sitio · {papeleta.anio}</span>
        <span className={`pill ${pagada ? 'pill--ok' : papeleta.estado === 'Anulada' || papeleta.estado === 'Renuncia' ? 'pill--err' : 'pill--warn'}`}>
          {papeleta.estado}
        </span>
      </div>

      {/* Lo primero y más grande: dónde vas. Es a lo que se entra. */}
      <p className="pap-tarjeta__sitio">{sitio}</p>

      <dl className="pap-tarjeta__datos">
        {puesto != null && (
          <div>
            <dt>Puesto</dt>
            <dd>{puesto}</dd>
          </div>
        )}
        {dia && (
          <div>
            <dt>Día de la salida</dt>
            <dd className="pap-tarjeta__dia">{dia}</dd>
          </div>
        )}
        <div>
          <dt>Importe</dt>
          <dd>{formatCurrency(papeleta.importe)}</dd>
        </div>
        <div>
          <dt>Nº papeleta</dt>
          <dd>{papeleta.numero}</dd>
        </div>
      </dl>

      {excedeAforo && (
        <p className="pap-tarjeta__aviso">
          Este tramo ha recibido más solicitudes de las que caben. La hermandad te confirmará el
          sitio definitivo.
        </p>
      )}

      <div className="pap-tarjeta__qr">
        <QrCode value={enlace} size={112} />
        <span>Enséñalo en la puerta. Funciona sin cobertura.</span>
      </div>
    </div>
  )
}
