import { useState } from 'react'
import { LogoMark } from './Logo'
import { PLANES, type PlanId } from '../lib/suscripcion'

interface Props {
  nombreHermandad?: string
  onActivar: (plan: PlanId) => void
  onSalir: () => void
}

/**
 * Muro de suscripción: se muestra en lugar del panel cuando la hermandad no
 * tiene una suscripción activa. Elegir un plan la activa (sin cobro real por
 * ahora). No hay prueba gratuita.
 */
export default function PantallaSuscripcion({ nombreHermandad, onActivar, onSalir }: Props) {
  const [plan, setPlan] = useState<PlanId>('mensual')

  return (
    <div className="paywall">
      <div className="paywall__card">
        <LogoMark size={44} />
        <p className="eyebrow">Suscripción</p>
        <h1>Activa tu hermandad</h1>
        <p className="paywall__lead">
          {nombreHermandad ? `${nombreHermandad}, para` : 'Para'} usar el panel de gestión hace
          falta una suscripción activa. Elige tu plan y empieza ahora mismo.
        </p>

        <div className="paywall__planes">
          {PLANES.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`paywall__plan${plan === p.id ? ' paywall__plan--sel' : ''}`}
              onClick={() => setPlan(p.id)}
            >
              <span className="paywall__plan-nombre">{p.nombre}</span>
              <span className="paywall__plan-precio">
                {p.precio}<small>{p.periodo}</small>
              </span>
              <span className="paywall__plan-detalle">{p.detalle}</span>
            </button>
          ))}
        </div>

        <button type="button" className="btn btn-primary btn-block" onClick={() => onActivar(plan)}>
          Suscribirse — {PLANES.find((p) => p.id === plan)?.precio}
          {PLANES.find((p) => p.id === plan)?.periodo}
        </button>
        <p className="paywall__nota">
          Pago simulado mientras conectamos la pasarela: al pulsar, tu cuenta se activa. Podrás
          gestionar o cancelar la suscripción desde el panel.
        </p>
        <button type="button" className="btn btn-ghost btn-block" onClick={onSalir}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
