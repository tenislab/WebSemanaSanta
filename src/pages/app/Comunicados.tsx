import { useMemo, useState, type FormEvent } from 'react'
import Drawer from '../../components/Drawer'
import AvisoFalta from '../../components/AvisoFalta'
import { requisito } from '../../lib/requisitos'
import EditorSegmento from '../../components/EditorSegmento'
import { CLAVES_CATALOGOS, getLista } from '../../lib/catalogos'
import {
  CANALES,
  COMUNICADOS_INICIALES,
  REDES_SOCIALES,
  SEGMENTOS,
  type Canal,
  type Comunicado,
  type EstadoComunicado,
  type RedSocial,
} from '../../data/comunicados'
import { formatDate } from '../../lib/format'
import { CLAVES_DATOS, leerPersistido, leerDatos } from '../../lib/persistencia'
import { PAPELETAS_INICIALES } from '../../data/papeletas'
import { getCampana } from '../../lib/campana'
import { getTramos } from '../../lib/tramos'
import { getOpcionesPapeleta } from '../../lib/opcionesPapeleta'
import { etiquetasDe, etiquetasQueSonAutomaticas, indiceRoles } from '../../lib/rolesPapeleta'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { comunicadoToRow, rowToComunicado, useCuentasSociales } from '../../lib/db/comunicados'
import { useEtiquetas } from '../../lib/etiquetas'
import {
  CRITERIOS_POR_DEFECTO,
  filtrarSegmento,
  etiquetaSegmento,
  type CriteriosSegmento,
} from '../../lib/segmentacion'
import { HERMANOS_INICIALES, type Hermano } from '../../data/hermanos'
import { agregarAvisoAVarios, getPreferenciasAvisos, quiereAviso } from '../../lib/avisosHermano'
import { correoDisponible, enviarCorreo, getAjustesCorreo } from '../../lib/correo'
import { cuerpoCorreo } from '../../lib/avisosCorreo'
import { hayDatosDeEjemplo } from '../../lib/demo'

/** Prefijo con el que se guarda un destinatario que es una etiqueta de hermano. */
const PREFIJO_ETIQUETA = 'Etiqueta: '

function fmt(iso: string | null) {
  if (!iso) return '—'
  return formatDate(new Date(`${iso}T00:00:00`))
}

function claseEstado(estado: EstadoComunicado) {
  if (estado === 'Enviado') return 'pill--ok'
  if (estado === 'Programado') return 'pill--warn'
  return 'pill--off'
}

const COLOR_RED: Record<RedSocial, string> = {
  Facebook: '#3b5998',
  Instagram: '#c1387c',
  X: '#14171a',
  YouTube: '#c4302b',
  TikTok: '#25b0a4',
}

const INICIAL_RED: Record<RedSocial, string> = {
  Facebook: 'f',
  Instagram: 'IG',
  X: 'X',
  YouTube: '▶',
  TikTok: '♪',
}

