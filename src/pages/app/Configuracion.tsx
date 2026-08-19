import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { LogoMark } from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import {
  useHermandadSettings,
  saveHermandadSettings,
  type HermandadSettings,
} from '../../lib/hermandadSettings'
import {
  getTramos,
  useTramos,
  saveTramos,
  aforoDeCuerpo,
  getCuerpos,
  saveCuerpos,
  getPrecioBase,
  savePrecioBase,
  repartoDe,
  gruposAutomaticos,
  precioDeTramo,
  cuerposPresentes as cuerposPresentesDe,
  type Cuerpo,
  type ModoReparto,
  type Tramo,
} from '../../lib/tramos'
import { TIPOS_CAMPO, useCamposPropios, type CampoPropio } from '../../lib/camposPropios'
import { useOpcionesPapeleta, saveOpcionesPapeleta, type OpcionPapeleta } from '../../lib/opcionesPapeleta'
import { useConceptosCuota, saveConceptosCuota, type ConceptoCuotaConfig } from '../../lib/conceptosCuota'
import { CLAVES_CATALOGOS, useCatalogos, saveLista } from '../../lib/catalogos'
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO, CUENTAS_POR_DEFECTO } from '../../data/movimientos'
import { TIPOS_INCIDENCIA_POR_DEFECTO } from '../../data/incidencias'
import { CATEGORIAS_ENSER } from '../../data/enseres'
import { CANALES, SEGMENTOS } from '../../data/comunicados'
import { restablecerDatosDeEjemplo } from '../../lib/persistencia'
import { nuevoId } from '../../lib/supabaseSync'
import { crearCopia, esCopiaValida, restaurarCopia } from '../../lib/backup'
import { descargarArchivo } from '../../lib/csv'

const MAX_LOGO_BYTES = 800_000

/** Fila del editor de cuerpos: guarda el nombre original para poder renombrar los tramos al guardar. */
interface CuerpoEdit {
  original: string | null
  actual: string
}

/** Catálogos de listas simples que cada hermandad personaliza (clave de almacenamiento + valores por defecto). */
const CATALOGOS_DEF = [
  { k: 'ingresos', clave: CLAVES_CATALOGOS.categoriasIngreso, titulo: 'Categorías de ingresos', porDefecto: CATEGORIAS_INGRESO },
  { k: 'gastos', clave: CLAVES_CATALOGOS.categoriasGasto, titulo: 'Categorías de gastos', porDefecto: CATEGORIAS_GASTO },
  { k: 'cuentas', clave: CLAVES_CATALOGOS.cuentasTesoreria, titulo: 'Cuentas de tesorería', porDefecto: CUENTAS_POR_DEFECTO },
  { k: 'incidencias', clave: CLAVES_CATALOGOS.tiposIncidencia, titulo: 'Tipos de incidencia (día de salida)', porDefecto: TIPOS_INCIDENCIA_POR_DEFECTO },
  { k: 'enseres', clave: CLAVES_CATALOGOS.categoriasEnser, titulo: 'Categorías del inventario', porDefecto: CATEGORIAS_ENSER },
  { k: 'canales', clave: CLAVES_CATALOGOS.canalesComunicado, titulo: 'Canales de comunicación', porDefecto: CANALES },
  { k: 'segmentos', clave: CLAVES_CATALOGOS.segmentosComunicado, titulo: 'Destinatarios de comunicados', porDefecto: SEGMENTOS },
] as const

type SeccionCfg = 'hermandad' | 'cortejo' | 'papeletas' | 'catalogos' | 'ficha' | 'datos'

