import { EVENTOS_INICIALES, calendarioEntre, type Evento } from '../data/eventos'
import { CLAVES_DATOS, leerDatos } from './persistencia'
import type { CultoWeb } from './webPublica'

/**
 * Los próximos cultos del calendario (módulo de Eventos), listos para pintar
 * en la web pública. Así la hermandad apunta un culto UNA vez y sale en los
 * dos sitios, en vez de copiarlo a mano y que se les quede desfasado.
 *
 * Solo salen los que tienen sentido para el que visita la web: cultos, salidas
 * y actos de convivencia o caridad. Los cabildos y la formación interna no.
 */
const TIPOS_PUBLICOS = new Set(['Culto', 'Salida', 'Caridad', 'Convivencia'])

/** Fecha de hoy en ISO pero en hora LOCAL (con UTC, de madrugada da el día anterior). */
function hoyIso(hoy = new Date()): string {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

export function cultosDelCalendario(hoy = new Date(), maximo = 6): CultoWeb[] {
  const anioActual = hoy.getFullYear()
  /**
   * `leerDatos` y no `leerPersistido`: con base de datos conectada devuelve
   * lista vacía en vez de los eventos de EJEMPLO.
   *
   * Estos cultos salen en la WEB PÚBLICA de la hermandad, la que ve cualquiera.
   * Con `leerPersistido`, una hermandad que aún no hubiera abierto Eventos
   * anunciaba en su web el «Besamanos» y el «Triduo» de la hermandad de
   * mentira de Gobergo: con sus fechas, sus horas y su iglesia. Gente
   * presentándose a un culto que no existe.
   *
   * Vacío no es bonito, pero es la verdad, y la sección no se pinta.
   */
  const eventos = leerDatos<Evento>(CLAVES_DATOS.eventos, EVENTOS_INICIALES)
  const desde = hoyIso(hoy)
  /**
   * SE CUENTAN LAS REPETICIONES, no solo la primera fecha.
   *
   * Antes se filtraba por `e.fecha >= hoy`, que es la fecha de la PRIMERA vez.
   * Un culto «todos los primeros viernes» tiene esa fecha en el pasado desde el
   * segundo mes, así que desaparecía del calendario y de la web justo cuando
   * empezaba a repetirse de verdad. La hermandad lo había puesto una vez para
   * todo el año y se le iba borrando solo.
   *
   * `aparicionesEntre` sabe desdoblar la repetición. Se mira un año vista, que
   * es lo que cabe en el ciclo de una hermandad.
   */
  const dentroDeUnAnio = new Date(hoy)
  dentroDeUnAnio.setFullYear(dentroDeUnAnio.getFullYear() + 1)
  return calendarioEntre(
    eventos.filter((e) => TIPOS_PUBLICOS.has(e.tipo)),
    desde,
    hoyIso(dentroDeUnAnio),
  )
    .slice(0, maximo)
    .map(({ evento: e, fecha }) => ({
      // El id lleva la fecha además del evento: un culto que se repite genera
      // varias entradas y todas tienen el mismo `e.id`. Sin la fecha, React
      // pintaba una sola y las demás desaparecían.
      id: `cal-${e.id}-${fecha}`,
      titulo: e.titulo,
      detalle: e.descripcion ?? '',
      fecha: fechaLegible(fecha, e.hora, anioActual),
      lugar: e.lugar ?? '',
      fotoDataUrl: null,
      // La fecha de verdad, para saber cuál es el próximo y contar los días.
      fechaIso: fecha,
    }))
}

/**
 * «Domingo, 23 de agosto · 20:30», con el año solo si NO es el de ahora: en
 * agosto, un «domingo 28 de marzo» sin año no dice si es dentro de siete meses
 * o del año que viene.
 */
function fechaLegible(iso: string, hora: string | undefined, anioActual: number): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const texto = d.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    ...(d.getFullYear() === anioActual ? {} : { year: 'numeric' }),
  })
  const conMayuscula = texto.charAt(0).toUpperCase() + texto.slice(1)
  return hora ? `${conMayuscula} · ${hora}` : conMayuscula
}
