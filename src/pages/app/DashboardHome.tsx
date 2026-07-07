import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const STATS = [
  { label: 'Hermanos activos', value: '1.204', trend: '+18 este mes', tone: 'ok' as const },
  { label: 'Cuotas pendientes', value: '47', trend: '6% del total', tone: 'warn' as const },
  { label: 'Papeletas emitidas', value: '812', trend: 'Campaña abierta', tone: 'neutral' as const },
  { label: 'Saldo en tesorería', value: '18.420 €', trend: '+2.180 € este mes', tone: 'ok' as const },
]

const QUICK_ACTIONS = [
  { to: '/app/hermanos', label: 'Nuevo hermano', icon: 'user' as const },
  { to: '/app/cuotas', label: 'Registrar pago', icon: 'coin' as const },
  { to: '/app/papeletas', label: 'Crear papeleta', icon: 'ticket' as const },
  { to: '/app/comunicados', label: 'Enviar comunicado', icon: 'mail' as const },
]

const ICONS: Record<string, JSX.Element> = {
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.4" /><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" /></svg>
  ),
  coin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M9.3 9.7c0-1.2 1.2-2.2 2.7-2.2s2.7.9 2.7 1.9c0 2.6-5.4 1.2-5.4 3.8 0 1 1.2 1.9 2.7 1.9s2.7-1 2.7-2.2" /></svg>
  ),
  ticket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" /><path d="M10 6v12" strokeDasharray="2 2" /></svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h16v11H8l-4 4z" /><path d="M8 9h8M8 12h5" /></svg>
  ),
}

const ACTIVITY = [
  { who: 'Ana Sánchez del Río', what: 'pagó su cuota anual', when: 'hace 12 min', tone: 'ok' as const },
  { who: 'Secretaría', what: 'emitió la papeleta nº 0416 a Carmen Pérez', when: 'hace 1 h', tone: 'neutral' as const },
  { who: 'Francisco Gómez Nieto', what: 'solicitó cambio de tramo en el cortejo', when: 'hace 3 h', tone: 'warn' as const },
  { who: 'Juan Luis Cabrera', what: 'se dio de alta como nuevo hermano', when: 'ayer', tone: 'ok' as const },
  { who: 'Tesorería', what: 'registró un gasto de flores: 640 €', when: 'ayer', tone: 'neutral' as const },
]

const ALERTS = [
  { text: '47 cuotas siguen pendientes de cobro este trimestre', level: 'warn' as const },
  { text: '12 papeletas por asignar antes del Cabildo General', level: 'warn' as const },
  { text: 'Copia de seguridad realizada correctamente', level: 'ok' as const },
]

const AGENDA = [
  { day: '14 MAR', title: 'Cabildo General de Salida', time: '21:00' },
  { day: '15 MAR', title: 'Función Principal de Instituto', time: '12:00' },
  { day: '17 MAR', title: 'Traslado al Paso de Misterio', time: '19:30' },
]

function toneClass(tone: 'ok' | 'warn' | 'neutral') {
  return tone === 'ok' ? 'dot--ok' : tone === 'warn' ? 'dot--warn' : 'dot--neutral'
}

export default function DashboardHome() {
  const { user } = useAuth()
  const nombre = (user?.user_metadata?.nombre as string | undefined)?.split(' ')[0]

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Inicio</p>
          <h1>{nombre ? `Hola, ${nombre}` : 'Bienvenido a tu hermandad'}</h1>
          <p className="dash-head__lead">
            Esto es lo más relevante hoy. Los datos que ves son de ejemplo mientras conectamos la
            base de datos.
          </p>
        </div>
      </div>

      <section className="stat-grid">
        {STATS.map((s) => (
          <div className="stat-tile" key={s.label}>
            <span className="stat-tile__label">{s.label}</span>
            <span className="stat-tile__value">{s.value}</span>
            <span className={`stat-tile__trend stat-tile__trend--${s.tone}`}>{s.trend}</span>
          </div>
        ))}
      </section>

      <section className="quick-actions">
        {QUICK_ACTIONS.map((a) => (
          <Link className="quick-action" to={a.to} key={a.label}>
            <span className="quick-action__ic">{ICONS[a.icon]}</span>
            {a.label}
          </Link>
        ))}
      </section>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel__head">
            <h2>Actividad reciente</h2>
          </div>
          <ul className="activity-list">
            {ACTIVITY.map((a, i) => (
              <li key={i}>
                <span className={`dot ${toneClass(a.tone)}`} />
                <span className="activity-text">
                  <b>{a.who}</b> {a.what}
                </span>
                <span className="activity-when">{a.when}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="dash-side">
          <section className="panel">
            <div className="panel__head">
              <h2>Alertas y tareas</h2>
            </div>
            <ul className="alert-list">
              {ALERTS.map((a, i) => (
                <li key={i} className={`alert-item alert-item--${a.level}`}>
                  {a.text}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Próximos cultos</h2>
              <Link to="/app/cortejo" className="panel__link">
                Ver agenda
              </Link>
            </div>
            <ul className="agenda-mini">
              {AGENDA.map((e) => (
                <li key={e.title}>
                  <span className="agenda-mini__day">{e.day}</span>
                  <span className="agenda-mini__title">{e.title}</span>
                  <span className="agenda-mini__time">{e.time}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