/** Las secciones de los ajustes, agrupadas como el editor de la web. */
const SECCIONES_CFG: { titulo: string; items: { id: SeccionCfg; label: string; icono: ReactNode }[] }[] = [
  {
    titulo: 'La hermandad',
    items: [
      { id: 'hermandad', label: 'Identidad y datos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3 4 7v6c0 4.4 3.4 7.4 8 8 4.6-.6 8-3.6 8-8V7l-8-4Z" /></svg> },
      { id: 'ficha', label: 'Ficha del hermano', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.2" /><path d="M5.5 16.5c.7-1.7 2-2.5 3.5-2.5s2.8.8 3.5 2.5M15 9.5h4M15 13h3" /></svg> },
    ],
  },
  {
    titulo: 'Cómo trabajáis',
    items: [
      { id: 'cortejo', label: 'Cuerpos y tramos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6h16M4 12h16M4 18h10" /></svg> },
      { id: 'papeletas', label: 'Papeletas', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M2.5 11a2 2 0 0 0 0 2M21.5 11a2 2 0 0 1 0 2M9 6v12" strokeDasharray="2 2" /></svg> },
      { id: 'catalogos', label: 'Catálogos y cuotas', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg> },
    ],
  },
  {
    titulo: 'Mantenimiento',
    items: [
      { id: 'datos', label: 'Copias y datos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg> },
    ],
  },
]

export default function Configuracion() {
  /** Sección abierta. Se recuerda durante la sesión: se entra y se sale mucho. */
  const [seccion, setSeccion] = useState<SeccionCfg>(
    () => (sessionStorage.getItem('cabildo-cfg-seccion') as SeccionCfg | null) ?? 'hermandad',
  )
  function irASeccion(s: SeccionCfg) {
    setSeccion(s)
    try { sessionStorage.setItem('cabildo-cfg-seccion', s) } catch { /* sin sessionStorage */ }
  }
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''

  const settingsRemotas = useHermandadSettings(fallbackNombre)
  const [settings, setSettings] = useState<HermandadSettings>(settingsRemotas)
  const [tocado, setTocado] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Mientras no se haya tocado el formulario, refleja lo que traiga Supabase
  // en cuanto llegue (la primera lectura, al montar, es solo la caché local).
  useEffect(() => {
    if (!tocado) setSettings(settingsRemotas)
  }, [settingsRemotas, tocado])

  function update<K extends keyof HermandadSettings>(key: K, value: HermandadSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
    setSaved(false)
    setTocado(true)
  }

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Elige una imagen más ligera (máx. 800 KB).')
      return
    }
    setLogoError(null)
    const reader = new FileReader()
    reader.onload = () => update('logoDataUrl', String(reader.result))
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // «Guardado correctamente» solo si de verdad se ha guardado.
    const r = await saveHermandadSettings(settings)
    setErrorGuardar(r.ok ? null : (r.error ?? 'No se pudo guardar.'))
    setSaved(r.ok)
    if (r.ok) setTimeout(() => setSaved(false), 3000)
  }

  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const tramosRemotos = useTramos()
  const [tramos, setTramos] = useState<Tramo[]>(tramosRemotos)
  const [tramosTocado, setTramosTocado] = useState(false)
  useEffect(() => {
    if (!tramosTocado) setTramos(tramosRemotos)
  }, [tramosRemotos, tramosTocado])
  const [tramosSaved, setTramosSaved] = useState(false)
  const [precioBase, setPrecioBase] = useState<number>(() => getPrecioBase())
  const [copiaEstado, setCopiaEstado] = useState<string | null>(null)
  const backupRef = useRef<HTMLInputElement>(null)

  // ---- Cuerpos del cortejo (los pasos y su acompañamiento; nombres libres) ----
  const [cuerposGuardados, setCuerposGuardados] = useState<Cuerpo[]>(() => getCuerpos())
  const [cuerposEdit, setCuerposEdit] = useState<CuerpoEdit[]>(() =>
    getCuerpos().map((c) => ({ original: c, actual: c })),
  )
  const [cuerposSaved, setCuerposSaved] = useState(false)
  const [cuerposError, setCuerposError] = useState<string | null>(null)

  function updateCuerpo(index: number, actual: string) {
    setCuerposEdit((prev) => prev.map((c, i) => (i === index ? { ...c, actual } : c)))
    setCuerposSaved(false)
    setCuerposError(null)
  }

  function addCuerpo() {
    setCuerposEdit((prev) => [...prev, { original: null, actual: '' }])
    setCuerposSaved(false)
  }

  function removeCuerpo(index: number) {
    const c = cuerposEdit[index]
    // Una fila recién añadida (sin original) aún no existe: siempre se puede quitar.
    if (c.original && tramos.some((t) => t.cuerpo === c.original)) {
      setCuerposError(`No puedes quitar «${c.original}»: tiene tramos. Cambia antes esos tramos de cuerpo.`)
      return
    }
    setCuerposEdit((prev) => prev.filter((_, i) => i !== index))
    setCuerposSaved(false)
    setCuerposError(null)
  }

  async function handleSaveCuerpos() {
    // Vaciar el nombre de un cuerpo equivale a quitarlo: misma guardia que el botón de quitar.
    const vaciadoEnUso = cuerposEdit.find(
      (c) => c.original && !c.actual.trim() && tramos.some((t) => t.cuerpo === c.original),
    )
    if (vaciadoEnUso) {
      setCuerposError(
        `El cuerpo «${vaciadoEnUso.original}» tiene tramos: ponle nombre o cambia antes esos tramos de cuerpo.`,
      )
      return
    }
    const nombres = cuerposEdit.map((c) => c.actual.trim()).filter(Boolean)
    if (nombres.length === 0) {
      setCuerposError('Debe haber al menos un cuerpo (p. ej. «Único» si vais en un solo bloque).')
      return
    }
    if (new Set(nombres).size !== nombres.length) {
      setCuerposError('Hay nombres de cuerpo repetidos.')
      return
    }
    // Renombrados: los tramos que apuntaban al nombre antiguo pasan al nuevo.
    // En una sola pasada (mapa antiguo→nuevo) para que hasta un intercambio de
    // nombres entre dos cuerpos (A→B y B→A) se aplique sin corromper nada.
    const renombres = new Map<string, string>()
    cuerposEdit.forEach((c) => {
      const nuevo = c.actual.trim()
      if (c.original && nuevo && c.original !== nuevo) renombres.set(c.original, nuevo)
    })
    const renombra = (t: Tramo): Tramo => {
      const nuevo = renombres.get(t.cuerpo)
      return nuevo ? { ...t, cuerpo: nuevo } : t
    }
    // El renombrado se persiste sobre los tramos GUARDADOS (no arrastra las
    // ediciones sin guardar del editor de abajo); el editor en pantalla se
    // renombra también, pero sus demás cambios siguen pendientes de «Guardar tramos».
    if (renombres.size > 0) {
      setTramosTocado(true)
      await saveTramos(getTramos().map(renombra))
      setTramos((prev) => prev.map(renombra))
    }
    saveCuerpos(nombres)
    setCuerposGuardados(nombres)
    setCuerposEdit(nombres.map((n) => ({ original: n, actual: n })))
    setCuerposError(null)
    setCuerposSaved(true)
    setTimeout(() => setCuerposSaved(false), 3000)
  }

  async function descargarCopia() {
    setCopiaEstado('Preparando la copia…')
    try {
      const copia = await crearCopia()
      const fecha = new Date().toISOString().slice(0, 10)
      const slug = (settings.nombreLegal || 'hermandad').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      descargarArchivo(`copia-cabildo-${slug}-${fecha}.json`, JSON.stringify(copia), 'application/json;charset=utf-8;')
      setCopiaEstado('Copia descargada.')
    } catch {
      setCopiaEstado('No se pudo crear la copia.')
    }
    setTimeout(() => setCopiaEstado(null), 4000)
  }

  async function restaurarDesdeArchivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!window.confirm('Restaurar la copia sustituirá TODOS los datos actuales de la hermandad por los del archivo. ¿Continuar?')) return
    setCopiaEstado('Restaurando…')
    try {
      const texto = await file.text()
      const obj = JSON.parse(texto)
      if (!esCopiaValida(obj)) {
        setCopiaEstado('El archivo no es una copia de Cabildo válida.')
        setTimeout(() => setCopiaEstado(null), 4000)
        return
      }
      await restaurarCopia(obj)
      setCopiaEstado('Copia restaurada. Recargando…')
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      // El mensaje de la restauración explica qué ha pasado y si se ha
      // cambiado algo; genérico solo si el archivo ni siquiera se pudo leer.
      setCopiaEstado(e instanceof Error && e.message ? e.message : 'No se pudo leer el archivo.')
      setTimeout(() => setCopiaEstado(null), 7000)
    }
  }
  const aforos = useMemo(
    () => cuerposGuardados.map((c) => ({ cuerpo: c, total: aforoDeCuerpo(c, tramos) })).filter((a) => a.total > 0),
    [tramos, cuerposGuardados],
  )

  // Un grupo «por número» (mismo cuerpo y tipo) cobra un único precio: el del
  // primer tramo del grupo. Si la hermandad pone precios distintos dentro del
  // mismo grupo, se le avisa (sin bloquear) para que no haya sorpresas.
  const gruposConPrecioMixto = useMemo(() => {
    const avisos: string[] = []
    cuerposPresentesDe(tramos).forEach((cuerpo) => {
      gruposAutomaticos(tramos.filter((t) => t.cuerpo === cuerpo)).forEach((g) => {
        const precios = new Set(g.tramos.map((t) => precioDeTramo(t, precioBase)))
        if (precios.size > 1) avisos.push(`${cuerpo} — ${g.etiqueta}`)
      })
    })
    return avisos
  }, [tramos, precioBase])

  function updateTramo<K extends keyof Tramo>(id: string, key: K, value: Tramo[K]) {
    setTramos((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: value } : t)))
    setTramosTocado(true)
    setTramosSaved(false)
  }

  function addTramo() {
    setTramos((prev) => [
      ...prev,
      {
        id: nuevoId(),
        nombre: 'Nuevo tramo',
        cuerpo: cuerposGuardados[0] ?? 'Único',
        capacidad: 20,
        tipo: '',
        reparto: 'solicitud',
        precio: null,
      },
    ])
    setTramosTocado(true)
    setTramosSaved(false)
  }

  function removeTramo(id: string) {
    setTramos((prev) => prev.filter((t) => t.id !== id))
    setTramosTocado(true)
    setTramosSaved(false)
  }

  function moveTramo(id: string, dir: -1 | 1) {
    setTramos((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      const swapWith = idx + dir
      if (idx < 0 || swapWith < 0 || swapWith >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapWith]] = [next[swapWith], next[idx]]
      return next
    })
    setTramosTocado(true)
    setTramosSaved(false)
  }

  async function handleSaveTramos() {
    // Se guarda el reparto de forma explícita (los datos antiguos lo deducían del tipo).
    const explicitos = tramos.map((t) => ({ ...t, reparto: repartoDe(t) }))
    setTramos(explicitos)
    await saveTramos(explicitos)
    savePrecioBase(precioBase)
    setTramosTocado(false)
    setTramosSaved(true)
    setTimeout(() => setTramosSaved(false), 3000)
  }

  // ---- Papeletas personalizadas de la hermandad (nombre + precio propios) ----
  const opcionesRemotas = useOpcionesPapeleta()
  const [opciones, setOpciones] = useState<OpcionPapeleta[]>(opcionesRemotas)
  const [opcionesTocado, setOpcionesTocado] = useState(false)
  useEffect(() => {
    if (!opcionesTocado) setOpciones(opcionesRemotas)
  }, [opcionesRemotas, opcionesTocado])
  const [opcionesSaved, setOpcionesSaved] = useState(false)

  function updateOpcion<K extends keyof OpcionPapeleta>(id: string, key: K, value: OpcionPapeleta[K]) {
    setOpciones((prev) => prev.map((o) => (o.id === id ? { ...o, [key]: value } : o)))
    setOpcionesTocado(true)
    setOpcionesSaved(false)
  }

  function addOpcion() {
    setOpciones((prev) => [...prev, { id: nuevoId(), nombre: 'Nueva papeleta', importe: 10 }])
    setOpcionesTocado(true)
    setOpcionesSaved(false)
  }

  function removeOpcion(id: string) {
    setOpciones((prev) => prev.filter((o) => o.id !== id))
    setOpcionesTocado(true)
    setOpcionesSaved(false)
  }

  async function handleSaveOpciones() {
    await saveOpcionesPapeleta(opciones)
    setOpcionesTocado(false)
    setOpcionesSaved(true)
    setTimeout(() => setOpcionesSaved(false), 3000)
  }

  // ---- Catálogos de la hermandad (conceptos de cuota + listas simples) ----
  const conceptosCuotaRemotos = useConceptosCuota()
  const [conceptosCuota, setConceptosCuota] = useState<ConceptoCuotaConfig[]>(conceptosCuotaRemotos)
  const catalogosRemotos = useCatalogos(CATALOGOS_DEF)
  const [catalogos, setCatalogos] = useState<Record<string, string[]>>(catalogosRemotos)
  const [catalogosTocado, setCatalogosTocado] = useState(false)
  useEffect(() => {
    if (!catalogosTocado) {
      setConceptosCuota(conceptosCuotaRemotos)
      setCatalogos(catalogosRemotos)
    }
  }, [conceptosCuotaRemotos, catalogosRemotos, catalogosTocado])
  const [catalogosSaved, setCatalogosSaved] = useState(false)

  function updateConceptoCuota<K extends keyof ConceptoCuotaConfig>(id: string, key: K, value: ConceptoCuotaConfig[K]) {
    setConceptosCuota((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function addConceptoCuota() {
    setConceptosCuota((prev) => [...prev, { id: nuevoId(), nombre: 'Nueva cuota', importe: 10 }])
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function removeConceptoCuota(id: string) {
    setConceptosCuota((prev) => prev.filter((c) => c.id !== id))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function updateCatalogo(k: string, index: number, valor: string) {
    setCatalogos((prev) => ({ ...prev, [k]: prev[k].map((v, i) => (i === index ? valor : v)) }))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function addCatalogoValor(k: string) {
    setCatalogos((prev) => ({ ...prev, [k]: [...prev[k], ''] }))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function removeCatalogoValor(k: string, index: number) {
    setCatalogos((prev) => ({ ...prev, [k]: prev[k].filter((_, i) => i !== index) }))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  async function handleSaveCatalogos() {
    await saveConceptosCuota(conceptosCuota.filter((c) => c.nombre.trim()))
    const limpios: Record<string, string[]> = {}
    for (const d of CATALOGOS_DEF) {
      const valores = (catalogos[d.k] ?? []).map((v) => v.trim()).filter(Boolean)
      limpios[d.k] = valores.length > 0 ? valores : [...d.porDefecto]
      await saveLista(d.clave, limpios[d.k])
    }
    setCatalogos(limpios)
    setConceptosCuota((prev) => prev.filter((c) => c.nombre.trim()))
    setCatalogosTocado(false)
    setCatalogosSaved(true)
    setTimeout(() => setCatalogosSaved(false), 3000)
  }

  return (
    <div className="dash">
      <div className="dash-head">
        <p className="eyebrow">Configuración</p>
        <h1>Ajustes de la hermandad</h1>
        <p className="dash-head__lead">
          Cómo se llama, cómo sale en los documentos y cómo trabajáis: el cortejo, las papeletas y
          las listas que usa toda la aplicación. Solo lo ves tú, desde aquí.
        </p>
      </div>

      <div className="cfg-layout">
        {/* Mismo raíl que el editor de la web: nueve bloques en una sola
            columna eran un scroll sin fin y cinco botones de «Guardar» que no
            se sabía a qué parte correspondían. */}
        <nav className="cms-rail" aria-label="Secciones de los ajustes">
          {SECCIONES_CFG.map((g) => (
            <div className="cms-rail__grupo" key={g.titulo}>
              <p className="cms-rail__titulo">{g.titulo}</p>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`cms-rail__item${seccion === it.id ? ' cms-rail__item--on' : ''}`}
                  onClick={() => irASeccion(it.id)}
                  aria-current={seccion === it.id ? 'true' : undefined}
                >
                  <span className="cms-rail__ic" aria-hidden="true">{it.icono}</span>
                  <span className="cms-rail__label">{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="cfg-panel">

      {seccion === 'hermandad' && (
      <form className="settings-layout" onSubmit={handleSubmit}>
        <section className="settings-card">
          <h2 className="settings-card__title">Escudo o logotipo</h2>
          <div className="logo-uploader">
            <span className="logo-preview">
              {settings.logoDataUrl ? (
                <img src={settings.logoDataUrl} alt="Logo de la hermandad" />
              ) : (
                <LogoMark size={38} />
              )}
            </span>
            <div className="logo-uploader__info">
              <div className="logo-uploader__actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => fileRef.current?.click()}
                >
                  Subir imagen
                </button>
                {settings.logoDataUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => update('logoDataUrl', null)}
                  >
                    Quitar
                  </button>
                )}
              </div>
              <p className="form-hint">
                PNG, JPG o SVG · máx. 800 KB. Se usará en la cabecera de los recibos.
              </p>
              {logoError && <p className="form-hint form-hint--error">{logoError}</p>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={handleLogoChange}
              hidden
            />
          </div>

          <div className="color-picker-row">
            <span className="color-picker-swatch" style={{ background: settings.colorPrimario }} aria-hidden="true" />
            <div className="form-row">
              <label htmlFor="colorPrimario">Color de tu hermandad</label>
              <div className="color-picker-controls">
                <input
                  id="colorPrimario"
                  type="color"
                  value={settings.colorPrimario}
                  onChange={(e) => update('colorPrimario', e.target.value)}
                />
                <input
                  type="text"
                  className="color-picker-hex"
                  value={settings.colorPrimario}
                  onChange={(e) => update('colorPrimario', e.target.value)}
                  placeholder="#caa24a"
                  maxLength={7}
                />
              </div>
              <p className="form-hint">Tiñe los botones y acentos del área del hermano de tus hermanos/as.</p>
            </div>
          </div>

          <div className="color-picker-row">
            <span className="color-picker-swatch" style={{ background: settings.colorSecundario }} aria-hidden="true" />
            <div className="form-row">
              <label htmlFor="colorSecundario">Segundo color (acento)</label>
              <div className="color-picker-controls">
                <input
                  id="colorSecundario"
                  type="color"
                  value={settings.colorSecundario}
                  onChange={(e) => update('colorSecundario', e.target.value)}
                />
                <input
                  type="text"
                  className="color-picker-hex"
                  value={settings.colorSecundario}
                  onChange={(e) => update('colorSecundario', e.target.value)}
                  placeholder="#C5A059"
                  maxLength={7}
                />
              </div>
              <p className="form-hint">Color dorado o de detalle: filetes, degradados de la cabecera y la web.</p>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <h2 className="settings-card__title">Datos fiscales y de contacto</h2>

          <div className="form-row">
            <label htmlFor="nombreLegal">Nombre legal de la hermandad</label>
            <input
              id="nombreLegal"
              value={settings.nombreLegal}
              onChange={(e) => update('nombreLegal', e.target.value)}
              placeholder="Hermandad de la Vera-Cruz"
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="cif">CIF / NIF</label>
              <input
                id="cif"
                value={settings.cif}
                onChange={(e) => update('cif', e.target.value)}
                placeholder="G-00000000"
              />
            </div>
            <div className="form-row">
              <label htmlFor="telefono">Teléfono</label>
              <input
                id="telefono"
                value={settings.telefono}
                onChange={(e) => update('telefono', e.target.value)}
                placeholder="954 000 000"
              />
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="direccion">Dirección</label>
            <input
              id="direccion"
              value={settings.direccion}
              onChange={(e) => update('direccion', e.target.value)}
              placeholder="Plaza de la Hermandad, 3"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="codigoPostal">Código postal</label>
              <input
                id="codigoPostal"
                value={settings.codigoPostal}
                onChange={(e) => update('codigoPostal', e.target.value)}
                placeholder="41010"
              />
            </div>
            <div className="form-row">
              <label htmlFor="ciudad">Ciudad</label>
              <input
                id="ciudad"
                value={settings.ciudad}
                onChange={(e) => update('ciudad', e.target.value)}
                placeholder="Sevilla"
              />
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="provincia">Provincia</label>
            <input
              id="provincia"
              value={settings.provincia}
              onChange={(e) => update('provincia', e.target.value)}
              placeholder="Sevilla"
            />
            <p className="form-hint">Aparece en el Estado de Cuentas anual (Informes).</p>
          </div>

          <div className="form-row">
            <label htmlFor="email">Correo de contacto</label>
            <input
              id="email"
              type="email"
              value={settings.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="secretaria@tuhermandad.org"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="iban">IBAN de la hermandad</label>
              <input
                id="iban"
                value={settings.iban}
                onChange={(e) => update('iban', e.target.value)}
                placeholder="ES00 0000 0000 0000 0000 0000"
              />
              <p className="form-hint">Para domiciliar cuotas y para que los hermanos paguen por transferencia.</p>
            </div>
            <div className="form-row">
              <label htmlFor="bizumTelefono">Teléfono del Bizum</label>
              <input
                id="bizumTelefono"
                type="tel"
                value={settings.bizumTelefono}
                onChange={(e) => update('bizumTelefono', e.target.value)}
                placeholder="600 000 000"
              />
              <p className="form-hint">Los hermanos verán este número en su área para pagar la papeleta por Bizum.</p>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="identificadorAcreedor">Identificador de acreedor SEPA</label>
            <input
              id="identificadorAcreedor"
              value={settings.identificadorAcreedor}
              onChange={(e) => update('identificadorAcreedor', e.target.value)}
              placeholder="ES23000B12345678"
            />
            <p className="form-hint">Lo asigna tu banco al dar de alta el adeudo directo SEPA. Hace falta para generar la remesa.</p>
          </div>

          <div className="form-row">
            <label htmlFor="textoPieDocumentos">Texto legal del pie de recibos y justificantes</label>
            <textarea
              id="textoPieDocumentos"
              rows={2}
              value={settings.textoPieDocumentos}
              onChange={(e) => update('textoPieDocumentos', e.target.value)}
              placeholder="Ej. Entidad acogida a la Ley 49/2002; las cuotas y donativos pueden desgravar en el IRPF."
            />
            <p className="form-hint">Aparece al pie de los recibos de cuotas y justificantes de tesorería. Si lo dejas vacío se usa un texto genérico.</p>
          </div>
        </section>

        <div className="settings-actions">
          {saved && <span className="alert-item alert-item--ok">Guardado correctamente</span>}
          {errorGuardar && <span className="alert-item alert-item--warn">{errorGuardar}</span>}
          <button type="submit" className="btn btn-primary">
            Guardar cambios
          </button>
        </div>
      </form>
      )}

      {seccion === 'cortejo' && (
        <>
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Cuerpos del cortejo</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={addCuerpo}>
            + Añadir cuerpo
          </button>
        </div>
        <p className="form-hint">
          Los cuerpos son los bloques del cortejo (normalmente, un paso y su acompañamiento).
          Ponles el nombre que uséis en vuestra hermandad: Cristo y Virgen, Misterio y Palio,
          Cautivo… o un único cuerpo si salís en un solo bloque. Al renombrar un cuerpo, sus
          tramos se actualizan solos.
        </p>
        <div className="opciones-editor">
          {cuerposEdit.map((c, i) => (
            <div className="opcion-row opcion-row--cuerpo" key={`${c.original ?? 'nuevo'}-${i}`}>
              <input
                type="text"
                value={c.actual}
                onChange={(e) => updateCuerpo(i, e.target.value)}
                placeholder="Ej. Misterio, Palio, Único…"
                aria-label="Nombre del cuerpo"
              />
              <button type="button" className="icon-btn" title="Quitar cuerpo" onClick={() => removeCuerpo(i)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
        {cuerposError && <p className="form-hint form-hint--error">{cuerposError}</p>}
        <div className="settings-actions">
          {cuerposSaved && <span className="alert-item alert-item--ok">Cuerpos guardados</span>}
          <button type="button" className="btn btn-primary" onClick={handleSaveCuerpos}>
            Guardar cuerpos
          </button>
        </div>
      </section>

      <section className="settings-card tramos-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Tramos del cortejo</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={addTramo}>
            + Añadir tramo
          </button>
        </div>
        <p className="form-hint">
          Define los tramos de cada cuerpo, cuántos hermanos caben y <b>cómo se llena cada uno</b>:
          «Por número» es el reparto automático clásico de los cirios (la app coloca a los hermanos
          por su número, en cascada de un tramo al siguiente del mismo tipo); «Por solicitud» es
          para los puestos que se piden (cruz de guía, insignias, varas, presidencia…) y se los
          queda el de menor número. El orden de la lista es el orden real de desfile. El «tipo» es
          lo que se porta (cirio, insignia, vara…), texto libre; cada tramo puede tener además su
          propio precio de papeleta.
        </p>

        {aforos.length > 0 && (
          <div className="banner-inline banner-inline--accent">
            Aforo total:{' '}
            {aforos.map((a, i) => (
              <span key={a.cuerpo}>
                {i > 0 && ' · '}
                {a.cuerpo} {a.total}
              </span>
            ))}
            .
          </div>
        )}

        <div className="form-row tramos-precio-base">
          <label htmlFor="precioBase">Precio general de la papeleta</label>
          <div className="opcion-row__importe">
            <input
              id="precioBase"
              type="number"
              min="0"
              step="0.5"
              value={precioBase}
              onChange={(e) => {
                setPrecioBase(Number(e.target.value) || 0)
                setTramosSaved(false)
              }}
            />
            <span>€</span>
          </div>
          <p className="form-hint">Se usa en los tramos que no fijan su propio precio.</p>
        </div>

        <div className="tramos-editor">
          <div className="tramo-row tramo-row--head">
            <span>Nombre del tramo</span>
            <span>Cuerpo</span>
            <span>Tipo de puesto</span>
            <span>Reparto</span>
            <span>Aforo</span>
            <span>Precio €</span>
            <span>Citación</span>
            <span></span>
            <span></span>
          </div>
          {tramos.map((t, i) => (
            <div className="tramo-row" key={t.id}>
              <input
                type="text"
                value={t.nombre}
                onChange={(e) => updateTramo(t.id, 'nombre', e.target.value)}
                placeholder="Ej. Cirio 1º tramo"
              />
              <select value={t.cuerpo} onChange={(e) => updateTramo(t.id, 'cuerpo', e.target.value as Cuerpo)}>
                {(cuerposGuardados.includes(t.cuerpo) ? cuerposGuardados : [t.cuerpo, ...cuerposGuardados]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={t.tipo ?? ''}
                onChange={(e) => updateTramo(t.id, 'tipo', e.target.value)}
                placeholder="Cirio, Insignia…"
              />
              <select
                value={repartoDe(t)}
                onChange={(e) => updateTramo(t.id, 'reparto', e.target.value as ModoReparto)}
                aria-label="Modo de reparto"
              >
                <option value="numero">Por número</option>
                <option value="solicitud">Por solicitud</option>
              </select>
              <input
                type="number"
                min="1"
                value={t.capacidad}
                onChange={(e) => updateTramo(t.id, 'capacidad', Number(e.target.value) || 0)}
              />
              <input
                type="number"
                min="0"
                step="0.5"
                value={t.precio ?? ''}
                placeholder={String(precioBase)}
                onChange={(e) => updateTramo(t.id, 'precio', e.target.value === '' ? null : Number(e.target.value) || 0)}
                aria-label="Precio de la papeleta del tramo"
              />
              {/* A qué hora se cita ESTE tramo el día de la salida: cada uno
                  entra a una hora, y es la pregunta de la semana antes. */}
              <input
                type="time"
                value={t.horaCitacion ?? ''}
                onChange={(e) => updateTramo(t.id, 'horaCitacion', e.target.value)}
                aria-label="Hora de citación del tramo"
              />
              <span className="tramo-row__mover">
                <button
                  type="button"
                  className="icon-btn"
                  title="Mover antes"
                  disabled={i === 0}
                  onClick={() => moveTramo(t.id, -1)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 15 12 9l-6 6" /></svg>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Mover después"
                  disabled={i === tramos.length - 1}
                  onClick={() => moveTramo(t.id, 1)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 9 12 15l6-6" /></svg>
                </button>
              </span>
              <button
                type="button"
                className="icon-btn"
                title="Quitar tramo"
                onClick={() => removeTramo(t.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
          {tramos.length === 0 && (
            <p className="form-hint">No hay tramos configurados todavía. Añade el primero.</p>
          )}
        </div>

        {gruposConPrecioMixto.length > 0 && (
          <p className="form-hint form-hint--error">
            Ojo: hay grupos «por número» con precios distintos entre sus tramos ({gruposConPrecioMixto.join(', ')}).
            Al sacar la papeleta se cobra el precio del primer tramo del grupo; iguala los precios para evitar
            sorpresas.
          </p>
        )}

        <div className="settings-actions">
          {tramosSaved && <span className="alert-item alert-item--ok">Tramos guardados</span>}
          <button type="button" className="btn btn-primary" onClick={handleSaveTramos}>
            Guardar tramos
          </button>
        </div>
      </section>
        </>
      )}

      {seccion === 'papeletas' && (
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Papeletas personalizadas</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={addOpcion}>
            + Añadir papeleta
          </button>
        </div>
        <p className="form-hint">
          Además de los puestos del cortejo, tu hermandad puede ofrecer sus propias papeletas con
          nombre y precio libres: mantilla, papeleta simbólica de quien no procesiona, monaguillo,
          recuerdo… Aparecerán al emitir una papeleta en gestión y en el área del hermano.
        </p>

        <div className="opciones-editor">
          {opciones.map((o) => (
            <div className="opcion-row" key={o.id}>
              <input
                type="text"
                value={o.nombre}
                onChange={(e) => updateOpcion(o.id, 'nombre', e.target.value)}
                placeholder="Ej. Mantilla"
                aria-label="Nombre de la papeleta"
              />
              <div className="opcion-row__importe">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={o.importe}
                  onChange={(e) => updateOpcion(o.id, 'importe', Number(e.target.value) || 0)}
                  aria-label="Importe en euros"
                />
                <span>€</span>
              </div>
              <button type="button" className="icon-btn" title="Quitar papeleta" onClick={() => removeOpcion(o.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
          {opciones.length === 0 && (
            <p className="form-hint">No hay papeletas personalizadas. Añade la primera si tu hermandad las usa.</p>
          )}
        </div>

        <div className="settings-actions">
          {opcionesSaved && <span className="alert-item alert-item--ok">Papeletas guardadas</span>}
          <button type="button" className="btn btn-primary" onClick={handleSaveOpciones}>
            Guardar papeletas
          </button>
        </div>
      </section>
      )}

      {seccion === 'catalogos' && (
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Catálogos de la hermandad</h2>
        </div>
        <p className="form-hint">
          Las listas que usan los demás módulos, adaptadas a vuestra forma de trabajar: conceptos y
          precios de las cuotas, categorías de tesorería e inventario, tipos de incidencia del día
          de salida, canales y destinatarios de los comunicados. Añade, renombra o quita lo que
          necesites: los módulos las usan al momento.
        </p>

        <div className="catalogo-bloque">
          <div className="catalogo-bloque__head">
            <h3>Conceptos de cuota</h3>
            <button type="button" className="btn btn-outline btn-sm" onClick={addConceptoCuota}>
              + Añadir
            </button>
          </div>
          <div className="opciones-editor">
            {conceptosCuota.map((c) => (
              <div className="opcion-row" key={c.id}>
                <input
                  type="text"
                  value={c.nombre}
                  onChange={(e) => updateConceptoCuota(c.id, 'nombre', e.target.value)}
                  placeholder="Ej. Cuota juvenil"
                  aria-label="Nombre del concepto de cuota"
                />
                <div className="opcion-row__importe">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={c.importe}
                    onChange={(e) => updateConceptoCuota(c.id, 'importe', Number(e.target.value) || 0)}
                    aria-label="Importe de la cuota en euros"
                  />
                  <span>€</span>
                </div>
                <button type="button" className="icon-btn" title="Quitar concepto" onClick={() => removeConceptoCuota(c.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="catalogos-grid">
          {CATALOGOS_DEF.map((d) => (
            <div className="catalogo-bloque" key={d.k}>
              <div className="catalogo-bloque__head">
                <h3>{d.titulo}</h3>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => addCatalogoValor(d.k)}>
                  + Añadir
                </button>
              </div>
              <div className="opciones-editor">
                {(catalogos[d.k] ?? []).map((valor, i) => (
                  <div className="opcion-row opcion-row--cuerpo" key={`${d.k}-${i}`}>
                    <input
                      type="text"
                      value={valor}
                      onChange={(e) => updateCatalogo(d.k, i, e.target.value)}
                      aria-label={d.titulo}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      title="Quitar"
                      onClick={() => removeCatalogoValor(d.k, i)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="settings-actions">
          {catalogosSaved && <span className="alert-item alert-item--ok">Catálogos guardados</span>}
          <button type="button" className="btn btn-primary" onClick={handleSaveCatalogos}>
            Guardar catálogos
          </button>
        </div>
      </section>
      )}

      {seccion === 'ficha' && <CamposPropiosCard />}

      {seccion === 'datos' && (
        <>
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Copia de seguridad</h2>
        </div>
        <p className="form-hint">
          Mientras no conectamos la base de datos en la nube, todos los datos viven en este
          navegador. Descarga una copia (un solo archivo, con hermanos, cuotas, papeletas,
          tesorería, documentos y sus adjuntos) para no perderla al cambiar de ordenador o limpiar
          el navegador, y restaúrala en otro equipo cuando quieras.
        </p>
        <div className="settings-actions">
          {copiaEstado && <span className="alert-item alert-item--ok">{copiaEstado}</span>}
          <input
            ref={backupRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={restaurarDesdeArchivo}
          />
          <button type="button" className="btn btn-ghost" onClick={() => backupRef.current?.click()}>
            Restaurar copia
          </button>
          <button type="button" className="btn btn-primary" onClick={descargarCopia}>
            Descargar copia
          </button>
        </div>
      </section>

      <section className="settings-card settings-card--peligro">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Restablecer datos</h2>
        </div>
        <p className="form-hint">
          Si quieres empezar de cero con los datos de ejemplo, puedes restablecerlos aquí. Se borra
          todo lo guardado en este navegador. Esta acción no se puede deshacer.
        </p>
        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              if (window.confirm('¿Borrar todos los datos guardados y volver a los de ejemplo?')) {
                restablecerDatosDeEjemplo()
              }
            }}
          >
            Restablecer datos de ejemplo
          </button>
        </div>
      </section>
        </>
      )}
        </div>
      </div>
    </div>
  )
}

/* -------------------- Campos propios de la ficha del hermano -------------------- */
/**
 * Cada hermandad apunta cosas distintas —la talla de la túnica, el número de
 * llave de la casa hermandad— y no tiene sentido inventar un campo fijo para
 * cada una. Aquí define los suyos, y aparecen en la ficha del hermano y en los
 * sesgos.
 */
function CamposPropiosCard() {
  const [campos, setCampos] = useCamposPropios()

  function editar(id: string, cambios: Partial<CampoPropio>) {
    setCampos(campos.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
  }
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= campos.length) return
    const arr = [...campos]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setCampos(arr)
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Campos propios de la ficha</h2>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setCampos([...campos, { id: nuevoId(), nombre: '', tipo: 'texto', opciones: [], ayuda: '', enAlta: false }])}
        >
          + Añadir campo
        </button>
      </div>
      <p className="form-hint">
        Lo que apuntáis a mano en una hoja aparte: talla de túnica, número de llave, si tiene el
        carné de costalero… Aparecen en la ficha de cada hermano y se puede sesgar por ellos
        («todos los de talla L»).
      </p>
      {campos.length === 0 && <p className="form-hint">Todavía no hay ningún campo propio.</p>}

      {campos.map((c, i) => (
        <div className="assign-box" key={c.id}>
          <div className="assign-box__row">
            <input
              type="text"
              value={c.nombre}
              onChange={(e) => editar(c.id, { nombre: e.target.value })}
              placeholder="Nombre del campo"
              aria-label="Nombre del campo"
            />
            <select value={c.tipo} onChange={(e) => editar(c.id, { tipo: e.target.value as CampoPropio['tipo'] })} aria-label="Tipo de campo">
              {TIPOS_CAMPO.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <button type="button" className="icon-btn" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
            <button type="button" className="icon-btn" title="Bajar" disabled={i === campos.length - 1} onClick={() => mover(i, 1)}>▼</button>
            <button
              type="button"
              className="btn btn-ghost btn-sm rgpd-borrar"
              onClick={() => setCampos(campos.filter((x) => x.id !== c.id))}
            >
              Quitar
            </button>
          </div>
          {!c.nombre.trim() && <p className="form-hint form-hint--alerta">Ponle nombre o no se verá en la ficha.</p>}
          {c.tipo === 'lista' && (
            <div className="form-row">
              <label>Opciones (una por línea)</label>
              <textarea
                rows={3}
                value={c.opciones.join('\n')}
                onChange={(e) => editar(c.id, { opciones: e.target.value.split('\n').map((o) => o.trim()).filter(Boolean) })}
                placeholder={'S\nM\nL\nXL'}
              />
              {c.opciones.length === 0 && <p className="form-hint form-hint--alerta">Una lista sin opciones no deja elegir nada.</p>}
            </div>
          )}
          <div className="form-row">
            <label>Ayuda (opcional)</label>
            <input
              type="text"
              value={c.ayuda}
              onChange={(e) => editar(c.id, { ayuda: e.target.value })}
              placeholder={TIPOS_CAMPO.find((t) => t.id === c.tipo)?.ejemplo ?? ''}
            />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={c.enAlta} onChange={(e) => editar(c.id, { enAlta: e.target.checked })} />
            <span>Pedirlo también al dar de alta a un hermano nuevo</span>
          </label>
        </div>
      ))}

      {/* Nada de un botón «Guardar» que no guarda: se guardan al escribir. */}
      <p className="form-hint">Los cambios se guardan solos.</p>
    </section>
  )
}
