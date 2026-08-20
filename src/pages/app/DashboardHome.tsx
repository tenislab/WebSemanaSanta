import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { HERMANOS_INICIALES, type Hermano } from '../../data/hermanos'
import { CUOTAS_INICIALES, esAvisado, type Cuota } from '../../data/cuotas'
import { getMensajesWeb, sinLeer } from '../../lib/mensajesWeb'
import { contextoActual, requisitosPendientes } from '../../lib/requisitos'
import { getSolicitudes } from '../../lib/solicitudes'
import { PAPELETAS_INICIALES, type Papeleta } from '../../data/papeletas'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../../data/movimientos'
import { DOCUMENTOS_INICIALES, type Documento } from '../../data/documentos'
import { EVENTOS_INICIALES, type Evento } from '../../data/eventos'
import { CLAVES_DATOS } from '../../lib/persistencia'
import { useSupabaseTable } from '../../lib/supabaseSync'
import { hermanoToRow, rowToHermano } from '../../lib/db/hermanos'
import { cuotaToRow, rowToCuota } from '../../lib/db/cuotas'
import { papeletaToRow, rowToPapeleta } from '../../lib/db/papeletas'
import { movimientoToRow, rowToMovimiento } from '../../lib/db/movimientos'
import { documentoToRow, rowToDocumento } from '../../lib/db/documentos'
import { eventoToRow, rowToEvento } from '../../lib/db/eventos'
import { cargoDeCuenta } from '../../lib/permisos'
import { getPersonal } from '../../lib/personal'
import { getCampana, renovacionDeHermano, ventanaAbierta } from '../../lib/campana'
import { formatCurrency } from '../../lib/format'
import { puedeVerModulo } from '../../lib/permisos'
import { useSuscripcion, moduloPermitidoPorPack } from '../../lib/suscripcion'

