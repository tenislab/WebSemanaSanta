import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  PLANTILLAS,
  SECCIONES_INFO,
  TIPOGRAFIAS,
  aSlug,
  useWebPublica,
  type AlturaHero,
  type Boletin,
  type CultoWeb,
  type FotoGaleria,
  type Noticia,
  type PaginaWeb,
  type ParrafoPagina,
  type PlantillaWeb,
  type RedWeb,
  type TemaWeb,
  type TipoRed,
  type TipografiaWeb,
  type Titular,
  type WebPublica,
} from '../../lib/webPublica'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { useSuscripcion, tieneCapacidad } from '../../lib/suscripcion'
import { nuevoId } from '../../lib/supabaseSync'
import SitioContenido from '../../components/SitioContenido'

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

/** Fecha de hoy en ISO pero en hora LOCAL: con toISOString, de madrugada en
 *  España la noticia salía fechada el día anterior (UTC). */
function fechaHoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const REDES: TipoRed[] = ['Instagram', 'Facebook', 'X', 'YouTube', 'TikTok', 'Web']
const ALTURAS: { id: AlturaHero; label: string }[] = [
  { id: 'compacta', label: 'Compacta' },
  { id: 'media', label: 'Media' },
  { id: 'completa', label: 'Pantalla completa' },
]

type Pestana = 'diseno' | 'portada' | 'actualidad' | 'cultos' | 'paginas' | 'boletines' | 'contacto'
const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'diseno', label: 'Diseño y secciones' },
  { id: 'portada', label: 'Fotos de portada' },
  { id: 'actualidad', label: 'Actualidad' },
  { id: 'cultos', label: 'Cultos' },
  { id: 'paginas', label: 'Páginas y textos' },
  { id: 'boletines', label: 'Boletines' },
  { id: 'contacto', label: 'Contacto' },
]

