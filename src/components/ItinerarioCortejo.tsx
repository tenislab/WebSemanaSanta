/**
 * EL ITINERARIO, EN EL PAPEL QUE SE LLEVA A LA CALLE.
 *
 * El recorrido con sus horas de paso ya existía —se escribe en Web pública y se
 * publica ahí—, pero NO LLEGABA A CORTEJO. O sea: el hermano lo veía por
 * internet desde el móvil, y la hermandad que organiza la salida no lo tenía en
 * la hoja que reparte. Llegó dicho así: «el orden del cortejo se puede imprimir
 * pero el itinerario no está».
 *
 * Y es justo el papel donde hace falta. El diputado de tramo va por la calle
 * con esa hoja en la mano; la pregunta que le hacen cada diez minutos es a qué
 * hora se pasa por tal sitio.
 *
 * SE LEE DE DONDE YA ESTABA. No hay un segundo itinerario que mantener: es el
 * mismo que se publica en la web, y se edita en un solo sitio. Dos copias del
 * recorrido son dos horarios distintos el Viernes Santo.
 */
import type { EstacionPenitencia } from '../lib/webPublica'
import { hayItinerario } from '../lib/webPublica'

export default function ItinerarioCortejo({ estacion: e }: { estacion: EstacionPenitencia }) {
  if (!hayItinerario(e)) return null

  // La cabecera del día: sale y entra. Va antes del recorrido porque es lo
  // primero que se mira, y porque a veces es lo único que hay puesto.
  const cabecera = [
    e.dia && e.anio ? `${e.dia} ${e.anio}` : e.dia || e.anio,
    e.horaSalida && `sale a las ${e.horaSalida}`,
    e.horaEntrada && `entra a las ${e.horaEntrada}`,
    e.salidaDesde && `desde ${e.salidaDesde}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="itinerario-doc">
      <h3>Itinerario</h3>
      {cabecera && <p className="itinerario-doc__cabecera">{cabecera}</p>}
      <ol className="itinerario-doc__lista">
        {e.itinerario
          // Una parada a medio escribir en el editor no tiene por qué salir en
          // la hoja de la calle.
          .filter((p) => p.lugar.trim() || p.hora.trim())
          .map((p) => (
            <li key={p.id} className={p.destacada ? 'itinerario-doc__hito' : undefined}>
              {/* La hora primero y con cifras de ancho fijo: la columna se lee
                  de un vistazo bajando el dedo, que es como se usa. */}
              <span className="itinerario-doc__hora">{p.hora || '—'}</span>
              <span>{p.lugar}</span>
            </li>
          ))}
      </ol>
      {e.nota && <p className="itinerario-doc__nota">{e.nota}</p>}
    </div>
  )
}
