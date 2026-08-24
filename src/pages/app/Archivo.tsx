import { llano } from '../../lib/buscar'
import { useMemo, useState, type FormEvent } from 'react'
import { useCargoDeLaSesion } from '../../lib/permisos'
import Drawer from '../../components/Drawer'
import {
  CARGOS,
  CATEGORIAS_DOCUMENTO,
  DOCUMENTOS_INICIALES,
  type Cargo,
  type CategoriaDocumento,
  type Documento,
  type EstadoExpediente,
  type TipoCabildo,
} from '../../data/documentos'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/format'
import { CLAVES_DATOS } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { documentoToRow, rowToDocumento } from '../../lib/db/documentos'
import { borrarArchivo, formatearTamano, guardarArchivo, leerArchivo } from '../../lib/filestore'
import { hayDatosDeEjemplo } from '../../lib/demo'
import { filaQueAbre } from '../../lib/foco'
import { hoyIso } from '../../lib/hoy'

function fmt(iso: string) {
  return formatDate(new Date(`${iso}T00:00:00`))
}

function etiquetaFecha(categoria: CategoriaDocumento) {
  if (categoria === 'Acta') return 'Fecha de celebración'
  if (categoria === 'Contrato') return 'Fecha de firma'
  if (categoria === 'Boletín') return 'Fecha de publicación'
  return 'Fecha'
}

/**
 * true si el documento es visible para ese cargo. null = documento
 * institucional, visible para cualquier hermano autenticado. Sin excepción
 * oculta para ningún cargo: si «Hermano Mayor» no figura en la lista de un
 * documento sensible, tampoco lo ve quien simule ese cargo.
 */
function canView(doc: Documento, cargo: Cargo) {
  return doc.cargosConAcceso === null || doc.cargosConAcceso.includes(cargo)
}

function diasHasta(iso: string) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const objetivo = new Date(`${iso}T00:00:00`)
  return Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000)
}

function vigenciaEstado(vigenciaHasta: string) {
  const dias = diasHasta(vigenciaHasta)
  if (dias < 0) return { texto: 'Vencido', clase: 'pill--err' }
  if (dias <= 60) return { texto: 'Vence pronto', clase: 'pill--warn' }
  return { texto: 'Vigente', clase: 'pill--ok' }
}

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
)
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
)
const ClipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l8.59-8.59a3.67 3.67 0 0 1 5.19 5.19l-8.6 8.59a1.83 1.83 0 0 1-2.6-2.6l7.94-7.94" /></svg>
)
const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13m0 0-4-4m4 4 4-4M4 21h16" /></svg>
)

