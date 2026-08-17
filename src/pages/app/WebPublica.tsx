import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  PLANTILLAS,
  SECCIONES_INFO,
  TIPOGRAFIAS,
  aSlug,
  useWebPublica,
  type AlturaHero,
  type CultoWeb,
  type FotoGaleria,
  type PlantillaWeb,
  type RedWeb,
  type TemaWeb,
  type TipoRed,
  type TipografiaWeb,
  type Titular,
  type WebPublica,
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

function leerImagen(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void) {
  const file = e.target.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  const lector = new FileReader()
  lector.onload = async () => cb(await comprimirImagen(String(lector.result)))
  lector.readAsDataURL(file)
  e.target.value = ''
}

const REDES: TipoRed[] = ['Instagram', 'Facebook', 'X', 'YouTube', 'TikTok', 'Web']
const ALTURAS: { id: AlturaHero; label: string }[] = [
  { id: 'compacta', label: 'Compacta' },
  { id: 'media', label: 'Media' },
  { id: 'completa', label: 'Pantalla completa' },
]

export default function WebPublica() {
  const [web, setWeb] = useWebPublica()
  const hermandad = useHermandadSettings()
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const parche: Partial<WebPublica> = {}
    if (!web.titulo && hermandad.nombreLegal) parche.titulo = hermandad.nombreLegal
    if (web.colorPrimario === '#6A1A23' && hermandad.colorPrimario) parche.colorPrimario = hermandad.colorPrimario
    if (!web.slug && hermandad.nombreLegal) parche.slug = aSlug(hermandad.nombreLegal)
    if (Object.keys(parche).length) setWeb({ ...web, ...parche })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enlace = `${window.location.origin}/w/${web.slug}`

  function editar<K extends keyof WebPublica>(campo: K, valor: WebPublica[K]) {
    setWeb({ ...web, [campo]: valor })
  }

  // ---- Secciones (orden + visibilidad) ----
  function toggleSeccion(i: number) {
    const secciones = web.secciones.map((s, idx) => (idx === i ? { ...s, visible: !s.visible } : s))
    editar('secciones', secciones)
  }
  function moverSeccion(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.secciones.length) return
    const secciones = [...web.secciones]
    ;[secciones[i], secciones[j]] = [secciones[j], secciones[i]]
    editar('secciones', secciones)
  }

  // ---- Titulares ----
  function editarTitular(id: string, cambios: Partial<Titular>) {
    editar('titulares', web.titulares.map((t) => (t.id === id ? { ...t, ...cambios } : t)))
  }
  function anadirTitular() {
    editar('titulares', [...web.titulares, { id: nuevoId(), nombre: 'Nuevo titular', fotoDataUrl: null, descripcion: '' }])
  }
  function borrarTitular(id: string) {
    editar('titulares', web.titulares.filter((t) => t.id !== id))
  }

  // ---- Cultos ----
  function editarCulto(id: string, cambios: Partial<CultoWeb>) {
    editar('cultos', web.cultos.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
  }
  function anadirCulto() {
    editar('cultos', [...web.cultos, { id: nuevoId(), titulo: 'Nuevo culto', detalle: '' }])
  }
  function borrarCulto(id: string) {
    editar('cultos', web.cultos.filter((c) => c.id !== id))
  }

  // ---- Galería ----
  function anadirFoto(dataUrl: string) {
    const foto: FotoGaleria = { id: nuevoId(), fotoDataUrl: dataUrl, pie: '' }
    editar('galeria', [...web.galeria, foto])
  }
  function editarFoto(id: string, pie: string) {
    editar('galeria', web.galeria.map((g) => (g.id === id ? { ...g, pie } : g)))
  }
  function borrarFoto(id: string) {
    editar('galeria', web.galeria.filter((g) => g.id !== id))
  }

  // ---- Redes ----
  function anadirRed() {
    const red: RedWeb = { id: nuevoId(), tipo: 'Instagram', url: '' }
    editar('redes', [...web.redes, red])
  }
  function editarRed(id: string, cambios: Partial<RedWeb>) {
    editar('redes', web.redes.map((r) => (r.id === id ? { ...r, ...cambios } : r)))
  }
  function borrarRed(id: string) {
    editar('redes', web.redes.filter((r) => r.id !== id))
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
            Personaliza tu web: plantilla, colores, tipografía, portada y secciones. Incluye un
            botón «Entrar» que lleva a tus hermanos al portal del hermano.
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
        <div className="settings-card__head"><h2 className="settings-card__title">Publicación</h2></div>
        <label className="checkbox">
          <input type="checkbox" checked={web.publicada} onChange={(e) => editar('publicada', e.target.checked)} />
          <span>{web.publicada ? 'Web publicada (visible para todos)' : 'Web oculta (solo tú la ves)'}</span>
        </label>
        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="slug">Enlace de tu web</label>
          <div className="assign-box__row">
            <span className="table-subtle">{window.location.origin}/w/</span>
            <input id="slug" type="text" value={web.slug} onChange={(e) => editar('slug', aSlug(e.target.value))} placeholder="mi-hermandad" />
            <button type="button" className="btn btn-outline btn-sm" onClick={copiarEnlace}>{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
          <p className="form-hint">Solo letras, números y guiones. Podrás usar un dominio propio más adelante.</p>
        </div>
      </section>

      {/* Plantilla */}
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Plantilla</h2></div>
        <div className="plantillas-grid">
          {PLANTILLAS.map((pl) => (
            <button type="button" key={pl.id} className={`plantilla-card${web.plantilla === pl.id ? ' plantilla-card--sel' : ''}`} onClick={() => editar('plantilla', pl.id as PlantillaWeb)}>
              <span className={`plantilla-card__mini plantilla-card__mini--${pl.id}`} aria-hidden="true"><span /><span /><span /></span>
              <b>{pl.nombre}</b>
              <small>{pl.descripcion}</small>
            </button>
          ))}
        </div>
      </section>

      {/* Diseño */}
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Diseño</h2></div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="color1">Color principal</label>
            <input id="color1" type="color" value={web.colorPrimario} onChange={(e) => editar('colorPrimario', e.target.value)} />
            <p className="form-hint">Por defecto, el de tu hermandad.</p>
          </div>
          <div className="form-row">
            <label htmlFor="color2">Color secundario (dorado, detalles)</label>
            <input id="color2" type="color" value={web.colorSecundario} onChange={(e) => editar('colorSecundario', e.target.value)} />
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="tema">Tema</label>
            <select id="tema" value={web.tema} onChange={(e) => editar('tema', e.target.value as TemaWeb)}>
              <option value="claro">Claro</option>
              <option value="oscuro">Oscuro</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="tipografia">Tipografía</label>
            <select id="tipografia" value={web.tipografia} onChange={(e) => editar('tipografia', e.target.value as TipografiaWeb)}>
              {TIPOGRAFIAS.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <label>Logo de la web</label>
          <div className="assign-box__row">
            {web.logoDataUrl && <img src={web.logoDataUrl} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />}
            <label className="btn btn-outline btn-sm">
              {web.logoDataUrl ? 'Cambiar logo' : 'Subir logo'}
              <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('logoDataUrl', d))} />
            </label>
            {web.logoDataUrl && <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('logoDataUrl', null)}>Quitar</button>}
          </div>
          <p className="form-hint">Si lo dejas vacío, se usa el escudo de la hermandad.</p>
        </div>
      </section>

      {/* Portada */}
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Portada</h2></div>
        <div className="form-row">
          <label>Foto de portada</label>
          <div className="assign-box__row">
            <label className="btn btn-outline btn-sm">
              {web.heroFotoDataUrl ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('heroFotoDataUrl', d))} />
            </label>
            {web.heroFotoDataUrl && <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('heroFotoDataUrl', null)}>Quitar foto</button>}
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="altura">Altura de la portada</label>
            <select id="altura" value={web.heroAltura} onChange={(e) => editar('heroAltura', e.target.value as AlturaHero)}>
              {ALTURAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="overlay">Oscurecido de la foto ({web.heroOverlay}%)</label>
            <input id="overlay" type="range" min={0} max={80} value={web.heroOverlay} onChange={(e) => editar('heroOverlay', Number(e.target.value))} />
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="textoBoton">Texto del botón de portada</label>
          <input id="textoBoton" type="text" value={web.heroTextoBoton} onChange={(e) => editar('heroTextoBoton', e.target.value)} placeholder="Portal del hermano" />
        </div>
      </section>

      {/* Secciones: orden y visibilidad */}
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Secciones</h2></div>
        <p className="form-hint">Marca cuáles enseñar y ordénalas. Se muestran en este orden en tu web.</p>
        <ul className="secciones-lista">
          {web.secciones.map((s, i) => (
            <li key={s.tipo} className="seccion-item">
              <label className="checkbox">
                <input type="checkbox" checked={s.visible} onChange={() => toggleSeccion(i)} />
                <span>{SECCIONES_INFO[s.tipo].nombre}</span>
              </label>
              <span className="seccion-item__orden">
                <button type="button" className="icon-btn" onClick={() => moverSeccion(i, -1)} disabled={i === 0} title="Subir">▲</button>
                <button type="button" className="icon-btn" onClick={() => moverSeccion(i, 1)} disabled={i === web.secciones.length - 1} title="Bajar">▼</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Contenido básico */}
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Textos</h2></div>
        <div className="form-row">
          <label htmlFor="titulo">Nombre de la hermandad</label>
          <input id="titulo" type="text" value={web.titulo} onChange={(e) => editar('titulo', e.target.value)} />
        </div>
        <div className="form-row">
          <label htmlFor="lema">Lema o subtítulo</label>
          <input id="lema" type="text" value={web.lema} onChange={(e) => editar('lema', e.target.value)} />
        </div>
        <div className="form-row">
          <label htmlFor="historia">Historia</label>
          <textarea id="historia" rows={5} value={web.historia} onChange={(e) => editar('historia', e.target.value)} />
        </div>
      </section>

      {/* Titulares */}
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Titulares</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={anadirTitular}>+ Añadir</button>
        </div>
        {web.titulares.map((t) => (
          <div className="assign-box" key={t.id}>
            <div className="assign-box__row">
              {t.fotoDataUrl && <img src={t.fotoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
              <label className="btn btn-outline btn-sm">
                {t.fotoDataUrl ? 'Cambiar foto' : 'Foto'}
                <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarTitular(t.id, { fotoDataUrl: d }))} />
              </label>
            </div>
            <div className="form-row">
              <input type="text" value={t.nombre} onChange={(e) => editarTitular(t.id, { nombre: e.target.value })} placeholder="Nombre del titular" />
            </div>
            <div className="assign-box__row">
              <input type="text" value={t.descripcion} onChange={(e) => editarTitular(t.id, { descripcion: e.target.value })} placeholder="Descripción breve" />
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => borrarTitular(t.id)}>Quitar</button>
            </div>
          </div>
        ))}
      </section>

      {/* Cultos */}
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Cultos y actos</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={anadirCulto}>+ Añadir</button>
        </div>
        {web.cultos.map((c) => (
          <div className="assign-box" key={c.id}>
            <div className="form-row"><input type="text" value={c.titulo} onChange={(e) => editarCulto(c.id, { titulo: e.target.value })} placeholder="Título" /></div>
            <div className="assign-box__row">
              <input type="text" value={c.detalle} onChange={(e) => editarCulto(c.id, { detalle: e.target.value })} placeholder="Detalle (fechas, lugar…)" />
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => borrarCulto(c.id)}>Quitar</button>
            </div>
          </div>
        ))}
      </section>

      {/* Galería */}
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Galería de fotos</h2>
          <label className="btn btn-outline btn-sm">
            + Añadir foto
            <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, anadirFoto)} />
          </label>
        </div>
        {web.galeria.length === 0 ? (
          <p className="form-hint">Aún no hay fotos. Sube las que quieras mostrar.</p>
        ) : (
          <div className="galeria-editor">
            {web.galeria.map((g) => (
              <div className="galeria-editor__item" key={g.id}>
                <img src={g.fotoDataUrl} alt="" />
                <input type="text" value={g.pie} onChange={(e) => editarFoto(g.id, e.target.value)} placeholder="Pie de foto" />
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => borrarFoto(g.id)}>Quitar</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Actualidad */}
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Actualidad</h2></div>
        <label className="checkbox">
          <input type="checkbox" checked={web.mostrarActualidad} onChange={(e) => editar('mostrarActualidad', e.target.checked)} />
          <span>Mostrar en la web los últimos comunicados publicados</span>
        </label>
        <p className="form-hint">Recuerda activar también la sección «Actualidad» arriba, en Secciones.</p>
      </section>

      {/* Contacto + redes */}
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Contacto y redes</h2></div>
        <p className="form-hint">Si dejas un campo vacío, se usan los datos de <Link to="/app/configuracion">Configuración</Link>.</p>
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
        <div className="form-row">
          <label htmlFor="mapa">Enlace de Google Maps (opcional)</label>
          <input id="mapa" type="text" value={web.mapaUrl} onChange={(e) => editar('mapaUrl', e.target.value)} placeholder="https://maps.google.com/…" />
        </div>

        <div className="settings-card__head" style={{ marginTop: '1rem' }}>
          <h3 className="settings-card__title" style={{ fontSize: '1rem' }}>Redes sociales</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={anadirRed}>+ Añadir red</button>
        </div>
        {web.redes.map((r) => (
          <div className="assign-box__row" key={r.id} style={{ marginTop: '0.5rem' }}>
            <select value={r.tipo} onChange={(e) => editarRed(r.id, { tipo: e.target.value as TipoRed })}>
              {REDES.map((red) => <option key={red} value={red}>{red}</option>)}
            </select>
            <input type="text" value={r.url} onChange={(e) => editarRed(r.id, { url: e.target.value })} placeholder="https://…" />
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => borrarRed(r.id)}>Quitar</button>
          </div>
        ))}
      </section>

      {/* Pie */}
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Pie de página</h2></div>
        <div className="form-row">
          <input type="text" value={web.textoPie} onChange={(e) => editar('textoPie', e.target.value)} placeholder={`© ${web.titulo || 'Tu hermandad'}`} />
        </div>
      </section>
    </div>
  )
}
