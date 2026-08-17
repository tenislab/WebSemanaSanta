import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  PLANTILLAS,
  aSlug,
  useWebPublica,
  type CultoWeb,
  type PlantillaWeb,
} from '../../lib/webPublica'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { nuevoId } from '../../lib/supabaseSync'

/** Reduce una imagen grande para que quepa en localStorage. */
function comprimirImagen(dataUrl: string, maxLado = 1600): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
      if (escala >= 1) return resolve(dataUrl)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export default function WebPublica() {
  const [web, setWeb] = useWebPublica()
  const hermandad = useHermandadSettings()
  const [copiado, setCopiado] = useState(false)

  // Al entrar por primera vez, hereda de la hermandad el nombre y el color
  // (que luego se pueden cambiar), para no partir de una web vacía.
  useEffect(() => {
    const parche: Partial<typeof web> = {}
    if (!web.titulo && hermandad.nombreLegal) parche.titulo = hermandad.nombreLegal
    if (web.colorPrimario === '#6A1A23' && hermandad.colorPrimario) parche.colorPrimario = hermandad.colorPrimario
    if (!web.slug && hermandad.nombreLegal) parche.slug = aSlug(hermandad.nombreLegal)
    if (Object.keys(parche).length) setWeb({ ...web, ...parche })
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enlace = `${window.location.origin}/w/${web.slug}`

  function editar<K extends keyof typeof web>(campo: K, valor: (typeof web)[K]) {
    setWeb({ ...web, [campo]: valor })
  }

  async function subirFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const lector = new FileReader()
    lector.onload = async () => {
      const comprimida = await comprimirImagen(String(lector.result))
      editar('fotoPortadaDataUrl', comprimida)
    }
    lector.readAsDataURL(file)
    e.target.value = ''
  }

  function editarCulto(id: string, cambios: Partial<CultoWeb>) {
    editar('cultos', web.cultos.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
  }
  function anadirCulto() {
    editar('cultos', [...web.cultos, { id: nuevoId(), titulo: 'Nuevo culto', detalle: '' }])
  }
  function borrarCulto(id: string) {
    editar('cultos', web.cultos.filter((c) => c.id !== id))
  }

  function copiarEnlace() {
    navigator.clipboard?.writeText(enlace).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Web pública</p>
          <h1>Tu página web</h1>
          <p className="dash-head__lead">
            Elige una plantilla, personalízala y publícala. Tu web incluye un botón «Entrar» que
            lleva a tus hermanos al portal del hermano.
          </p>
        </div>
        <div className="dash-head__actions">
          <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
            Ver mi web
          </a>
        </div>
      </div>

      {/* Publicación + enlace */}
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Publicación</h2>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={web.publicada}
            onChange={(e) => editar('publicada', e.target.checked)}
          />
          <span>{web.publicada ? 'Web publicada (visible para todos)' : 'Web oculta (solo tú la ves)'}</span>
        </label>
        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="slug">Enlace de tu web</label>
          <div className="assign-box__row">
            <span className="table-subtle">{window.location.origin}/w/</span>
            <input
              id="slug"
              type="text"
              value={web.slug}
              onChange={(e) => editar('slug', aSlug(e.target.value))}
              placeholder="mi-hermandad"
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={copiarEnlace}>
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="form-hint">
            Solo letras, números y guiones. Podrás usar un dominio propio más adelante.
          </p>
        </div>
      </section>

      {/* Plantilla */}
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Plantilla</h2>
        </div>
        <div className="plantillas-grid">
          {PLANTILLAS.map((pl) => (
            <button
              type="button"
              key={pl.id}
              className={`plantilla-card${web.plantilla === pl.id ? ' plantilla-card--sel' : ''}`}
              onClick={() => editar('plantilla', pl.id as PlantillaWeb)}
            >
              <span className={`plantilla-card__mini plantilla-card__mini--${pl.id}`} aria-hidden="true">
                <span /><span /><span />
              </span>
              <b>{pl.nombre}</b>
              <small>{pl.descripcion}</small>
            </button>
          ))}
        </div>
      </section>

      {/* Contenido */}
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Contenido</h2>
        </div>
        <div className="form-row">
          <label htmlFor="titulo">Nombre de la hermandad</label>
          <input id="titulo" type="text" value={web.titulo} onChange={(e) => editar('titulo', e.target.value)} />
        </div>
        <div className="form-row">
          <label htmlFor="lema">Lema o subtítulo</label>
          <input id="lema" type="text" value={web.lema} onChange={(e) => editar('lema', e.target.value)} />
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="color">Color principal</label>
            <input id="color" type="color" value={web.colorPrimario} onChange={(e) => editar('colorPrimario', e.target.value)} />
            <p className="form-hint">Por defecto, el color de tu hermandad. Cámbialo si quieres.</p>
          </div>
          <div className="form-row">
            <label>Foto de portada</label>
            <label className="btn btn-outline btn-sm">
              {web.fotoPortadaDataUrl ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/*" onChange={subirFoto} hidden />
            </label>
            {web.fotoPortadaDataUrl && (
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('fotoPortadaDataUrl', null)}>
                Quitar foto
              </button>
            )}
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="historia">Historia</label>
          <textarea id="historia" rows={5} value={web.historia} onChange={(e) => editar('historia', e.target.value)} />
        </div>
      </section>

      {/* Cultos */}
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Cultos y actos</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={anadirCulto}>+ Añadir</button>
        </div>
        {web.cultos.map((c) => (
          <div className="assign-box" key={c.id}>
            <div className="form-row">
              <input
                type="text"
                value={c.titulo}
                onChange={(e) => editarCulto(c.id, { titulo: e.target.value })}
                placeholder="Título del culto"
              />
            </div>
            <div className="assign-box__row">
              <input
                type="text"
                value={c.detalle}
                onChange={(e) => editarCulto(c.id, { detalle: e.target.value })}
                placeholder="Detalle (fechas, lugar…)"
              />
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => borrarCulto(c.id)}>
                Quitar
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Contacto */}
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Contacto</h2>
        </div>
        <p className="form-hint">
          Si lo dejas vacío, se usan los datos de <Link to="/app/configuracion">Configuración</Link>.
        </p>
        <div className="form-row">
          <label htmlFor="direccion">Dirección</label>
          <input id="direccion" type="text" value={web.direccion} onChange={(e) => editar('direccion', e.target.value)} placeholder={hermandad.direccion} />
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="telefono">Teléfono</label>
            <input id="telefono" type="text" value={web.telefono} onChange={(e) => editar('telefono', e.target.value)} placeholder={hermandad.telefono} />
          </div>
          <div className="form-row">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" value={web.email} onChange={(e) => editar('email', e.target.value)} placeholder={hermandad.email} />
          </div>
        </div>
      </section>
    </div>
  )
}