export default function WebPublica() {
  const [web, setWeb] = useWebPublica()
  const hermandad = useHermandadSettings()
  const [pestana, setPestana] = useState<Pestana>('diseno')
  const [copiado, setCopiado] = useState(false)
  const [paginaSel, setPaginaSel] = useState<string | null>(null)

  useEffect(() => {
    const parche: Partial<WebPublica> = {}
    if (!web.titulo && hermandad.nombreLegal) parche.titulo = hermandad.nombreLegal
    if (web.colorPrimario === '#6A1A23' && hermandad.colorPrimario) parche.colorPrimario = hermandad.colorPrimario
    if (web.colorSecundario === '#C5A059' && hermandad.colorSecundario) parche.colorSecundario = hermandad.colorSecundario
    if (!web.slug && hermandad.nombreLegal) parche.slug = aSlug(hermandad.nombreLegal)
    if (Object.keys(parche).length) setWeb({ ...web, ...parche })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enlace = `${window.location.origin}/w/${web.slug}`

  function editar<K extends keyof WebPublica>(campo: K, valor: WebPublica[K]) {
    // Actualización funcional: al subir una imagen el cambio llega más tarde
    // (lectura + compresión) y con el objeto capturado se perdía lo editado
    // entretanto.
    setWeb((actual) => ({ ...actual, [campo]: valor }))
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
          <h1>Contenido web</h1>
          <p className="dash-head__lead">Personaliza tu web por secciones. A la derecha ves cómo va quedando.</p>
        </div>
        <div className="dash-head__actions">
          <button type="button" className="btn btn-outline" onClick={copiarEnlace}>
            {copiado ? '✓ Enlace copiado' : 'Copiar enlace'}
          </button>
          <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Ver mi web</a>
        </div>
      </div>

      {/* Pestañas */}
      <div className="cms-tabs">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" className={`cms-tab${pestana === p.id ? ' cms-tab--active' : ''}`} onClick={() => setPestana(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="cms-layout">
        <div className="cms-editor">
          {pestana === 'diseno' && (
            <DisenoTab web={web} hermandad={hermandad} editar={editar} copiado={copiado} copiarEnlace={copiarEnlace} />
          )}
          {pestana === 'portada' && <PortadaTab web={web} editar={editar} />}
          {pestana === 'actualidad' && <ActualidadTab web={web} editar={editar} />}
          {pestana === 'cultos' && <CultosTab web={web} editar={editar} />}
          {pestana === 'paginas' && <PaginasTab web={web} editar={editar} paginaSel={paginaSel} setPaginaSel={setPaginaSel} />}
          {pestana === 'boletines' && <BoletinesTab web={web} editar={editar} />}
          {pestana === 'contacto' && <ContactoTab web={web} hermandad={hermandad} editar={editar} />}
        </div>

        {/* Vista previa en vivo (render React real, sin iframe: sin parpadeo) */}
        <aside className="cms-preview">
          <div className="cms-preview__head">
            <span>Vista previa</span>
            <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Abrir</a>
          </div>
          <div className="cms-preview__frame">
            <div className="cms-preview__stage">
              <SitioContenido web={web} hermandad={hermandad} interactivo={false} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

type EditarFn = <K extends keyof WebPublica>(campo: K, valor: WebPublica[K]) => void

/* ------------------------------ Diseño ------------------------------ */
function DisenoTab({
  web, hermandad, editar, copiado, copiarEnlace,
}: {
  web: WebPublica
  hermandad: ReturnType<typeof useHermandadSettings>
  editar: EditarFn
  copiado: boolean
  copiarEnlace: () => void
}) {
  // El dominio propio es un extra del pack «Todo» (capacidad premium).
  const { suscripcion } = useSuscripcion()
  const conDominioPropio = tieneCapacidad(suscripcion, 'premium')

  function toggleSeccion(i: number) {
    editar('secciones', web.secciones.map((s, idx) => (idx === i ? { ...s, visible: !s.visible } : s)))
  }
  function moverSeccion(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.secciones.length) return
    const secciones = [...web.secciones]
    ;[secciones[i], secciones[j]] = [secciones[j], secciones[i]]
    editar('secciones', secciones)
  }
  return (
    <>
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
        </div>

        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="dominio">
            Dominio personalizado {!conDominioPropio && <span className="pill pill--info">Pack Todo</span>}
          </label>
          {!conDominioPropio && (
            <p className="form-hint">
              Tu web vive en el enlace de arriba. Para usar un dominio propio
              (hermandaddetriana.es) hace falta el pack <b>Todo</b>.
            </p>
          )}
          <input
            id="dominio"
            type="text"
            value={web.dominio ?? ''}
            disabled={!conDominioPropio}
            onChange={(e) => editar('dominio', e.target.value.trim().toLowerCase())}
            placeholder="hermandaddetriana.es"
          />
          <details className="form-hint" style={{ marginTop: '0.5rem' }}>
            <summary>Cómo poner tu dominio propio (p. ej. hermandaddetriana.es)</summary>
            <ol style={{ margin: '0.5rem 0 0 1rem', lineHeight: 1.7 }}>
              <li>Compra el dominio en un registrador (IONOS, GoDaddy, Namecheap…).</li>
              <li>Escríbelo aquí arriba y guarda.</li>
              <li>En el panel de despliegue (Vercel) → <b>Domains</b> → añade tu dominio.</li>
              <li>En tu registrador, apunta los DNS a Vercel (un registro <code>A</code> a la IP que te indica, o un <code>CNAME</code>).</li>
              <li>En unos minutos tu web se verá en <b>tu dominio</b> en vez de en el enlace largo.</li>
            </ol>
            <p style={{ marginTop: '0.4rem' }}>
              El enlace real al dominio se activa al conectar la base de datos y el despliegue; por
              ahora este campo lo guarda para tenerlo listo.
            </p>
          </details>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Plantilla</h2></div>
        <div className="plantillas-grid">
          {PLANTILLAS.map((pl) => (
            <button type="button" key={pl.id} className={`plantilla-card${web.plantilla === pl.id ? ' plantilla-card--sel' : ''}`} onClick={() => editar('plantilla', pl.id as PlantillaWeb)}>
              <span className={`plantilla-card__mini plantilla-card__mini--${pl.id}`} aria-hidden="true"><span /><span /><span /></span>
              <b>{pl.nombre}</b><small>{pl.descripcion}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Colores y tipografía</h2></div>
        <div className="form-grid-2">
          <div className="form-row"><label>Color principal</label><input type="color" value={web.colorPrimario} onChange={(e) => editar('colorPrimario', e.target.value)} /></div>
          <div className="form-row"><label>Color secundario</label><input type="color" value={web.colorSecundario} onChange={(e) => editar('colorSecundario', e.target.value)} /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label>Tema</label>
            <select value={web.tema} onChange={(e) => editar('tema', e.target.value as TemaWeb)}><option value="claro">Claro</option><option value="oscuro">Oscuro</option></select>
          </div>
          <div className="form-row">
            <label>Tipografía</label>
            <select value={web.tipografia} onChange={(e) => editar('tipografia', e.target.value as TipografiaWeb)}>
              {TIPOGRAFIAS.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <label>Logo de la web</label>
          <div className="assign-box__row">
            {web.logoDataUrl && <img src={web.logoDataUrl} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />}
            <label className="btn btn-outline btn-sm">{web.logoDataUrl ? 'Cambiar' : 'Subir logo'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('logoDataUrl', d))} /></label>
            {web.logoDataUrl && <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('logoDataUrl', null)}>Quitar</button>}
          </div>
        </div>
        <div className="form-row"><label htmlFor="titulo">Nombre</label><input id="titulo" type="text" value={web.titulo} onChange={(e) => editar('titulo', e.target.value)} /></div>
        <div className="form-row"><label htmlFor="lema">Lema</label><input id="lema" type="text" value={web.lema} onChange={(e) => editar('lema', e.target.value)} /></div>
        <div className="form-row"><label htmlFor="historia">Historia</label><textarea id="historia" rows={4} value={web.historia} onChange={(e) => editar('historia', e.target.value)} /></div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Secciones (orden y visibilidad)</h2></div>
        <ul className="secciones-lista">
          {web.secciones.map((s, i) => (
            <li key={s.tipo} className="seccion-item">
              <label className="checkbox"><input type="checkbox" checked={s.visible} onChange={() => toggleSeccion(i)} /><span>{SECCIONES_INFO[s.tipo].nombre}</span></label>
              <span className="seccion-item__orden">
                <button type="button" className="icon-btn" onClick={() => moverSeccion(i, -1)} disabled={i === 0}>▲</button>
                <button type="button" className="icon-btn" onClick={() => moverSeccion(i, 1)} disabled={i === web.secciones.length - 1}>▼</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <TitularesGaleria web={web} editar={editar} hermandad={hermandad} />
    </>
  )
}

/* --------------------- Titulares y galería (en Diseño) --------------------- */
function TitularesGaleria({ web, editar }: { web: WebPublica; editar: EditarFn; hermandad: ReturnType<typeof useHermandadSettings> }) {
  function editarTitular(id: string, c: Partial<Titular>) { editar('titulares', web.titulares.map((t) => (t.id === id ? { ...t, ...c } : t))) }
  function anadirFoto(dataUrl: string) { editar('galeria', [...web.galeria, { id: nuevoId(), fotoDataUrl: dataUrl, pie: '' } as FotoGaleria]) }
  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Titulares</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => editar('titulares', [...web.titulares, { id: nuevoId(), nombre: 'Nuevo titular', fotoDataUrl: null, descripcion: '' }])}>+ Añadir</button>
        </div>
        {web.titulares.map((t) => (
          <div className="assign-box" key={t.id}>
            <div className="assign-box__row">
              {t.fotoDataUrl && <img src={t.fotoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
              <label className="btn btn-outline btn-sm">{t.fotoDataUrl ? 'Cambiar foto' : 'Foto'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarTitular(t.id, { fotoDataUrl: d }))} /></label>
            </div>
            <div className="form-row"><input type="text" value={t.nombre} onChange={(e) => editarTitular(t.id, { nombre: e.target.value })} placeholder="Nombre" /></div>
            <div className="assign-box__row">
              <input type="text" value={t.descripcion} onChange={(e) => editarTitular(t.id, { descripcion: e.target.value })} placeholder="Descripción" />
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('titulares', web.titulares.filter((x) => x.id !== t.id))}>Quitar</button>
            </div>
          </div>
        ))}
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Galería de fotos</h2>
          <label className="btn btn-outline btn-sm">+ Añadir foto<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, anadirFoto)} /></label>
        </div>
        {web.galeria.length === 0 ? <p className="form-hint">Aún no hay fotos.</p> : (
          <div className="galeria-editor">
            {web.galeria.map((g) => (
              <div className="galeria-editor__item" key={g.id}>
                <img src={g.fotoDataUrl} alt="" />
                <input type="text" value={g.pie} onChange={(e) => editar('galeria', web.galeria.map((x) => (x.id === g.id ? { ...x, pie: e.target.value } : x)))} placeholder="Pie" />
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('galeria', web.galeria.filter((x) => x.id !== g.id))}>Quitar</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

/* ------------------------------ Portada ------------------------------ */
function PortadaTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Fotos de portada</h2>
        <label className="btn btn-primary btn-sm">+ Añadir foto<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('heroFotos', [...web.heroFotos, d]))} /></label>
      </div>
      <p className="form-hint">Se alternan de fondo en la cabecera. Cámbialas o elimínalas.</p>
      {web.heroFotos.length === 0 ? <p className="form-hint">Sin fotos aún. Sube al menos una para la portada.</p> : (
        <div className="galeria-editor">
          {web.heroFotos.map((f, i) => (
            <div className="galeria-editor__item" key={i}>
              <img src={f} alt="" />
              <div className="assign-box__row">
                <label className="btn btn-outline btn-sm">Cambiar<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('heroFotos', web.heroFotos.map((x, j) => (j === i ? d : x))))} /></label>
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('heroFotos', web.heroFotos.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="form-grid-2" style={{ marginTop: '1rem' }}>
        <div className="form-row">
          <label>Altura de la portada</label>
          <select value={web.heroAltura} onChange={(e) => editar('heroAltura', e.target.value as AlturaHero)}>{ALTURAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
        </div>
        <div className="form-row">
          <label>Oscurecido ({web.heroOverlay}%)</label>
          <input type="range" min={0} max={80} value={web.heroOverlay} onChange={(e) => editar('heroOverlay', Number(e.target.value))} />
        </div>
      </div>
      <div className="form-row"><label>Texto del botón de portada</label><input type="text" value={web.heroTextoBoton} onChange={(e) => editar('heroTextoBoton', e.target.value)} placeholder="Portal del hermano" /></div>
    </section>
  )
}

/* ------------------------------ Actualidad ------------------------------ */
function ActualidadTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function editarNoticia(id: string, c: Partial<Noticia>) { editar('noticias', web.noticias.map((n) => (n.id === id ? { ...n, ...c } : n))) }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Noticias publicadas en la web</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('noticias', [{ id: nuevoId(), titulo: 'Nueva noticia', fecha: fechaHoyLocal(), resumen: '', fotoDataUrl: null, publicada: true }, ...web.noticias])}>+ Nueva noticia</button>
      </div>
      {web.noticias.length === 0 && <p className="form-hint">Aún no hay noticias.</p>}
      {web.noticias.map((n) => (
        <div className="assign-box" key={n.id}>
          <div className="assign-box__row">
            {n.fotoDataUrl && <img src={n.fotoDataUrl} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />}
            <label className="btn btn-outline btn-sm">{n.fotoDataUrl ? 'Cambiar foto' : 'Foto'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarNoticia(n.id, { fotoDataUrl: d }))} /></label>
            <label className="checkbox"><input type="checkbox" checked={n.publicada} onChange={(e) => editarNoticia(n.id, { publicada: e.target.checked })} /><span>{n.publicada ? 'Publicada' : 'Oculta'}</span></label>
          </div>
          <div className="form-grid-2">
            <div className="form-row"><label>Título</label><input type="text" value={n.titulo} onChange={(e) => editarNoticia(n.id, { titulo: e.target.value })} /></div>
            <div className="form-row"><label>Fecha</label><input type="date" value={n.fecha} onChange={(e) => editarNoticia(n.id, { fecha: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Resumen</label><textarea rows={2} value={n.resumen} onChange={(e) => editarNoticia(n.id, { resumen: e.target.value })} /></div>
          <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('noticias', web.noticias.filter((x) => x.id !== n.id))}>Eliminar noticia</button>
        </div>
      ))}
    </section>
  )
}

/* ------------------------------ Cultos ------------------------------ */
function CultosTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function editarCulto(id: string, c: Partial<CultoWeb>) { editar('cultos', web.cultos.map((x) => (x.id === id ? { ...x, ...c } : x))) }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Cultos y actos</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('cultos', [...web.cultos, { id: nuevoId(), titulo: 'Nuevo culto', detalle: '' }])}>+ Añadir culto</button>
      </div>
      {web.cultos.map((c) => (
        <div className="assign-box" key={c.id}>
          <div className="form-row"><input type="text" value={c.titulo} onChange={(e) => editarCulto(c.id, { titulo: e.target.value })} placeholder="Título" /></div>
          <div className="assign-box__row">
            <input type="text" value={c.detalle} onChange={(e) => editarCulto(c.id, { detalle: e.target.value })} placeholder="Detalle (fecha, hora, lugar…)" />
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('cultos', web.cultos.filter((x) => x.id !== c.id))}>Quitar</button>
          </div>
        </div>
      ))}
    </section>
  )
}

/* --------------------------- Páginas y textos --------------------------- */
function PaginasTab({ web, editar, paginaSel, setPaginaSel }: { web: WebPublica; editar: EditarFn; paginaSel: string | null; setPaginaSel: (id: string | null) => void }) {
  const sel = web.paginas.find((p) => p.id === (paginaSel ?? web.paginas[0]?.id)) ?? null
  function editarPagina(id: string, c: Partial<PaginaWeb>) { editar('paginas', web.paginas.map((p) => (p.id === id ? { ...p, ...c } : p))) }
  function moverPagina(id: string, dir: -1 | 1) {
    const i = web.paginas.findIndex((p) => p.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= web.paginas.length) return
    const arr = [...web.paginas]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    editar('paginas', arr)
  }
  function nuevaPagina() {
    const p: PaginaWeb = { id: nuevoId(), icono: '📄', antetitulo: '', titulo: 'Nueva página', entradilla: '', parrafos: [], fotos: [], enMenu: true }
    editar('paginas', [...web.paginas, p])
    setPaginaSel(p.id)
  }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Páginas y textos</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={nuevaPagina}>+ Nueva página</button>
      </div>
      <div className="cms-chips">
        {web.paginas.map((p) => (
          <button key={p.id} type="button" className={`chip${sel?.id === p.id ? ' chip--active' : ''}`} onClick={() => setPaginaSel(p.id)}>{p.icono} {p.titulo}</button>
        ))}
      </div>
      {sel && (
        <div className="assign-box" style={{ marginTop: '1rem' }}>
          <div className="form-grid-2">
            <div className="form-row"><label>Icono</label><input type="text" value={sel.icono} onChange={(e) => editarPagina(sel.id, { icono: e.target.value })} placeholder="✝️" /></div>
            <div className="form-row"><label>Antetítulo</label><input type="text" value={sel.antetitulo} onChange={(e) => editarPagina(sel.id, { antetitulo: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Título de la página</label><input type="text" value={sel.titulo} onChange={(e) => editarPagina(sel.id, { titulo: e.target.value })} /></div>
          <div className="form-row"><label>Entradilla</label><textarea rows={2} value={sel.entradilla} onChange={(e) => editarPagina(sel.id, { entradilla: e.target.value })} /></div>

          <div className="assign-box__row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="checkbox">
              <input type="checkbox" checked={sel.enMenu !== false} onChange={(e) => editarPagina(sel.id, { enMenu: e.target.checked })} />
              <span>Mostrar esta página en la web (y en su menú)</span>
            </label>
            <div className="assign-box__row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moverPagina(sel.id, -1)}>▲ Subir</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moverPagina(sel.id, 1)}>▼ Bajar</button>
            </div>
          </div>

          <div className="settings-card__head" style={{ marginTop: '0.5rem' }}>
            <h3 className="settings-card__title" style={{ fontSize: '1rem' }}>Párrafos</h3>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => editarPagina(sel.id, { parrafos: [...sel.parrafos, { id: nuevoId(), subtitulo: '', texto: '' } as ParrafoPagina] })}>+ Añadir párrafo</button>
          </div>
          {sel.parrafos.map((par) => (
            <div className="assign-box" key={par.id}>
              <div className="form-row"><input type="text" value={par.subtitulo} onChange={(e) => editarPagina(sel.id, { parrafos: sel.parrafos.map((x) => (x.id === par.id ? { ...x, subtitulo: e.target.value } : x)) })} placeholder="Subtítulo (opcional)" /></div>
              <div className="assign-box__row">
                <textarea rows={2} value={par.texto} onChange={(e) => editarPagina(sel.id, { parrafos: sel.parrafos.map((x) => (x.id === par.id ? { ...x, texto: e.target.value } : x)) })} placeholder="Texto del párrafo" />
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editarPagina(sel.id, { parrafos: sel.parrafos.filter((x) => x.id !== par.id) })}>Quitar</button>
              </div>
            </div>
          ))}

          <div className="settings-card__head" style={{ marginTop: '0.5rem' }}>
            <h3 className="settings-card__title" style={{ fontSize: '1rem' }}>Fotos de la página</h3>
            <label className="btn btn-outline btn-sm">+ Añadir foto<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarPagina(sel.id, { fotos: [...sel.fotos, d] }))} /></label>
          </div>
          {sel.fotos.length > 0 && (
            <div className="galeria-editor">
              {sel.fotos.map((f, i) => (
                <div className="galeria-editor__item" key={i}>
                  <img src={f} alt="" />
                  <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editarPagina(sel.id, { fotos: sel.fotos.filter((_, j) => j !== i) })}>Quitar</button>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" style={{ marginTop: '0.6rem' }} onClick={() => { editar('paginas', web.paginas.filter((p) => p.id !== sel.id)); setPaginaSel(null) }}>Eliminar página</button>
        </div>
      )}
    </section>
  )
}

/* ------------------------------ Boletines ------------------------------ */
function BoletinesTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function editarBoletin(id: string, c: Partial<Boletin>) { editar('boletines', web.boletines.map((b) => (b.id === id ? { ...b, ...c } : b))) }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Boletines (PDF)</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('boletines', [{ id: nuevoId(), titulo: 'Nuevo boletín', subtitulo: '', pdfNombre: null }, ...web.boletines])}>+ Subir boletín</button>
      </div>
      {web.boletines.length === 0 && <p className="form-hint">Aún no hay boletines.</p>}
      {web.boletines.map((b) => (
        <div className="assign-box" key={b.id}>
          <div className="form-row"><input type="text" value={b.titulo} onChange={(e) => editarBoletin(b.id, { titulo: e.target.value })} placeholder="Título" /></div>
          <div className="assign-box__row">
            <input type="text" value={b.subtitulo} onChange={(e) => editarBoletin(b.id, { subtitulo: e.target.value })} placeholder="Subtítulo (Cuaresma, nº páginas…)" />
            <span className="table-subtle">{b.pdfNombre ?? 'Sin PDF'}</span>
            <label className="btn btn-outline btn-sm">Subir PDF<input type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) editarBoletin(b.id, { pdfNombre: f.name }); e.target.value = '' }} /></label>
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('boletines', web.boletines.filter((x) => x.id !== b.id))}>Quitar</button>
          </div>
        </div>
      ))}
      <p className="form-hint">Por ahora se guarda el nombre del PDF; el archivo se subirá cuando conectemos el almacenamiento (Supabase).</p>
    </section>
  )
}