export default function Archivo() {
  const { user } = useAuth()
  const nombreUsuario = (user?.user_metadata?.nombre as string | undefined) ?? ''

  const [documentos, setDocumentos] = useSupabaseTable<Documento>(
    'documentos',
    CLAVES_DATOS.documentos,
    DOCUMENTOS_INICIALES,
    documentoToRow,
    rowToDocumento,
  )
  const [query, setQuery] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<'Todos' | CategoriaDocumento>('Todos')
  /**
   * EL CARGO DE VERDAD, y solo ese.
   *
   * Aquí hubo un desplegable de «simulador de permisos» que lo tenía
   * cualquiera: al vocal al que se le habían restringido las actas del cabildo
   * le bastaba con cambiarlo a «Hermano Mayor» y leerlas. No era una
   * restricción, era una sugerencia. Se limitó al titular, y ahora se quita
   * del todo: para saber qué ve cada cargo está Personal y permisos, que es
   * donde se decide, y no en medio del archivo estorbando a quien viene a
   * buscar un acta.
   */
  const cargoReal = useCargoDeLaSesion()
  const viewAsCargo: Cargo = (cargoReal ?? 'Vocal') as Cargo
  const [selected, setSelected] = useState<Documento | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const [categoriaNueva, setCategoriaNueva] = useState<CategoriaDocumento>('Acta')
  const [visibilidadNueva, setVisibilidadNueva] = useState<'Todos' | 'Restringido'>('Todos')
  const [guardandoArchivo, setGuardandoArchivo] = useState(false)
  const [urlArchivo, setUrlArchivo] = useState<string | null>(null)
  const [cargandoArchivo, setCargandoArchivo] = useState(false)

  const filtered = useMemo(() => {
    return documentos
      .filter((d) => (filtroCategoria === 'Todos' ? true : d.categoria === filtroCategoria))
      .filter((d) => {
        const q = llano(query)
        if (!q) return true
        return (
          String(d.numero).includes(q) ||
          llano(d.nombre).includes(q) ||
          llano(d.descripcion).includes(q) ||
          llano(d.proveedor ?? '').includes(q) ||
          llano(d.archivadoPor ?? '').includes(q)
        )
      })
      .sort((a, b) => b.fechaAlta.localeCompare(a.fechaAlta))
  }, [documentos, query, filtroCategoria])

  const stats = useMemo(() => {
    const total = documentos.length
    const restringidos = documentos.filter((d) => d.cargosConAcceso !== null).length
    const ahora = new Date()
    const contratosPorVencer = documentos.filter((d) => {
      if (d.categoria !== 'Contrato' || !d.vigenciaHasta) return false
      return diasHasta(d.vigenciaHasta) <= 60
    }).length
    const incorporadosEsteMes = documentos.filter((d) => {
      const f = new Date(`${d.fechaAlta}T00:00:00`)
      return f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth()
    }).length
    return { total, restringidos, contratosPorVencer, incorporadosEsteMes }
  }, [documentos])

  // Solo los documentos que el cargo simulado puede ver: los que no, no aparecen
  // (se ocultan por completo, en vez de mostrarse como «Restringido»).
  const visibles = useMemo(() => filtered.filter((d) => canView(d, viewAsCargo)), [filtered, viewAsCargo])
  const ocultosPorCargo = filtered.length - visibles.length

  function abrirNuevo() {
    setCategoriaNueva('Acta')
    setVisibilidadNueva('Todos')
    setFormOpen(true)
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nombre = String(data.get('nombre') ?? '').trim()
    const categoria = String(data.get('categoria') ?? '') as CategoriaDocumento
    const fecha = String(data.get('fecha') ?? '')
    const descripcion = String(data.get('descripcion') ?? '').trim()
    const archivadoPor = String(data.get('archivadoPor') ?? '').trim() || null
    const visibilidad = String(data.get('visibilidad') ?? 'Todos')
    const cargosConAcceso = visibilidad === 'Restringido' ? (data.getAll('cargos').map((v) => String(v)) as Cargo[]) : null
    if (!nombre || !categoria || !fecha) return
    if (visibilidad === 'Restringido' && (!cargosConAcceso || cargosConAcceso.length === 0)) return

    const tipoCabildo = categoria === 'Acta' ? (String(data.get('tipoCabildo') ?? 'General') as TipoCabildo) : null
    const proveedor = categoria === 'Contrato' ? String(data.get('proveedor') ?? '').trim() || null : null
    const vigenciaHasta = categoria === 'Contrato' ? String(data.get('vigenciaHasta') ?? '') || null : null
    const estadoExpediente = categoria === 'Expediente' ? (String(data.get('estadoExpediente') ?? 'Abierto') as EstadoExpediente) : null

    const archivo = data.get('archivo')
    const tieneArchivo = archivo instanceof File && archivo.size > 0

    const nextNumero = Math.max(0, ...documentos.map((d) => d.numero)) + 1
    const nuevo: Documento = {
      id: nuevoId(),
      numero: nextNumero,
      nombre,
      categoria,
      fecha,
      fechaAlta: hoyIso(),
      descripcion,
      archivadoPor,
      cargosConAcceso,
      tipoCabildo,
      proveedor,
      vigenciaHasta,
      estadoExpediente,
      archivoNombre: tieneArchivo ? (archivo as File).name : null,
      archivoTipo: tieneArchivo ? (archivo as File).type || null : null,
      archivoTamano: tieneArchivo ? (archivo as File).size : null,
    }

    if (tieneArchivo) {
      setGuardandoArchivo(true)
      try {
        await guardarArchivo(nuevo.id, archivo as File)
      } catch {
        // Si falla el guardado del archivo (p. ej. IndexedDB no disponible),
        // el documento se guarda igualmente, solo que sin adjunto.
        nuevo.archivoNombre = null
        nuevo.archivoTipo = null
        nuevo.archivoTamano = null
      } finally {
        setGuardandoArchivo(false)
      }
    }

    setDocumentos((prev) => [nuevo, ...prev])
    setJustAddedId(nuevo.id)
    setFormOpen(false)
    setFiltroCategoria('Todos')
    setQuery('')
    form.reset()
    setTimeout(() => setJustAddedId(null), 3000)
  }

  function abrirFicha(doc: Documento) {
    if (urlArchivo) URL.revokeObjectURL(urlArchivo)
    setUrlArchivo(null)
    setSelected(doc)
  }

  function cerrarFicha() {
    setSelected(null)
    if (urlArchivo) URL.revokeObjectURL(urlArchivo)
    setUrlArchivo(null)
  }

  async function abrirArchivoAdjunto(doc: Documento) {
    setCargandoArchivo(true)
    try {
      const blob = await leerArchivo(doc.id)
      if (!blob) return
      const url = URL.createObjectURL(blob)
      setUrlArchivo((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      window.open(url, '_blank', 'noopener')
    } finally {
      setCargandoArchivo(false)
    }
  }

  /**
   * Este es el único borrado de la aplicación que NO se puede deshacer, y por
   * eso es el único que pregunta de verdad: `borrarArchivo` se lleva los bytes
   * del fichero, no una fila de una lista. Devolverlo pediría tenerlo guardado
   * en algún sitio, y ese sitio es justamente el que se acaba de vaciar.
   *
   * Antes se iba con un clic y sin preguntar nada. Un acta escaneada que solo
   * existía ahí no vuelve.
   */
  async function eliminarArchivoAdjunto(doc: Documento) {
    const como = doc.archivoNombre ? `«${doc.archivoNombre}»` : 'este archivo'
    if (!window.confirm(`Se va a borrar ${como} y esto no se puede deshacer. ¿Seguro?`)) return
    await borrarArchivo(doc.id)
    setDocumentos((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, archivoNombre: null, archivoTipo: null, archivoTamano: null } : d)),
    )
    setSelected((prev) => (prev && prev.id === doc.id ? { ...prev, archivoNombre: null, archivoTipo: null, archivoTamano: null } : prev))
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Archivo documental</p>
          <h1>Actas, reglas y expedientes</h1>
          <p className="dash-head__lead">
            {stats.total} documentos{hayDatosDeEjemplo() ? ' · datos de ejemplo mientras conectamos la base de datos' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo documento
        </button>
      </div>

      {/* Solo se dice algo si de verdad falta algo. Un aviso que siempre pone
          «ves todo» es ruido en todas las visitas para no decir nada. */}
      {ocultosPorCargo > 0 && (
        <div className="banner-inline banner-inline--accent">
          {ocultosPorCargo === 1
            ? 'Hay 1 documento que no te aparece: lo ve solo quien tiene acceso.'
            : `Hay ${ocultosPorCargo} documentos que no te aparecen: los ve solo quien tiene acceso.`}
        </div>
      )}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Total documentos</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Archivo completo</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Restringidos</span>
          <span className="stat-tile__value">{stats.restringidos}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.restringidos > 0 ? 'warn' : 'ok'}`}>
            {stats.restringidos > 0 ? 'Contienen datos sensibles' : 'Ninguno'}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Contratos por vencer</span>
          <span className="stat-tile__value">{stats.contratosPorVencer}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.contratosPorVencer > 0 ? 'warn' : 'ok'}`}>
            {stats.contratosPorVencer > 0 ? 'Revisar renovación' : 'Todo en vigor'}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Incorporados este mes</span>
          <span className="stat-tile__value">{stats.incorporadosEsteMes}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Este mes</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por nombre, descripción o proveedor"
          aria-label="Buscar documentos por nombre, descripción o proveedor"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {(['Todos', ...CATEGORIAS_DOCUMENTO] as const).map((f) => (
            <button
              key={f}
              className={`chip${filtroCategoria === f ? ' chip--active' : ''}`}
              onClick={() => setFiltroCategoria(f)}
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
              <th>Documento</th>
              <th className="col-opcional">Fecha</th>
              <th>Acceso</th>
              <th className="col-opcional">Archivado por</th>
              <th className="col-opcional"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((d) => (
                <tr
                  key={d.id}
                  className={d.id === justAddedId ? 'row--flash' : undefined}
                  {...filaQueAbre(() => abrirFicha(d))}
                >
                  <td className="num col-opcional">{d.numero}</td>
                  <td>
                    <span className="row-person__name">{d.nombre}</span>
                    {d.archivoNombre && (
                      <span className="archivo-adjunto__marca" title={`Adjunto: ${d.archivoNombre}`}>
                        <ClipIcon />
                      </span>
                    )}
                    <br />
                    <span className="table-subtle">{d.categoria}</span>
                    {/* En el móvil se ocultan la fecha y quién lo archivó. */}
                    <span className="row-person__sub solo-movil">
                      {fmt(d.fecha)}{d.archivadoPor ? ` · ${d.archivadoPor}` : ''}
                    </span>
                  </td>
                  <td className="num td-nowrap col-opcional">{fmt(d.fecha)}</td>
                  <td>
                    {d.cargosConAcceso ? (
                      <span className="pill pill--restricted">
                        <LockIcon /> Restringido
                      </span>
                    ) : (
                      <span className="pill pill--info">Todos</span>
                    )}
                  </td>
                  <td className="col-opcional">{d.archivadoPor ?? <span className="table-muted">—</span>}</td>
                  <td className="col-opcional">
                    <button
                      className="icon-btn"
                      title="Ver ficha"
                      onClick={(e) => {
                        e.stopPropagation()
                        abrirFicha(d)
                      }}
                    >
                      <EyeIcon />
                    </button>
                  </td>
                </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  {filtered.length > 0 && viewAsCargo
                    ? `Ningún documento visible para ${viewAsCargo}.`
                    : 'No hay documentos que coincidan con la búsqueda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ficha del documento */}
      <Drawer
        open={!!selected && canView(selected, viewAsCargo)}
        onClose={cerrarFicha}
        title={selected?.nombre ?? ''}
        subtitle={selected ? `Documento nº ${selected.numero}` : undefined}
      >
        {selected &&
          (() => {
            const visible = canView(selected, viewAsCargo)
            return (
              <div className="ficha">
                <div className="ficha__row">
                  <span className="pill pill--info">{selected.categoria}</span>
                  {selected.cargosConAcceso && (
                    <span className="pill pill--restricted">
                      <LockIcon /> Restringido
                    </span>
                  )}
                </div>

                {!visible && (
                  <div className="banner-inline banner-inline--warn">
                    Documento restringido. Visible solo para: {selected.cargosConAcceso!.join(', ')}. Estás viendo
                    el archivo como: {viewAsCargo}.
                  </div>
                )}

                {visible && (
                  <dl className="ficha__list">
                    <div>
                      <dt>{etiquetaFecha(selected.categoria)}</dt>
                      <dd>{fmt(selected.fecha)}</dd>
                    </div>
                    <div>
                      <dt>Incorporado el</dt>
                      <dd>{fmt(selected.fechaAlta)}</dd>
                    </div>
                    {selected.descripcion && (
                      <div>
                        <dt>Descripción</dt>
                        <dd>{selected.descripcion}</dd>
                      </div>
                    )}
                    {selected.archivadoPor && (
                      <div>
                        <dt>Archivado por</dt>
                        <dd>{selected.archivadoPor}</dd>
                      </div>
                    )}
                    {selected.categoria === 'Acta' && selected.tipoCabildo && (
                      <div>
                        <dt>Tipo de cabildo</dt>
                        <dd>{selected.tipoCabildo}</dd>
                      </div>
                    )}
                    {selected.categoria === 'Contrato' && selected.proveedor && (
                      <div>
                        <dt>Proveedor</dt>
                        <dd>{selected.proveedor}</dd>
                      </div>
                    )}
                    {selected.categoria === 'Contrato' && selected.vigenciaHasta && (
                      <div>
                        <dt>Vigencia hasta</dt>
                        <dd>
                          {fmt(selected.vigenciaHasta)}{' '}
                          <span className={`pill ${vigenciaEstado(selected.vigenciaHasta).clase}`}>
                            {vigenciaEstado(selected.vigenciaHasta).texto}
                          </span>
                        </dd>
                      </div>
                    )}
                    {selected.categoria === 'Expediente' && selected.estadoExpediente && (
                      <div>
                        <dt>Estado</dt>
                        <dd>
                          <span className={`pill ${selected.estadoExpediente === 'Abierto' ? 'pill--ok' : 'pill--off'}`}>
                            {selected.estadoExpediente}
                          </span>
                        </dd>
                      </div>
                    )}
                  </dl>
                )}

                {visible && (
                  <div className="assign-box">
                    <label>Archivo adjunto</label>
                    {selected.archivoNombre ? (
                      <>
                        <div className="archivo-adjunto__fila">
                          <ClipIcon />
                          <span>
                            {selected.archivoNombre}
                            {selected.archivoTamano != null && (
                              <span className="table-subtle"> · {formatearTamano(selected.archivoTamano)}</span>
                            )}
                          </span>
                        </div>
                        <div className="assign-box__row">
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => abrirArchivoAdjunto(selected)}
                            disabled={cargandoArchivo}
                          >
                            <DownloadIcon /> {cargandoArchivo ? 'Abriendo…' : 'Ver / descargar'}
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => eliminarArchivoAdjunto(selected)}>
                            Quitar adjunto
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="form-hint">Este documento no tiene ningún archivo adjunto todavía.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
      </Drawer>

      {/* Nuevo documento */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo documento"
        subtitle="Archivo documental"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)} disabled={guardandoArchivo}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="documento-form" type="submit" disabled={guardandoArchivo}>
              {guardandoArchivo ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="documento-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="nombre">Nombre del documento</label>
            <input id="nombre" name="nombre" type="text" placeholder="Ej. Acta de Cabildo General de Cuentas" required />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="categoria">Categoría</label>
              <select
                id="categoria"
                name="categoria"
                value={categoriaNueva}
                onChange={(e) => setCategoriaNueva(e.target.value as CategoriaDocumento)}
              >
                {CATEGORIAS_DOCUMENTO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="fecha">Fecha del documento</label>
              <input id="fecha" name="fecha" type="date" required />
            </div>
          </div>

          {categoriaNueva === 'Acta' && (
            <div className="form-row">
              <label htmlFor="tipoCabildo">Tipo de cabildo</label>
              <select id="tipoCabildo" name="tipoCabildo" defaultValue="General">
                <option value="General">General</option>
                <option value="Extraordinario">Extraordinario</option>
                <option value="De Oficiales">De Oficiales</option>
              </select>
            </div>
          )}

          {categoriaNueva === 'Contrato' && (
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="proveedor">Proveedor</label>
                <input id="proveedor" name="proveedor" type="text" placeholder="Ej. Cerería La Giralda" />
              </div>
              <div className="form-row">
                <label htmlFor="vigenciaHasta">Vigencia hasta</label>
                <input id="vigenciaHasta" name="vigenciaHasta" type="date" />
              </div>
            </div>
          )}

          {categoriaNueva === 'Expediente' && (
            <div className="form-row">
              <label htmlFor="estadoExpediente">Estado</label>
              <select id="estadoExpediente" name="estadoExpediente" defaultValue="Abierto">
                <option value="Abierto">Abierto</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>
          )}

          <div className="form-row">
            <label htmlFor="descripcion">Descripción</label>
            <textarea id="descripcion" name="descripcion" rows={3} placeholder="Resumen, acuerdos o procedencia del documento" />
          </div>
          <div className="form-row">
            <label htmlFor="archivadoPor">Archivado por</label>
            <input id="archivadoPor" name="archivadoPor" type="text" defaultValue={nombreUsuario} />
          </div>
          <div className="form-row">
            <label htmlFor="archivo">Archivo (PDF, imagen…)</label>
            <input id="archivo" name="archivo" type="file" accept=".pdf,image/*" />
            {/* El aviso decía SIEMPRE «se guarda en este navegador», y con la
                base de datos conectada eso es falso desde hace tiempo: el
                adjunto sube al almacén de la hermandad (ver `lib/filestore.ts`)
                y lo ve toda la junta. Decirle a la secretaria que el escaneo se
                queda en su portátil es justo lo que hace que no lo suba. */}
            <p className="form-hint">
              {hayDatosDeEjemplo()
                ? 'Opcional. Sin base de datos conectada se guarda solo en este navegador.'
                : 'Opcional. Se guarda en el archivo de la hermandad, no en este ordenador.'}
            </p>
          </div>

          <div className="assign-box">
            <label id="visibilidadLabel">Quién puede verlo</label>
            <div role="radiogroup" aria-labelledby="visibilidadLabel" className="archivo-visibilidad-group">
              <label className="checkbox-row" htmlFor="visibilidadTodos">
                <input
                  id="visibilidadTodos"
                  type="radio"
                  name="visibilidad"
                  value="Todos"
                  checked={visibilidadNueva === 'Todos'}
                  onChange={() => setVisibilidadNueva('Todos')}
                />
                Todos los hermanos
              </label>
              <label className="checkbox-row" htmlFor="visibilidadRestringido">
                <input
                  id="visibilidadRestringido"
                  type="radio"
                  name="visibilidad"
                  value="Restringido"
                  checked={visibilidadNueva === 'Restringido'}
                  onChange={() => setVisibilidadNueva('Restringido')}
                />
                Restringido a cargos concretos
              </label>
            </div>
            {visibilidadNueva === 'Restringido' && (
              <>
                <div className="archivo-cargos">
                  {CARGOS.map((c) => (
                    <label key={c} className="checkbox-row">
                      <input type="checkbox" name="cargos" value={c} />
                      {c}
                    </label>
                  ))}
                </div>
                <p className="form-hint">Marca al menos un cargo, o el documento no se podrá guardar.</p>
              </>
            )}
          </div>
        </form>
      </Drawer>
    </div>
  )
}
