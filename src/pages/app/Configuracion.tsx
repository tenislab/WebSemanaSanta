import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { LogoMark } from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import {
  getHermandadSettings,
  saveHermandadSettings,
  type HermandadSettings,
} from '../../lib/hermandadSettings'
import {
  getTramos,
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
import { getOpcionesPapeleta, saveOpcionesPapeleta, type OpcionPapeleta } from '../../lib/opcionesPapeleta'
import { getConceptosCuota, saveConceptosCuota, type ConceptoCuotaConfig } from '../../lib/conceptosCuota'
import { CLAVES_CATALOGOS, getLista, saveLista } from '../../lib/catalogos'
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO, CUENTAS_POR_DEFECTO } from '../../data/movimientos'
import { TIPOS_INCIDENCIA_POR_DEFECTO } from '../../data/incidencias'
import { CATEGORIAS_ENSER } from '../../data/enseres'
import { CANALES, SEGMENTOS } from '../../data/comunicados'
import { restablecerDatosDeEjemplo } from '../../lib/persistencia'
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

export default function Configuracion() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''

  const [settings, setSettings] = useState<HermandadSettings>(() =>
    getHermandadSettings(fallbackNombre),
  )
  const [saved, setSaved] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof HermandadSettings>(key: K, value: HermandadSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
    setSaved(false)
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveHermandadSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const [tramos, setTramos] = useState<Tramo[]>(() => getTramos())
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

  function handleSaveCuerpos() {
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
      saveTramos(getTramos().map(renombra))
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
    } catch {
      setCopiaEstado('No se pudo leer el archivo.')
      setTimeout(() => setCopiaEstado(null), 4000)
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
    setTramosSaved(false)
  }

  function addTramo() {
    setTramos((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        nombre: 'Nuevo tramo',
        cuerpo: cuerposGuardados[0] ?? 'Único',
        capacidad: 20,
        tipo: '',
        reparto: 'solicitud',
        precio: null,
      },
    ])
    setTramosSaved(false)
  }

  function removeTramo(id: string) {
    setTramos((prev) => prev.filter((t) => t.id !== id))
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
    setTramosSaved(false)
  }

  function handleSaveTramos() {
    // Se guarda el reparto de forma explícita (los datos antiguos lo deducían del tipo).
    const explicitos = tramos.map((t) => ({ ...t, reparto: repartoDe(t) }))
    setTramos(explicitos)
    saveTramos(explicitos)
    savePrecioBase(precioBase)
    setTramosSaved(true)
    setTimeout(() => setTramosSaved(false), 3000)
  }

  // ---- Papeletas personalizadas de la hermandad (nombre + precio propios) ----
  const [opciones, setOpciones] = useState<OpcionPapeleta[]>(() => getOpcionesPapeleta())
  const [opcionesSaved, setOpcionesSaved] = useState(false)

  function updateOpcion<K extends keyof OpcionPapeleta>(id: string, key: K, value: OpcionPapeleta[K]) {
    setOpciones((prev) => prev.map((o) => (o.id === id ? { ...o, [key]: value } : o)))
    setOpcionesSaved(false)
  }

  function addOpcion() {
    setOpciones((prev) => [...prev, { id: `op-${Date.now()}`, nombre: 'Nueva papeleta', importe: 10 }])
    setOpcionesSaved(false)
  }

  function removeOpcion(id: string) {
    setOpciones((prev) => prev.filter((o) => o.id !== id))
    setOpcionesSaved(false)
  }

  function handleSaveOpciones() {
    saveOpcionesPapeleta(opciones)
    setOpcionesSaved(true)
    setTimeout(() => setOpcionesSaved(false), 3000)
  }

  // ---- Catálogos de la hermandad (conceptos de cuota + listas simples) ----
  const [conceptosCuota, setConceptosCuota] = useState<ConceptoCuotaConfig[]>(() => getConceptosCuota())
  const [catalogos, setCatalogos] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(CATALOGOS_DEF.map((d) => [d.k, getLista(d.clave, d.porDefecto)])),
  )
  const [catalogosSaved, setCatalogosSaved] = useState(false)

  function updateConceptoCuota<K extends keyof ConceptoCuotaConfig>(id: string, key: K, value: ConceptoCuotaConfig[K]) {
    setConceptosCuota((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)))
    setCatalogosSaved(false)
  }

  function addConceptoCuota() {
    setConceptosCuota((prev) => [...prev, { id: `cc-${Date.now()}`, nombre: 'Nueva cuota', importe: 10 }])
    setCatalogosSaved(false)
  }

  function removeConceptoCuota(id: string) {
    setConceptosCuota((prev) => prev.filter((c) => c.id !== id))
    setCatalogosSaved(false)
  }

  function updateCatalogo(k: string, index: number, valor: string) {
    setCatalogos((prev) => ({ ...prev, [k]: prev[k].map((v, i) => (i === index ? valor : v)) }))
    setCatalogosSaved(false)
  }

  function addCatalogoValor(k: string) {
    setCatalogos((prev) => ({ ...prev, [k]: [...prev[k], ''] }))
    setCatalogosSaved(false)
  }

  function removeCatalogoValor(k: string, index: number) {
    setCatalogos((prev) => ({ ...prev, [k]: prev[k].filter((_, i) => i !== index) }))
    setCatalogosSaved(false)
  }

  function handleSaveCatalogos() {
    saveConceptosCuota(conceptosCuota.filter((c) => c.nombre.trim()))
    const limpios: Record<string, string[]> = {}
    CATALOGOS_DEF.forEach((d) => {
      const valores = (catalogos[d.k] ?? []).map((v) => v.trim()).filter(Boolean)
      limpios[d.k] = valores.length > 0 ? valores : [...d.porDefecto]
      saveLista(d.clave, limpios[d.k])
    })
    setCatalogos(limpios)
    setConceptosCuota((prev) => prev.filter((c) => c.nombre.trim()))
    setCatalogosSaved(true)
    setTimeout(() => setCatalogosSaved(false), 3000)
  }

  return (
    <div className="dash">
      <div className="dash-head">
        <p className="eyebrow">Configuración</p>
        <h1>Datos de la hermandad</h1>
        <p className="dash-head__lead">
          Esta información aparece en la cabecera de las cuotas y demás documentos que genera
          Cabildo. Solo la ves tú, desde este panel.
        </p>
      </div>

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
          <button type="submit" className="btn btn-primary">
            Guardar cambios
          </button>
        </div>
      </form>

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

      <section className="settings-card">
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
    </div>
  )
}
