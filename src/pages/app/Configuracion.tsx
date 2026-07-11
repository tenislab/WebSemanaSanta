import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { LogoMark } from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import {
  getHermandadSettings,
  saveHermandadSettings,
  type HermandadSettings,
} from '../../lib/hermandadSettings'
import { getTramos, saveTramos, aforoDeCuerpo, type Cuerpo, type Tramo } from '../../lib/tramos'
import { restablecerDatosDeEjemplo } from '../../lib/persistencia'
import { crearCopia, esCopiaValida, restaurarCopia } from '../../lib/backup'
import { descargarArchivo } from '../../lib/csv'

const CUERPOS: Cuerpo[] = ['Cristo', 'Virgen', 'Único']

const MAX_LOGO_BYTES = 800_000

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
  const [copiaEstado, setCopiaEstado] = useState<string | null>(null)
  const backupRef = useRef<HTMLInputElement>(null)

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
    () => CUERPOS.map((c) => ({ cuerpo: c, total: aforoDeCuerpo(c, tramos) })).filter((a) => a.total > 0),
    [tramos],
  )

  function updateTramo<K extends keyof Tramo>(id: string, key: K, value: Tramo[K]) {
    setTramos((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: value } : t)))
    setTramosSaved(false)
  }

  function addTramo() {
    setTramos((prev) => [
      ...prev,
      { id: `t-${Date.now()}`, nombre: 'Nuevo tramo', cuerpo: 'Cristo', capacidad: 20, tipo: '' },
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
    saveTramos(tramos)
    setTramosSaved(true)
    setTimeout(() => setTramosSaved(false), 3000)
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
              <label htmlFor="iban">IBAN para domiciliaciones</label>
              <input
                id="iban"
                value={settings.iban}
                onChange={(e) => update('iban', e.target.value)}
                placeholder="ES00 0000 0000 0000 0000 0000"
              />
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
          </div>
        </section>

        <div className="settings-actions">
          {saved && <span className="alert-item alert-item--ok">Guardado correctamente</span>}
          <button type="submit" className="btn btn-primary">
            Guardar cambios
          </button>
        </div>
      </form>

      <section className="settings-card tramos-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Tramos del cortejo</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={addTramo}>
            + Añadir tramo
          </button>
        </div>
        <p className="form-hint">
          Define cuántos tramos hay, a qué cuerpo pertenece cada uno y cuántos hermanos caben. El
          orden de la lista es el orden real de desfile dentro de su cuerpo: el primero va justo
          detrás de la cruz de guía. Al emitir una papeleta de sitio solo hace falta elegir el
          cuerpo (Cristo o Virgen): el tramo se calcula solo, repartiendo por número de hermano
          según el aforo de cada tramo. El «tipo» es lo que se porta en ese tramo (cirio, insignia,
          vara, presidencia…): lo define cada hermandad, escribe lo que uséis en la vuestra.
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

        <div className="tramos-editor">
          <div className="tramo-row tramo-row--head">
            <span>Nombre del tramo</span>
            <span>Cuerpo</span>
            <span>Tipo de puesto</span>
            <span>Aforo</span>
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
                {CUERPOS.map((c) => (
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
              <input
                type="number"
                min="1"
                value={t.capacidad}
                onChange={(e) => updateTramo(t.id, 'capacidad', Number(e.target.value) || 0)}
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

        <div className="settings-actions">
          {tramosSaved && <span className="alert-item alert-item--ok">Tramos guardados</span>}
          <button type="button" className="btn btn-primary" onClick={handleSaveTramos}>
            Guardar tramos
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
