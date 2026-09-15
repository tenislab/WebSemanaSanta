/** Noticias publicadas en la web. */
import { EditorParrafos } from '../../../components/EditorContenido'
import { nuevoId } from '../../../lib/supabaseSync'
import { slugNoticia, type Noticia, type WebPublica } from '../../../lib/webPublica'
import { duplicarEn, fechaHoyLocal, leerImagen, type EditarFn } from './comun'

export function ActualidadTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function editarNoticia(id: string, c: Partial<Noticia>) { editar('noticias', (xs) => xs.map((n) => (n.id === id ? { ...n, ...c } : n))) }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Noticias publicadas en la web</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('noticias', (xs) => [{ id: nuevoId(), titulo: 'Nueva noticia', fecha: fechaHoyLocal(), resumen: '', fotoDataUrl: null, publicada: true, parrafos: [], destacada: false }, ...xs])}>+ Nueva noticia</button>
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
          {n.fotoDataUrl && (
            <div className="form-row">
              <label>Qué se ve en la foto</label>
              <input
                type="text"
                value={n.altFoto ?? ''}
                onChange={(e) => editarNoticia(n.id, { altFoto: e.target.value })}
                placeholder="El paso de palio saliendo de la parroquia"
              />
              <p className="form-hint">Para quien no puede verla. Déjalo vacío solo si la foto es de adorno.</p>
            </div>
          )}
          <div className="form-row">
            <label>Entradilla</label>
            <textarea rows={2} value={n.resumen} onChange={(e) => editarNoticia(n.id, { resumen: e.target.value })} />
            {/* En la web sale entera, pero por encima de tres líneas la tarjeta
                se descuadra respecto a las demás. */}
            <p className={`form-hint${n.resumen.length > 220 ? ' form-hint--alerta' : ''}`}>
              {n.resumen.length} caracteres{n.resumen.length > 220 && ' — queda muy largo para la tarjeta de la web'}
            </p>
          </div>

          {/* El cuerpo es opcional: sin él, la noticia sigue siendo un titular
              con su entradilla, como hasta ahora. Con él, gana página propia. */}
          <details className="afinar afinar--suelto">
            <summary className="afinar__cabeza">
              <span className="afinar__titulo">Cuerpo de la noticia</span>
              <span className="afinar__nota">
                {(n.parrafos ?? []).some((p) => p.texto.trim())
                  ? `${(n.parrafos ?? []).length} ${(n.parrafos ?? []).length === 1 ? 'párrafo' : 'párrafos'} · tiene página propia`
                  : 'Opcional — al escribirlo, la noticia gana su propio enlace'}
              </span>
            </summary>
            <div className="afinar__cuerpo">
              <EditorParrafos
                parrafos={n.parrafos ?? []}
                onChange={(parrafos) => editarNoticia(n.id, { parrafos })}
                ayuda="Con cuerpo, la noticia tiene su propia página y se puede compartir sola."
              />
              <p className="form-hint">
                Enlace propio: <code>/w/{web.slug}/n/{slugNoticia(n)}</code>
              </p>
            </div>
          </details>

          <div className="assign-box__row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={Boolean(n.destacada)}
                onChange={(e) => {
                  // Solo una destacada: marcar una desmarca la que hubiera.
                  const marcar = e.target.checked
                  editar('noticias', (xs) => xs.map((x) => ({ ...x, destacada: marcar && x.id === n.id })))
                }}
              />
              <span>Destacada (sale la primera y a lo grande)</span>
            </label>
            {/* La copia sale sin publicar y con enlace nuevo: dos noticias con
                el mismo enlace y una de las dos no se puede abrir. */}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => editar('noticias', (xs) => duplicarEn(xs, n.id, (x) => ({ ...x, id: nuevoId(), titulo: `${x.titulo} (copia)`, slug: '', publicada: false })))}
            >
              Duplicar
            </button>
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('noticias', (xs) => xs.filter((x) => x.id !== n.id))}>Eliminar noticia</button>
          </div>
        </div>
      ))}
    </section>
  )
}

/* ------------------------------ Cultos ------------------------------ */
