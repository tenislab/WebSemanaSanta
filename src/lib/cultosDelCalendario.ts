import { EVENTOS_INICIALES, type Evento } from '../data/eventos'
import { CLAVES_DATOS, leerPersistido } from './persistencia'
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
  const eventos = leerPersistido<Evento[]>(CLAVES_DATOS.eventos, EVENTOS_INICIALES)
  const desde = hoyIso(hoy)
  return eventos
    .filter((e) => TIPOS_PUBLICOS.has(e.tipo) && e.fecha >= desde)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, maximo)
    .map((e) => ({
      // El id lleva prefijo para no chocar nunca con un culto escrito a mano.
      id: `cal-${e.id}`,
      titulo: e.titulo,
      detalle: e.descripcion ?? '',
      fecha: fechaLegible(e.fecha, e.hora, anioActual),
      lugar: e.lugar ?? '',
      fotoDataUrl: null,
      // La fecha de verdad, para saber cuál es el próximo y contar los días.
      fechaIso: e.fecha,
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
