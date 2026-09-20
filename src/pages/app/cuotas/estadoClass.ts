import { type EstadoCuota } from '../../../data/cuotas'

/**
 * El color de la pastilla del estado de un recibo.
 *
 * Estaba suelta en `Cuotas.tsx`. Sale a su fichero porque ahora la necesitan
 * DOS: la pantalla y el cuerpo memorizado de su tabla. La otra salida era que
 * el hijo importara del padre, y eso deja un ciclo que funciona por casualidad.
 */
export function estadoClass(estado: EstadoCuota) {
  if (estado === 'Pagada') return 'pill--ok'
  if (estado === 'Pendiente') return 'pill--warn'
  return 'pill--err'
}
