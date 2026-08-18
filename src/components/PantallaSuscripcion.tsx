import { useState } from 'react'
import { LogoMark } from './Logo'
import {
  PACKS,
  precioPack,
  etiquetaPeriodo,
  type PackId,
  type Periodo,
} from '../lib/suscripcion'

interface Props {
  nombreHermandad?: string
  onActivar: (pack: PackId, periodo: Periodo) => void
  onSalir: () => void
}

/**
 * Muro de suscripción: se muestra en lugar del panel cuando la hermandad no
 * tiene una suscripción activa. Se elige un pack (qué se desbloquea) y un
 * periodo (mensual/anual). Activarlo enciende la cuenta (sin cobro real por
 * ahora). No hay prueba gratuita.
 */
export default function PantallaSuscripcion({ nombreHermandad, onActivar, onSalir }: Props) {
  const [packSel, setPackSel] = useState<PackId>('completo')
  const [periodo, setPeriodo] = useState<Periodo>('mensual')

  const elegido = PACKS.find((p) => p.id === packSel)!

  return (
    <div className="paywall paywall--packs">
      <div className="paywall__card paywall__card--wide">
        <LogoMark size={44} />
        <p className="eyebrow">Suscripción</p>
        <h1>Activa tu hermandad</h1>
        <p className="paywall__lead">
          {nombreHermandad ? `${nombreHermandad}, elige` : 'Elige'} qué quieres poner en marcha: solo
          la gestión interna, solo la web pública, las dos, o todo con los extras premium.
        </p>

        <div className="paywall__periodo" role="tablist" aria-label="Periodo de facturación">
          <button
            type="button"
            role="tab"
            aria-selected={periodo === 'mensual'}
            className={`paywall__periodo-btn${periodo === 'mensual' ? ' is-active' : ''}`}
            onClick={() => setPeriodo('mensual')}
          >
            Mensual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={periodo === 'anual'}
            className={`paywall__periodo-btn${periodo === 'anual' ? ' is-active' : ''}`}
            onClick={() => setPeriodo('anual')}
          >
            Anual
          </button>
        </div>

        <div className="paywall__packs">
          {PACKS.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`pack-card${packSel === p.id ? ' pack-card--sel' : ''}${p.destacado ? ' pack-card--destacado' : ''}`}
              onClick={() => setPackSel(p.id)}
              aria-pressed={packSel === p.id}
            >
              {p.destacado && <span className="pack-card__badge">Recomendado</span>}
              <span className="pack-card__nombre">{p.nombre}</span>
              <span className="pack-card__precio">
                {precioPack(p, periodo)}
                <small>{etiquetaPeriodo(periodo)}</small>
              </span>
              <span className="pack-card__resumen">{p.resumen}</span>
              <ul className="pack-card__incluye">
                {p.incluye.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => onActivar(packSel, periodo)}
        >
          Suscribirse a {elegido.nombre} — {precioPack(elegido, periodo)}
          {etiquetaPeriodo(periodo)}
        </button>
        <p className="paywall__nota">
          Precios provisionales. Pago simulado mientras conectamos la pasarela: al pulsar, tu cuenta
          se activa. Podrás cambiar de pack o cancelar cuando quieras.
        </p>
        <button type="button" className="btn btn-ghost btn-block" onClick={onSalir}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