/* ------------------------------ Contacto ------------------------------ */
function ContactoTab({ web, hermandad, editar }: { web: WebPublica; hermandad: ReturnType<typeof useHermandadSettings>; editar: EditarFn }) {
  function editarRed(id: string, c: Partial<RedWeb>) { editar('redes', web.redes.map((r) => (r.id === id ? { ...r, ...c } : r))) }
  return (
    <section className="settings-card">
      <div className="settings-card__head"><h2 className="settings-card__title">Contacto y redes</h2></div>
      <p className="form-hint">Si dejas un campo vacío, se usan los datos de <Link to="/app/configuracion">Configuración</Link>.</p>
      <div className="form-row"><label>Dirección</label><input type="text" value={web.direccion} onChange={(e) => editar('direccion', e.target.value)} placeholder={hermandad.direccion} /></div>
      <div className="form-grid-2">
        <div className="form-row"><label>Teléfono</label><input type="text" value={web.telefono} onChange={(e) => editar('telefono', e.target.value)} placeholder={hermandad.telefono} /></div>
        <div className="form-row"><label>Correo</label><input type="email" value={web.email} onChange={(e) => editar('email', e.target.value)} placeholder={hermandad.email} /></div>
      </div>
      <div className="form-row"><label>Enlace de Google Maps</label><input type="text" value={web.mapaUrl} onChange={(e) => editar('mapaUrl', e.target.value)} placeholder="https://maps.google.com/…" /></div>
      <div className="settings-card__head" style={{ marginTop: '1rem' }}>
        <h3 className="settings-card__title" style={{ fontSize: '1rem' }}>Redes sociales</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => editar('redes', [...web.redes, { id: nuevoId(), tipo: 'Instagram', url: '' }])}>+ Añadir red</button>
      </div>
      {web.redes.map((r) => (
        <div className="assign-box__row" key={r.id} style={{ marginTop: '0.5rem' }}>
          <select value={r.tipo} onChange={(e) => editarRed(r.id, { tipo: e.target.value as TipoRed })}>{REDES.map((red) => <option key={red} value={red}>{red}</option>)}</select>
          <input type="text" value={r.url} onChange={(e) => editarRed(r.id, { url: e.target.value })} placeholder="https://…" />
          <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('redes', web.redes.filter((x) => x.id !== r.id))}>Quitar</button>
        </div>
      ))}
      <div className="form-row" style={{ marginTop: '1rem' }}><label>Pie de página</label><input type="text" value={web.textoPie} onChange={(e) => editar('textoPie', e.target.value)} placeholder={`© ${web.titulo || 'Tu hermandad'}`} /></div>
    </section>
  )
}
