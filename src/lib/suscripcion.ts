import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'

/**
 * Suscripción de la hermandad a la app. Sin suscripción activa, el panel queda
 * bloqueado (ver AppShell). El cobro real (Stripe) se conectará más adelante;
 * por ahora «Suscribirse» activa la cuenta sin cobrar, para poder probar el
 * flujo. No hay periodo de prueba gratuito.
 */

export type PlanId = 'mensual' | 'anual'

export interface Plan {
  id: PlanId
  nombre: string
  precio: string
  periodo: string
  detalle: string
}

export const PLANES: Plan[] = [
  { id: 'mensual', nombre: 'Mensual', precio: '20 €', periodo: '/mes', detalle: 'Facturación cada mes. Cancela cuando quieras.' },
  { id: 'anual', nombre: 'Anual', precio: '300 €', periodo: '/año', detalle: 'Un solo pago al año.' },
]

export interface Suscripcion {
  activa: boolean
  plan: PlanId | null
  desde: string | null
}

export const CLAVE_SUSCRIPCION = 'cabildo-suscripcion'

export const SUSCRIPCION_INICIAL: Suscripcion = { activa: false, plan: null, desde: null }

export function getSuscripcion(): Suscripcion {
  return leerPersistido<Suscripcion>(CLAVE_SUSCRIPCION, SUSCRIPCION_INICIAL)
}

export function saveSuscripcion(s: Suscripcion) {
  localStorage.setItem(CLAVE_SUSCRIPCION, JSON.stringify(s))
}

/** Hook con la suscripción y acciones para activarla o cancelarla. */
export function useSuscripcion() {
  const [suscripcion, setSuscripcion] = useState<Suscripcion>(() => getSuscripcion())

  useEffect(() => {
    function sincronizar() {
      setSuscripcion(getSuscripcion())
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  function activar(plan: PlanId, fechaISO: string) {
    const s: Suscripcion = { activa: true, plan, desde: fechaISO }
    setSuscripcion(s)
    saveSuscripcion(s)
  }

  function cancelar() {
    const s: Suscripcion = { activa: false, plan: null, desde: null }
    setSuscripcion(s)
    saveSuscripcion(s)
  }

  return { suscripcion, activar, cancelar }
}
