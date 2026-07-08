import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { HERMANOS_INICIALES } from '../../data/hermanos'
import { CUOTAS_INICIALES } from '../../data/cuotas'
import { PAPELETAS_INICIALES } from '../../data/papeletas'
import { MOVIMIENTOS_INICIALES } from '../../data/movimientos'
import { DOCUMENTOS_INICIALES } from '../../data/documentos'
import { CLAVES_DATOS, leerPersistido } from '../../lib/persistencia'
import { getCampana, renovacionDeHermano, ventanaAbierta } from '../../lib/campana'
import { formatCurrency } from '../../lib/format'

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

const AGENDA = [
  { day: '14 MAR', title: 'Cabildo General de Salida', time: '21:00' },
  { day: '15 MAR', title: 'Función Principal de Instituto', time: '12:00' },
  { day: '17 MAR', title: 'Traslado al Paso de Misterio', time: '19:30' },
]

function toneClass(tone: 'ok' | 'warn' | 'neutral') {
  return tone === 'ok' ? 'dot--ok' : tone === 'warn' ? 'dot--warn' : 'dot--neutral'
}

function diasHasta(iso: string) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - hoy.getTime()) / 86_400_000)
}

export default function DashboardHome() {
  const { user } = useAuth()
  const nombre = (user?.user_metadata?.nombre as string | undefined)?.split(' ')[0]

  // Todo lo que muestra el Inicio se calcula en vivo de los mismos datos que
  // gestionan los módulos (guardados en este navegador), no de cifras fijas.
  const { stats, actividad, alertas } = useMemo(() => {
    const hermanos = leerPersistido(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
    const cuotas = leerPersistido(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)
    const papeletas = leerPersistido(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES)
    const movimientos = leerPersistido(CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES)
    const documentos = leerPersistido(CLAVES_DATOS.documentos, DOCUMENTOS_INICIALES)
    const campana = getCampana()
    const papeletasCampana = papeletas.filter((p) => p.anio === campana.anio)

    const activos = hermanos.filter((h) => h.estado === 'Activo').length
    const nuevos = hermanos.filter((h) => h.estado === 'Nuevo').length
    const cuotasPendientes = cuotas.filter((c) => c.estado === 'Pendiente').length
    const pctPendientes = cuotas.length ? Math.round((cuotasPendientes / cuotas.length) * 100) : 0
    const papeletasEmitidas = papeletasCampana.filter((p) => p.estado !== 'Anulada' && p.estado !== 'Renuncia').length
    const porRenovar = hermanos.filter((h) => renovacionDeHermano(h.id, papeletas, campana).estado === 'Por renovar').length
    const saldo = movimientos
      .filter((m) => m.estado === 'Conciliado')
      .reduce((s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe), 0)
    const porConciliar = movimientos.filter((m) => m.estado === 'Pendiente').length

    const stats = [
      { label: 'Hermanos activos', value: String(activos), trend: nuevos > 0 ? `+${nuevos} nuevos` : 'Censo al día', tone: 'ok' as const },
      { label: 'Cuotas pendientes', value: String(cuotasPendientes), trend: `${pctPendientes}% del total`, tone: cuotasPendientes > 0 ? ('warn' as const) : ('ok' as const) },
      { label: `Papeletas ${campana.anio}`, value: String(papeletasEmitidas), trend: ventanaAbierta(campana) ? 'Renovación abierta' : 'Renovación cerrada', tone: 'neutral' as const },
      { label: 'Saldo conciliado', value: formatCurrency(saldo), trend: porConciliar > 0 ? `${porConciliar} por conciliar` : 'Todo conciliado', tone: saldo >= 0 ? ('ok' as const) : ('warn' as const) },
    ]

    // Actividad: los últimos registros reales de cada colección.
    const actividad = [
      ...cuotas
        .filter((c) => c.estado === 'Pagada' && c.fechaPago)
        .slice(0, 2)
        .map((c) => ({
          who: hermanos.find((h) => h.id === c.hermanoId)?.nombre ?? 'Un hermano',
          what: `pagó su ${c.concepto.toLowerCase()} (${formatCurrency(c.importe)})`,
          when: c.fechaPago ?? '',
          tone: 'ok' as const,
        })),
      ...papeletasCampana
        .filter((p) => p.estado !== 'Renuncia')
        .slice(0, 2)
        .map((p) => ({
          who: hermanos.find((h) => h.id === p.hermanoId)?.nombre ?? 'Un hermano',
          what: `tiene la papeleta nº ${String(p.numero).padStart(4, '0')} (${p.estado.toLowerCase()})`,
          when: p.fechaSolicitud,
          tone: 'neutral' as const,
        })),
      ...movimientos.slice(0, 1).map((m) => ({
        who: 'Tesorería',
        what: `registró ${m.tipo === 'Gasto' ? 'un gasto' : 'un ingreso'}: ${m.concepto} (${formatCurrency(m.importe)})`,
        when: m.fecha,
        tone: 'neutral' as const,
      })),
    ].slice(0, 5)

    // Alertas: derivadas de datos reales, con enlace al módulo que las resuelve.
    const contratosPorVencer = documentos.filter(
      (d) => d.categoria === 'Contrato' && d.vigenciaHasta && diasHasta(d.vigenciaHasta) <= 60,
    ).length
    const alertas: { text: string; level: 'warn' | 'ok'; to: string }[] = []
    if (cuotasPendientes > 0)
      alertas.push({ text: `${cuotasPendientes} cuotas siguen pendientes de cobro`, level: 'warn', to: '/app/cuotas' })
    if (porRenovar > 0 && ventanaAbierta(campana))
      alertas.push({ text: `${porRenovar} hermanos por renovar su sitio antes de la fecha límite`, level: 'warn', to: '/app/papeletas' })
    if (contratosPorVencer > 0)
      alertas.push({ text: `${contratosPorVencer} contratos vencidos o a punto de vencer`, level: 'warn', to: '/app/archivo' })
    if (porConciliar > 0)
      alertas.push({ text: `${porConciliar} movimientos de tesorería por conciliar`, level: 'warn', to: '/app/tesoreria' })
    if (alertas.length === 0) alertas.push({ text: 'Todo en orden: sin tareas pendientes', level: 'ok', to: '/app' })

    return { stats, actividad, alertas }
  }, [])

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Inicio</p>
          <h1>{nombre ? `Hola, ${nombre}` : 'Bienvenido a tu hermandad'}</h1>
          <p className="dash-head__lead">
            Esto es lo más relevante hoy, calculado en vivo con los datos guardados en este
            navegador.
          </p>
        </div>
      </div>

      <section className="stat-grid">
        {stats.map((s) => (
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
            {actividad.map((a, i) => (
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
              {alertas.map((a, i) => (
                <li key={i} className={`alert-item alert-item--${a.level}`}>
                  <Link to={a.to} className="alert-item__link">
                    {a.text}
                  </Link>
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
