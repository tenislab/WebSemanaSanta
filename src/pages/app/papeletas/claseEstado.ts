import { type EstadoRenovacion } from '../../../lib/campana'

/**
 * El color de la pastilla del estado de renovación.
 *
 * Estaba suelta en `Papeletas.tsx`. Sale a su fichero porque ahora la usan la
 * pantalla y el cuerpo memorizado de su tabla; la alternativa era que el hijo
 * importara del padre, que deja un ciclo que funciona de casualidad.
 */
export function claseEstado(estado: EstadoRenovacion) {
  if (estado === 'Renovada' || estado === 'Nueva') return 'pill--ok'
  if (estado === 'Por renovar') return 'pill--warn'
  if (estado === 'No renovada') return 'pill--err'
  return 'pill--off'
}
