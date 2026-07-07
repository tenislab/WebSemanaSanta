import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { LogoMark } from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import {
  getHermandadSettings,
  saveHermandadSettings,
  type HermandadSettings,
} from '../../lib/hermandadSettings'
import { getTramos, saveTramos, solapes, type Tramo } from '../../lib/tramos'

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
  const overlaps = useMemo(() => solapes(tramos), [tramos])

  function updateTramo<K extends keyof Tramo>(id: string, key: K, value: Tramo[K]) {
    setTramos((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: value } : t)))
    setTramosSaved(false)
  }

  function addTramo() {
    const maxHasta = tramos.reduce((m, t) => Math.max(m, t.hasta), 0)
    setTramos((prev) => [
      ...prev,
      { id: `t-${Date.now()}`, nombre: 'Nuevo tramo', desde: maxHasta + 1, hasta: maxHasta + 50 },
    ])
    setTramosSaved(false)
  }

  function removeTramo(id: string) {
    setTramos((prev) => prev.filter((t) => t.id !== id))
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

          <div className="form-row">
            <label htmlFor="iban">IBAN para domiciliaciones</label>
            <input
              id="iban"
              value={settings.iban}
              onChange={(e) => update('iban', e.target.value)}
              placeholder="ES00 0000 0000 0000 0000 0000"
            />
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
          Define cuántos tramos hay y qué rango de puestos cubre cada uno. Al asignar una papeleta
          de sitio, basta con escribir el número de puesto: el tramo se calcula solo. Un puesto más
          alto queda más lejos de la cruz de guía que uno más bajo.
        </p>

        {overlaps.length > 0 && (
          <div className="banner-inline banner-inline--warn">
            Estos tramos se solapan y pueden dar resultados ambiguos:{' '}
            {overlaps.map(([a, b], i) => (
              <span key={`${a.id}-${b.id}`}>
                {i > 0 && ', '}«{a.nombre}» y «{b.nombre}»
              </span>
            ))}
            .
          </div>
        )}

        <div className="tramos-editor">
          <div className="tramo-row tramo-row--head">
            <span>Nombre del tramo</span>
            <span>Desde</span>
            <span>Hasta</span>
            <span></span>
          </div>
          {tramos.map((t) => (
            <div className="tramo-row" key={t.id}>
              <input
                type="text"
                value={t.nombre}
                onChange={(e) => updateTramo(t.id, 'nombre', e.target.value)}
                placeholder="Ej. Cristo — Cirio 1º tramo"
              />
              <input
                type="number"
                min="1"
                value={t.desde}
                onChange={(e) => updateTramo(t.id, 'desde', Number(e.target.value) || 0)}
              />
              <input
                type="number"
                min="1"
                value={t.hasta}
                onChange={(e) => updateTramo(t.id, 'hasta', Number(e.target.value) || 0)}
              />
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
    </div>
  )
}