export default function Comunicados() {
  const [comunicados, setComunicados] = useSupabaseTable<Comunicado>(
    'comunicados',
    CLAVES_DATOS.comunicados,
    COMUNICADOS_INICIALES,
    comunicadoToRow,
    rowToComunicado,
  )
  const [cuentas, setCuentas] = useCuentasSociales()
  const canales = useMemo(() => getLista(CLAVES_CATALOGOS.canalesComunicado, CANALES), [])
  const segmentos = useMemo(() => getLista(CLAVES_CATALOGOS.segmentosComunicado, SEGMENTOS), [])
  const [etiquetas] = useEtiquetas()
  const hermanos = useMemo(() => leerPersistido<Hermano[]>(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])

  /** Si el destinatario es una etiqueta, devuelve los hermanos que la tienen (con su email). */
  function hermanosDeDestinatario(destinatarios: string): Hermano[] {
    if (!destinatarios.startsWith(PREFIJO_ETIQUETA)) return []
    const etiqueta = destinatarios.slice(PREFIJO_ETIQUETA.length)
    // Cuentan igual las puestas a mano y las que salen de la papeleta: si no,
    // mandar «a los costaleros» no llegaría a los costaleros de este año.
    return hermanos.filter(
      (h) => h.estado !== 'Baja' && etiquetasDe(h, rolesPorHermano.get(h.id) ?? []).includes(etiqueta),
    )
  }
  /**
   * A quién le llega de verdad al buzón. Por etiqueta, los que la tengan; y
   * «Todos los hermanos», al censo activo entero. Un segmento que no sepamos
   * resolver no avisa a nadie, en vez de avisar a todos por si acaso.
   */
  function hermanosAAvisar(destinatarios: string): Hermano[] {
    const porEtiqueta = hermanosDeDestinatario(destinatarios)
    if (porEtiqueta.length > 0) return porEtiqueta
    if (/todos/i.test(destinatarios)) return hermanos.filter((h) => h.estado !== 'Baja')
    return []
  }

  const [query, setQuery] = useState('')
  const [filtroCanal, setFiltroCanal] = useState<'Todos' | Canal>('Todos')
  const [selected, setSelected] = useState<Comunicado | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const [canalesNuevos, setCanalesNuevos] = useState<Canal[]>(() => [canales[0] ?? 'Email'])
  const toggleCanal = (c: Canal) =>
    setCanalesNuevos((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoComunicado>('Borrador')
  const [segmentarAvanzado, setSegmentarAvanzado] = useState(false)
  const [criterios, setCriterios] = useState<CriteriosSegmento>(CRITERIOS_POR_DEFECTO)
  /**
   * Los roles que salen de la papeleta (costalero, acólito, mantilla). Sin
   esto, «mandar solo a los costaleros de este año» —que es el caso para el que
   se inventaron— no encontraría a nadie.
   */
  const rolesPorHermano = useMemo(() => {
    const anio = getCampana().anio
    const papeletas = leerDatos(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES)
    return indiceRoles(papeletas, getTramos(), getOpcionesPapeleta(), anio)
  }, [])
  const rolesDisponibles = useMemo(
    () => etiquetasQueSonAutomaticas(getTramos(), getOpcionesPapeleta()),
    [],
  )
  /** Todo por lo que se puede mandar: el catálogo de la hermandad y los roles de la papeleta. */
  const etiquetasParaEnviar = useMemo(
    () => [...new Set([...etiquetas, ...rolesDisponibles])].sort((a, b) => a.localeCompare(b, 'es')),
    [etiquetas, rolesDisponibles],
  )
  const segmentoHermanos = useMemo(
    () => filtrarSegmento(hermanos, criterios, rolesPorHermano),
    [hermanos, criterios, rolesPorHermano],
  )

  const [conectando, setConectando] = useState<RedSocial | null>(null)
  const [usuarioInput, setUsuarioInput] = useState('')

  const cuentasConectadas = useMemo(() => cuentas.filter((c) => c.conectada), [cuentas])

  const filtered = useMemo(() => {
    return comunicados
      .filter((c) => (filtroCanal === 'Todos' ? true : c.canal === filtroCanal))
      .filter((c) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return (
          String(c.numero).includes(q) ||
          c.titulo.toLowerCase().includes(q) ||
          c.cuerpo.toLowerCase().includes(q) ||
          c.destinatarios.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
  }, [comunicados, query, filtroCanal])

  const stats = useMemo(() => {
    const total = comunicados.length
    const programados = comunicados.filter((c) => c.estado === 'Programado').length
    const ahora = new Date()
    const enviadosEsteMes = comunicados.filter((c) => {
      if (c.estado !== 'Enviado' || !c.fechaEnvio) return false
      const f = new Date(`${c.fechaEnvio}T00:00:00`)
      return f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth()
    }).length
    return { total, programados, enviadosEsteMes, redesConectadas: cuentasConectadas.length }
  }, [comunicados, cuentasConectadas])

  function abrirNuevo() {
    setCanalesNuevos([canales[0] ?? 'Email'])
    setSegmentarAvanzado(false)
    setEstadoNuevo('Borrador')
    setFormOpen(true)
  }

  function conectar(red: RedSocial) {
    const usuario = usuarioInput.trim() || '@hermandaddemo'
    setCuentas((prev) => prev.map((c) => (c.red === red ? { ...c, conectada: true, usuario } : c)))
    setConectando(null)
    setUsuarioInput('')
  }

  function desconectar(red: RedSocial) {
    setCuentas((prev) => prev.map((c) => (c.red === red ? { ...c, conectada: false, usuario: null } : c)))
  }

  async function enviarAhora(c: Comunicado) {
    const hoy = new Date().toISOString().slice(0, 10)
    const destinatariosHermanos = hermanosDeDestinatario(c.destinatarios)
    const alcance = destinatariosHermanos.length > 0 ? destinatariosHermanos.length : c.alcance
    const actualizado: Comunicado = { ...c, estado: 'Enviado', fechaEnvio: hoy, alcance }
    setComunicados((prev) => prev.map((x) => (x.id === c.id ? actualizado : x)))
    setSelected(actualizado)

    // Al buzón de cada hermano en su área, SIEMPRE. Es lo que no depende de que
    // haya proveedor de correo contratado.
    const reciben = hermanosAAvisar(c.destinatarios)
    agregarAvisoAVarios(reciben.map((h) => h.id), c.cuerpo, 'comunicado', c.titulo)

    // Y por correo, si la hermandad lo tiene conectado y encendido para los
    // comunicados. Se respeta lo que cada hermano haya apagado en su área: que
    // la hermandad active el correo no le quita a nadie su decisión.
    const ajustes = getAjustesCorreo()
    if (!correoDisponible(ajustes) || !ajustes.avisaDe.comunicados) return
    const direcciones = reciben
      .filter((h) => quiereAviso(getPreferenciasAvisos(h.id), 'comunicado'))
      .map((h) => h.email)
      .filter((e) => e && e.includes('@'))
    if (direcciones.length === 0) return
    setEnvioCorreo({ estado: 'enviando' })
    // El mismo membrete que los demás avisos: la banda con el color y el
    // nombre de la hermandad. Antes esta pantalla se montaba su propio HTML a
    // mano, así que el comunicado —que es el correo que MÁS se manda— era el
    // único que llegaba sin identificar de quién era.
    const { texto, html } = cuerpoCorreo(c.titulo, c.cuerpo.split('\n\n'))
    const r = await enviarCorreo({ para: direcciones, asunto: c.titulo, texto, html })
    setEnvioCorreo(
      r.ok
        ? { estado: 'hecho', texto: `Enviado por correo a ${r.enviados} hermanos.` }
        : { estado: 'error', texto: r.error ?? 'No se pudo mandar el correo.' },
    )
  }

  /** El estado del último envío por correo, para no dejarlo en silencio. */
  const [envioCorreo, setEnvioCorreo] = useState<{ estado: 'enviando' | 'hecho' | 'error'; texto?: string } | null>(null)

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const titulo = String(data.get('titulo') ?? '').trim()
    const cuerpo = String(data.get('cuerpo') ?? '').trim()
    const canalesSel = canalesNuevos.length > 0 ? canalesNuevos : [canales[0] ?? 'Email']
    const destinatarios = segmentarAvanzado
      ? etiquetaSegmento(criterios)
      : String(data.get('destinatarios') ?? segmentos[0])
    const estado = String(data.get('estado') ?? 'Borrador') as EstadoComunicado
    if (!titulo || !cuerpo || canalesSel.length === 0) return

    const redes = canalesSel.includes('Redes sociales')
      ? (data.getAll('redes').map((v) => String(v)) as RedSocial[])
      : null
    if (canalesSel.includes('Redes sociales') && (!redes || redes.length === 0)) return

    const fechaProgramada = estado === 'Programado' ? String(data.get('fechaProgramada') ?? '') || null : null
    if (estado === 'Programado' && !fechaProgramada) return

    const hoy = new Date().toISOString().slice(0, 10)
    const nextNumero = Math.max(0, ...comunicados.map((c) => c.numero)) + 1
    const alcanceEtiqueta = segmentarAvanzado ? segmentoHermanos.length : hermanosDeDestinatario(destinatarios).length
    const alcance = estado === 'Enviado' && alcanceEtiqueta > 0 ? alcanceEtiqueta : null
    // Un comunicado por cada canal elegido (así cada uno aparece en su canal).
    const nuevos: Comunicado[] = canalesSel.map((canal, idx) => ({
      id: nuevoId(),
      numero: nextNumero + idx,
      titulo,
      cuerpo,
      canal,
      redes: canal === 'Redes sociales' ? redes : null,
      destinatarios,
      estado,
      fechaCreacion: hoy,
      fechaProgramada,
      fechaEnvio: estado === 'Enviado' ? hoy : null,
      autor: 'Tú',
      alcance,
    }))
    setComunicados((prev) => [...nuevos, ...prev])
    if (estado === 'Enviado') {
      agregarAvisoAVarios(hermanosAAvisar(destinatarios).map((h) => h.id), cuerpo, 'comunicado', titulo)
    }
    setJustAddedId(nuevos[0].id)
    setFormOpen(false)
    setFiltroCanal('Todos')
    setQuery('')
    form.reset()
    setTimeout(() => setJustAddedId(null), 3000)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Comunicados</p>
          <h1>Avisos y difusión</h1>
          <p className="dash-head__lead">
            {stats.total} comunicados{hayDatosDeEjemplo() ? ' · datos de ejemplo mientras conectamos la base de datos' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo comunicado
        </button>
      </div>

      {/* Desplegable: la gestión de cuentas es configuración, no el día a día — colapsada
          por defecto para que los avisos (el contenido principal) queden arriba. */}
      <details className="redes-card">
        <summary className="redes-card__head">
          <h2>
            Redes sociales conectadas
            <span className="pill pill--info">{cuentas.filter((c) => c.conectada).length} de {cuentas.length}</span>
          </h2>
          <p className="table-subtle">
            Conexión simulada — la publicación real llegará cuando enlacemos las cuentas oficiales de la hermandad.
          </p>
        </summary>
        <div className="redes-grid">
          {cuentas.map((c) => (
            <div className="red-card" key={c.red}>
              <div className="red-card__top">
                <span className="red-card__badge" style={{ background: COLOR_RED[c.red] }}>
                  {INICIAL_RED[c.red]}
                </span>
                <div className="red-card__name">
                  <b>{c.red}</b>
                  {c.conectada && <span className="table-subtle">{c.usuario}</span>}
                </div>
              </div>
              <div className="red-card__foot">
                <span className={`pill ${c.conectada ? 'pill--ok' : 'pill--off'}`}>
                  {c.conectada ? 'Conectada' : 'No conectada'}
                </span>
                {conectando === c.red ? (
                  <div className="red-card__connect-row">
                    <input
                      type="text"
                      placeholder="@usuario"
                      value={usuarioInput}
                      onChange={(e) => setUsuarioInput(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => conectar(c.red)}>
                      Guardar
                    </button>
                  </div>
                ) : c.conectada ? (
                  <>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setConectando(c.red)
                        setUsuarioInput(c.usuario ?? '')
                      }}
                    >
                      Cambiar usuario
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => desconectar(c.red)}>
                      Desconectar
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => conectar(c.red)}>
                    Conectar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </details>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Total comunicados</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Todos los canales</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Programados</span>
          <span className="stat-tile__value">{stats.programados}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Pendientes de enviar</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Enviados este mes</span>
          <span className="stat-tile__value">{stats.enviadosEsteMes}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Difusión activa</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Redes conectadas</span>
          <span className="stat-tile__value">{stats.redesConectadas}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">de {cuentas.length}</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por título, texto o destinatarios"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {['Todos', ...canales].map((f) => (
            <button
              key={f}
              className={`chip${filtroCanal === f ? ' chip--active' : ''}`}
              onClick={() => setFiltroCanal(f)}
              type="button"
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th className="col-opcional">Nº</th>
              <th>Comunicado</th>
              <th className="col-opcional">Destinatarios</th>
              <th>Estado</th>
              <th className="col-opcional">Fecha</th>
              <th className="col-opcional"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className={c.id === justAddedId ? 'row--flash' : undefined}
                onClick={() => setSelected(c)}
                style={{ cursor: 'pointer' }}
              >
                <td className="num col-opcional">{c.numero}</td>
                <td>
                  <span className="row-person__name">{c.titulo}</span>
                  <br />
                  <span className="table-subtle">
                    {c.canal}
                    {c.redes && c.redes.length > 0 ? ` · ${c.redes.join(', ')}` : ''}
                  </span>
                  {/* En el móvil se ocultan destinatarios y fecha. */}
                  <span className="row-person__sub solo-movil">
                    {c.destinatarios} · {fmt(c.fechaEnvio ?? c.fechaProgramada ?? c.fechaCreacion)}
                  </span>
                </td>
                <td className="col-opcional">{c.destinatarios}</td>
                <td>
                  <span className={`pill ${claseEstado(c.estado)}`}>{c.estado}</span>
                </td>
                <td className="num col-opcional">{fmt(c.fechaEnvio ?? c.fechaProgramada ?? c.fechaCreacion)}</td>
                <td className="col-opcional">
                  <button className="icon-btn" title="Ver comunicado" onClick={(e) => { e.stopPropagation(); setSelected(c) }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No hay comunicados que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ficha del comunicado */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.titulo ?? ''}
        subtitle={selected ? `Comunicado nº ${selected.numero}` : undefined}
      >
        {selected && (
          <div className="ficha">
            <div className="ficha__row">
              <span className="pill pill--info">{selected.canal}</span>
              <span className={`pill ${claseEstado(selected.estado)}`}>{selected.estado}</span>
            </div>
            <dl className="ficha__list">
              <div>
                <dt>Mensaje</dt>
                <dd>{selected.cuerpo}</dd>
              </div>
              <div>
                <dt>Destinatarios</dt>
                <dd>{selected.destinatarios}</dd>
              </div>
              {(() => {
                const receptores = hermanosDeDestinatario(selected.destinatarios)
                if (receptores.length === 0) return null
                return (
                  <div>
                    <dt>Aviso por email (simulado)</dt>
                    <dd>
                      Se {selected.estado === 'Enviado' ? 'ha enviado' : 'enviaría'} a{' '}
                      <b>{receptores.length}</b> hermano{receptores.length === 1 ? '' : 's'} con esta
                      etiqueta:
                      <div className="etiquetas-chips" style={{ marginTop: '0.4rem' }}>
                        {receptores.slice(0, 12).map((h) => (
                          <span key={h.id} className="etiqueta-pill">
                            {h.nombre} · {h.email}
                          </span>
                        ))}
                        {receptores.length > 12 && (
                          <span className="etiqueta-pill">+{receptores.length - 12} más</span>
                        )}
                      </div>
                      <AvisoFalta compacto requisito={requisito('correo')} />
                    </dd>
                  </div>
                )
              })()}
              {selected.redes && selected.redes.length > 0 && (
                <div>
                  <dt>Redes sociales</dt>
                  <dd>{selected.redes.join(', ')}</dd>
                </div>
              )}
              <div>
                <dt>Creado</dt>
                <dd>{fmt(selected.fechaCreacion)} · {selected.autor}</dd>
              </div>
              {selected.fechaProgramada && (
                <div>
                  <dt>Programado para</dt>
                  <dd>{fmt(selected.fechaProgramada)}</dd>
                </div>
              )}
              {selected.fechaEnvio && (
                <div>
                  <dt>Enviado</dt>
                  <dd>{fmt(selected.fechaEnvio)}</dd>
                </div>
              )}
              {selected.alcance !== null && (
                <div>
                  <dt>Alcance</dt>
                  <dd>{selected.alcance.toLocaleString('es-ES')} personas</dd>
                </div>
              )}
            </dl>
            {selected.estado !== 'Enviado' && (
              <div className="assign-box__row">
                <button
                  type="button" className="btn btn-primary"
                  disabled={envioCorreo?.estado === 'enviando'}
                  onClick={() => enviarAhora(selected)}
                >
                  {envioCorreo?.estado === 'enviando' ? 'Enviando…' : 'Enviar ahora'}
                </button>
              </div>
            )}
            {/* Qué ha pasado con el correo. El buzón del hermano se llena
                siempre; el correo puede fallar, y callarlo sería peor. */}
            {envioCorreo?.estado === 'hecho' && (
              <p className="form-hint form-hint--ok">✓ {envioCorreo.texto}</p>
            )}
            {envioCorreo?.estado === 'error' && (
              <div className="aviso-falta" role="note">
                <p className="aviso-falta__titulo">
                  <span className="aviso-falta__marca" aria-hidden="true" />
                  El comunicado se ha publicado, pero no ha salido por correo
                </p>
                <p className="aviso-falta__porque">{envioCorreo.texto}</p>
                <p className="aviso-falta__arreglo">
                  A los hermanos les ha llegado igualmente al buzón de su área. Revisa
                  Configuración → Correo.
                </p>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Nuevo comunicado */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo comunicado"
        subtitle="Comunicados"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="comunicado-form" type="submit">
              Guardar
            </button>
          </>
        }
      >
        <form id="comunicado-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="titulo">Título</label>
            <input id="titulo" name="titulo" type="text" placeholder="Ej. Convocatoria de Gobergo" required />
          </div>
          <div className="form-row">
            <label htmlFor="cuerpo">Mensaje</label>
            <textarea id="cuerpo" name="cuerpo" rows={4} placeholder="Texto del comunicado" required />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label>Canales (puedes elegir varios)</label>
              <div className="chips">
                {canales.map((c) => {
                  const activo = canalesNuevos.includes(c)
                  return (
                    <button
                      type="button"
                      key={c}
                      className={`chip chip--toggle${activo ? ' chip--active' : ''}`}
                      onClick={() => toggleCanal(c)}
                    >
                      {activo ? '✓ ' : ''}{c}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="destinatarios">Destinatarios</label>
              <select id="destinatarios" name="destinatarios" defaultValue={segmentos[0]} disabled={segmentarAvanzado}>
                {segmentos.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                {etiquetasParaEnviar.length > 0 && (
                  <optgroup label="Por etiqueta (solo esos hermanos)">
                    {etiquetasParaEnviar.map((et) => (
                      <option key={et} value={`${PREFIJO_ETIQUETA}${et}`}>
                        {et}{rolesDisponibles.includes(et) && !etiquetas.includes(et) ? ' (por papeleta)' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={segmentarAvanzado}
              onChange={(e) => setSegmentarAvanzado(e.target.checked)}
            />
            <span>Segmentación avanzada (elegir a quién por criterios)</span>
          </label>
          {segmentarAvanzado && (
            <EditorSegmento
              etiquetasExtra={rolesDisponibles}
              criterios={criterios}
              onChange={setCriterios}
              cuantos={segmentoHermanos.length}
              onLimpiar={() => setCriterios(CRITERIOS_POR_DEFECTO)}
            />
          )}

          {canalesNuevos.includes('Redes sociales') && (
            <div className="form-row">
              <label>Publicar en</label>
              {cuentasConectadas.length === 0 ? (
                <p className="form-hint">
                  Ninguna red conectada todavía. Conecta al menos una cuenta arriba para poder publicar aquí.
                </p>
              ) : (
                <div className="archivo-cargos">
                  {REDES_SOCIALES.filter((r) => cuentasConectadas.some((c) => c.red === r)).map((r) => (
                    <label key={r} className="checkbox-row">
                      <input type="checkbox" name="redes" value={r} />
                      {r}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-row">
            <label htmlFor="estado">Estado</label>
            <select id="estado" name="estado" value={estadoNuevo} onChange={(e) => setEstadoNuevo(e.target.value as EstadoComunicado)}>
              <option value="Borrador">Guardar como borrador</option>
              <option value="Programado">Programar envío</option>
              <option value="Enviado">Enviar ahora</option>
            </select>
          </div>

          {estadoNuevo === 'Programado' && (
            <div className="form-row">
              <label htmlFor="fechaProgramada">Fecha de envío</label>
              <input id="fechaProgramada" name="fechaProgramada" type="date" required />
            </div>
          )}
        </form>
      </Drawer>
    </div>
  )
}