const QUICK_ACTIONS = [
  { to: '/app/hermanos', label: 'Nuevo hermano', icon: 'user' as const, modulo: 'hermanos' },
  { to: '/app/cuotas', label: 'Registrar pago', icon: 'coin' as const, modulo: 'cuotas' },
  { to: '/app/papeletas', label: 'Crear papeleta', icon: 'ticket' as const, modulo: 'papeletas' },
  { to: '/app/comunicados', label: 'Enviar comunicado', icon: 'mail' as const, modulo: 'comunicados' },
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

/** «23 AGO» a partir de una fecha ISO, para la agenda del inicio. */
function diaCorto(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d
    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    .replace('.', '')
    .toUpperCase()
}

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
  // Contra la lista real de personal, no contra el metadata (que el usuario
  // puede reescribir). Ver lib/permisos.ts.
  const cargo = cargoDeCuenta(user?.user_metadata?.personalId as string | undefined, getPersonal())
  const { suscripcion } = useSuscripcion()

  // El Inicio lee de la BASE DE DATOS, igual que el resto de pantallas.
  //
  // Antes leía solo del navegador, y cuando no encontraba nada usaba los datos
  // de ejemplo que vienen con la aplicación. Con eso, una hermandad recién
  // creada abría el panel y se encontraba «4 cuotas pendientes» y «un hermano
  // pagó su cuota anual» teniendo cero hermanos. Números inventados en la
  // primera pantalla que ve un cliente, y encima contradiciéndose entre sí.
  const [hermanos] = useSupabaseTable<Hermano>('hermanos', CLAVES_DATOS.hermanos, HERMANOS_INICIALES, hermanoToRow, rowToHermano, 'numero')
  const [cuotas] = useSupabaseTable<Cuota>('cuotas', CLAVES_DATOS.cuotas, CUOTAS_INICIALES, cuotaToRow, rowToCuota)
  const [papeletas] = useSupabaseTable<Papeleta>('papeletas', CLAVES_DATOS.papeletas, PAPELETAS_INICIALES, papeletaToRow, rowToPapeleta)
  const [movimientos] = useSupabaseTable<Movimiento>('movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES, movimientoToRow, rowToMovimiento)
  const [documentos] = useSupabaseTable<Documento>('documentos', CLAVES_DATOS.documentos, DOCUMENTOS_INICIALES, documentoToRow, rowToDocumento)
  const [eventos] = useSupabaseTable<Evento>('eventos', CLAVES_DATOS.eventos, EVENTOS_INICIALES, eventoToRow, rowToEvento)

  const { stats, actividad, alertas } = useMemo(() => {
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
      { label: 'Hermanos activos', value: String(activos), trend: nuevos > 0 ? `+${nuevos} nuevos` : 'Censo al día', tone: 'ok' as const, modulo: 'hermanos' },
      { label: 'Cuotas pendientes', value: String(cuotasPendientes), trend: `${pctPendientes}% del total`, tone: cuotasPendientes > 0 ? ('warn' as const) : ('ok' as const), modulo: 'cuotas' },
      { label: `Papeletas ${campana.anio}`, value: String(papeletasEmitidas), trend: ventanaAbierta(campana) ? 'Renovación abierta' : 'Renovación cerrada', tone: 'neutral' as const, modulo: 'papeletas' },
      { label: 'Saldo conciliado', value: formatCurrency(saldo), trend: porConciliar > 0 ? `${porConciliar} por conciliar` : 'Todo conciliado', tone: saldo >= 0 ? ('ok' as const) : ('warn' as const), modulo: 'tesoreria' },
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
          modulo: 'cuotas',
        })),
      ...papeletasCampana
        .filter((p) => p.estado !== 'Renuncia')
        .slice(0, 2)
        .map((p) => ({
          who: hermanos.find((h) => h.id === p.hermanoId)?.nombre ?? 'Un hermano',
          what: `tiene la papeleta nº ${String(p.numero).padStart(4, '0')} (${p.estado.toLowerCase()})`,
          when: p.fechaSolicitud,
          tone: 'neutral' as const,
          modulo: 'papeletas',
        })),
      ...movimientos.slice(0, 1).map((m) => ({
        who: 'Tesorería',
        what: `registró ${m.tipo === 'Gasto' ? 'un gasto' : 'un ingreso'}: ${m.concepto} (${formatCurrency(m.importe)})`,
        when: m.fecha,
        tone: 'neutral' as const,
        modulo: 'tesoreria',
      })),
    ].slice(0, 5)

    // Alertas: derivadas de datos reales, con enlace al módulo que las resuelve.
    const contratosPorVencer = documentos.filter(
      (d) => d.categoria === 'Contrato' && d.vigenciaHasta && diasHasta(d.vigenciaHasta) <= 60,
    ).length
    const alertas: { text: string; level: 'warn' | 'ok'; to: string; modulo: string }[] = []
    // Lo que llega por la web: si nadie mira el buzón, la web recoge mensajes
    // que no lee nadie y es peor que no tener formulario.
    const nuevosWeb = sinLeer(getMensajesWeb())
    if (nuevosWeb > 0)
      alertas.push({
        text: `${nuevosWeb} ${nuevosWeb === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} desde la web`,
        level: 'warn',
        to: '/app/web',
        modulo: 'web',
      })
    // Primero lo que se resuelve en un clic: hermanos que ya han pagado por su
    // cuenta y solo esperan a que tesorería lo dé por bueno.
    const avisanPago = cuotas.filter(esAvisado).length
    if (avisanPago > 0)
      alertas.push({
        text: `${avisanPago} ${avisanPago === 1 ? 'hermano avisa' : 'hermanos avisan'} de que ya ${avisanPago === 1 ? 'ha' : 'han'} pagado: confírmalo`,
        level: 'warn',
        to: '/app/cuotas',
        modulo: 'cuotas',
      })
    // Todo lo que una PERSONA pide y espera va antes que cualquier número.
    // Las solicitudes de alta solo se veían en un botón dentro de Hermanos:
    // quien no entrase ahí no se enteraba de que había gente esperando.
    const altasPedidas = getSolicitudes().filter((s) => s.estado === 'Pendiente').length
    if (altasPedidas > 0)
      alertas.push({
        text: `${altasPedidas} ${altasPedidas === 1 ? 'persona quiere hacerse hermano' : 'personas quieren hacerse hermanas'}`,
        level: 'warn',
        to: '/app/hermanos',
        modulo: 'hermanos',
      })
    // Una baja pedida es una PERSONA esperando respuesta: va antes que
    // cualquier número.
    const bajasPedidas = hermanos.filter((h) => h.bajaSolicitada && h.estado !== 'Baja').length
    if (bajasPedidas > 0)
      alertas.push({
        text: `${bajasPedidas} ${bajasPedidas === 1 ? 'hermano ha pedido la baja' : 'hermanos han pedido la baja'}`,
        level: 'warn',
        to: '/app/hermanos',
        modulo: 'hermanos',
      })
    if (cuotasPendientes > 0)
      alertas.push({ text: `${cuotasPendientes} cuotas siguen pendientes de cobro`, level: 'warn', to: '/app/cuotas', modulo: 'cuotas' })
    if (porRenovar > 0 && ventanaAbierta(campana))
      alertas.push({ text: `${porRenovar} hermanos por renovar su sitio antes de la fecha límite`, level: 'warn', to: '/app/papeletas', modulo: 'papeletas' })
    if (contratosPorVencer > 0)
      alertas.push({ text: `${contratosPorVencer} contratos vencidos o a punto de vencer`, level: 'warn', to: '/app/archivo', modulo: 'archivo' })
    if (porConciliar > 0)
      alertas.push({ text: `${porConciliar} movimientos de tesorería por conciliar`, level: 'warn', to: '/app/tesoreria', modulo: 'tesoreria' })
    // Lo que falta por conectar va AL FINAL: no es una tarea del día a día, es
    // algo que se hace una vez. Arriba estorbaría todos los días a quien ya
    // sabe que le falta y está esperando a contratarlo.
    const porConectar = requisitosPendientes(contextoActual()).length
    if (porConectar > 0)
      alertas.push({
        text: `${porConectar} ${porConectar === 1 ? 'cosa' : 'cosas'} por conectar para que Cabildo funcione del todo`,
        level: 'warn',
        to: '/app/configuracion',
        modulo: 'configuracion',
      })

    return { stats, actividad, alertas }
    // Con las dependencias puestas: los datos llegan de la red DESPUÉS del
    // primer pintado, así que sin esto el Inicio se calcularía una sola vez con
    // las listas vacías y se quedaría en ceros para siempre.
  }, [hermanos, cuotas, papeletas, movimientos, documentos])

  // Se ve un módulo en el Inicio si lo permite el cargo Y lo incluye el pack
  // contratado (si no, una suscripción de solo web vería datos de gestión).
  const visible = (modulo: string) => puedeVerModulo(cargo, modulo) && moduloPermitidoPorPack(suscripcion, modulo)

  const statsVisibles = stats.filter((s) => visible(s.modulo))
  const accionesVisibles = QUICK_ACTIONS.filter((a) => visible(a.modulo))
  const actividadVisible = actividad.filter((a) => visible(a.modulo))
  const alertasVisibles = alertas.filter((a) => visible(a.modulo))
  const cultosVisibles = visible('eventos')

  // Próximos eventos reales del módulo de Eventos (los 3 más cercanos desde hoy).
  const agendaProxima = useMemo(() => {
    // En hora LOCAL: con toISOString, de madrugada en España «hoy» era ayer y la
    // agenda enseñaba eventos ya pasados.
    const ahora = new Date()
    const hoyIso = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
    return [...eventos]
      .filter((e) => e.fecha >= hoyIso)
      .sort((a, b) => (a.fecha === b.fecha ? (a.hora ?? '').localeCompare(b.hora ?? '') : a.fecha.localeCompare(b.fecha)))
      .slice(0, 3)
  }, [eventos])

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Inicio</p>
          <h1>{nombre ? `Hola, ${nombre}` : 'Bienvenido a tu hermandad'}</h1>
          <p className="dash-head__lead">
            Esto es lo más relevante hoy, calculado en vivo con los datos de tu hermandad.
          </p>
        </div>
      </div>

      {statsVisibles.length > 0 && (
        <section className="stat-grid">
          {statsVisibles.map((s) => (
            <div className="stat-tile" key={s.label}>
              <span className="stat-tile__label">{s.label}</span>
              <span className="stat-tile__value">{s.value}</span>
              <span className={`stat-tile__trend stat-tile__trend--${s.tone}`}>{s.trend}</span>
            </div>
          ))}
        </section>
      )}

      {accionesVisibles.length > 0 && (
        <section className="quick-actions">
          {accionesVisibles.map((a) => (
            <Link className="quick-action" to={a.to} key={a.label}>
              <span className="quick-action__ic">{ICONS[a.icon]}</span>
              {a.label}
            </Link>
          ))}
        </section>
      )}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel__head">
            <h2>Actividad reciente</h2>
          </div>
          <ul className="activity-list">
            {actividadVisible.map((a, i) => (
              <li key={i}>
                <span className={`dot ${toneClass(a.tone)}`} />
                <span className="activity-text">
                  <b>{a.who}</b> {a.what}
                </span>
                <span className="activity-when">{a.when}</span>
              </li>
            ))}
            {actividadVisible.length === 0 && <li className="table-empty">Sin actividad reciente en tus módulos.</li>}
          </ul>
        </section>

        <div className="dash-side">
          <section className="panel">
            <div className="panel__head">
              <h2>Alertas y tareas</h2>
            </div>
            <ul className="alert-list">
              {alertasVisibles.map((a, i) => (
                <li key={i} className={`alert-item alert-item--${a.level}`}>
                  <Link to={a.to} className="alert-item__link">
                    {a.text}
                  </Link>
                </li>
              ))}
              {alertasVisibles.length === 0 && (
                <li className="alert-item alert-item--ok">Todo en orden: sin tareas pendientes</li>
              )}
            </ul>
          </section>

          {cultosVisibles && (
            <section className="panel">
              <div className="panel__head">
                <h2>Próximos eventos</h2>
                <Link to="/app/eventos" className="panel__link">
                  Ver agenda
                </Link>
              </div>
              <ul className="agenda-mini">
                {agendaProxima.map((e) => (
                  <li key={e.id}>
                    <span className="agenda-mini__day">{diaCorto(e.fecha)}</span>
                    <span className="agenda-mini__title">{e.titulo}</span>
                    <span className="agenda-mini__time">{e.hora ?? ''}</span>
                  </li>
                ))}
                {agendaProxima.length === 0 && (
                  <li>
                    <span className="agenda-mini__title">
                      Sin eventos en agenda. <Link to="/app/eventos" className="panel__link">Crea el primero</Link>.
                    </span>
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
