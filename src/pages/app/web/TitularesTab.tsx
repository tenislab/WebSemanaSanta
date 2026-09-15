/** Los titulares de la hermandad, con su ficha y sus fotos. */
import { EditorFotos, EditorParrafos } from '../../../components/EditorContenido'
import { useMoverConElFoco } from '../../../lib/foco'
import { type HermandadSettings } from '../../../lib/hermandadSettings'
import { nuevoId } from '../../../lib/supabaseSync'
import {
  aSlug,
  marcaDeAgua,
  slugTitular,
  titularConFicha,
  type Titular,
  type WebPublica,
} from '../../../lib/webPublica'
import { duplicarEn, leerImagen, leerImagenMediana, type EditarFn } from './comun'

export function TitularesTab({ web, editar, hermandad }: { web: WebPublica; editar: EditarFn; hermandad: HermandadSettings }) {
  const marca = marcaDeAgua(web, hermandad.nombreLegal ?? '')
  function editarTitular(id: string, c: Partial<Titular>) { editar('titulares', (xs) => xs.map((t) => (t.id === id ? { ...t, ...c } : t))) }
  const conFoco = useMoverConElFoco('titulares')
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.titulares.length) return
    const arr = [...web.titulares]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    editar('titulares', arr)
    conFoco.movida(web.titulares[i].id, dir)
  }
  // Dos titulares con el mismo nombre acaban con el mismo enlace, y entonces
  // uno de los dos no se puede abrir. Se avisa en vez de dejarlo pasar.
  const repetidos = new Set(
    web.titulares
      .map((t) => slugTitular(t))
      .filter((v, i, xs) => xs.indexOf(v) !== i),
  )

  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Titulares</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => editar('titulares', (xs) => [...xs, { id: nuevoId(), nombre: 'Nuevo titular', fotoDataUrl: null, descripcion: '', autoria: '', parrafos: [], slug: '', credito: '', alt: '', fotos: [] }])}>+ Añadir</button>
        </div>
        <p className="form-hint">
          Cada titular se publica a lo ancho, con su foto grande a un lado y su texto al otro. Si
          escribes su historia, se le abre una ficha propia con enlace para compartir.
        </p>
        {web.titulares.map((t, i) => {
          const enlace = `/w/${web.slug}/t/${slugTitular(t)}`
          const conFicha = titularConFicha(t)
          return (
            <div className="assign-box" key={t.id}>
              <div className="assign-box__row">
                {t.fotoDataUrl && <img src={t.fotoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
                <label className="btn btn-outline btn-sm">{t.fotoDataUrl ? 'Cambiar foto' : 'Foto'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarTitular(t.id, { fotoDataUrl: d }))} /></label>
                <button type="button" className="icon-btn" title="Subir" {...conFoco.boton(t.id, -1)} disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
                <button type="button" className="icon-btn" title="Bajar" {...conFoco.boton(t.id, 1)} disabled={i === web.titulares.length - 1} onClick={() => mover(i, 1)}>▼</button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => editar('titulares', (xs) => duplicarEn(xs, t.id, (x) => ({ ...x, id: nuevoId(), nombre: `${x.nombre} (copia)`, slug: '' })))}
                >
                  Duplicar
                </button>
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('titulares', (xs) => xs.filter((x) => x.id !== t.id))}>Quitar titular</button>
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label>Nombre</label>
                  <input type="text" value={t.nombre} onChange={(e) => editarTitular(t.id, { nombre: e.target.value })} placeholder="Ntro. Padre Jesús…" />
                </div>
                <div className="form-row">
                  <label>Autoría de la imagen</label>
                  <input type="text" value={t.autoria} onChange={(e) => editarTitular(t.id, { autoria: e.target.value })} placeholder="Juan de Mesa, 1620" />
                </div>
              </div>
              <div className="form-row">
                <label>Una línea de presentación</label>
                <input type="text" value={t.descripcion} onChange={(e) => editarTitular(t.id, { descripcion: e.target.value })} placeholder="Sagrada imagen del Señor." />
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label>Autor de la fotografía</label>
                  <input type="text" value={t.credito ?? ''} onChange={(e) => editarTitular(t.id, { credito: e.target.value })} placeholder="Foto: nombre del fotógrafo" />
                  <p className="form-hint">Se publica bajo la foto. Vacío = no se enseña.</p>
                </div>
                <div className="form-row">
                  <label>Qué se ve en la foto</label>
                  <input type="text" value={t.alt ?? ''} onChange={(e) => editarTitular(t.id, { alt: e.target.value })} placeholder={t.nombre || 'Descripción de la imagen'} />
                  <p className="form-hint">Para quien no puede verla. Vacío = se usa el nombre.</p>
                </div>
              </div>
              <div className="form-row">
                <label>Enlace de su ficha</label>
                <input
                  type="text"
                  value={t.slug ?? ''}
                  onChange={(e) => editarTitular(t.id, { slug: aSlug(e.target.value) })}
                  placeholder={aSlug(t.nombre)}
                />
                <p className={`form-hint${repetidos.has(slugTitular(t)) ? ' form-hint--error' : ''}`}>
                  {repetidos.has(slugTitular(t)) ? (
                    `Este enlace está repetido (${enlace}). Cámbialo, o uno de los dos titulares no se podrá abrir.`
                  ) : conFicha ? (
                    // `preview=1` porque la web puede estar todavía sin publicar.
                    <a href={`${enlace}?preview=1`} target="_blank" rel="noreferrer">{enlace} ↗</a>
                  ) : (
                    `${enlace} · la ficha solo se abre cuando escribas su historia o le subas más fotos.`
                  )}
                </p>
              </div>
              <EditorParrafos
                parrafos={t.parrafos}
                onChange={(parrafos) => editarTitular(t.id, { parrafos })}
                titulo="Su historia"
                ayuda="Hechura, restauraciones, la devoción que despierta… El arranque se asoma en la web y lo demás vive en su ficha."
              />
              <EditorFotos
                fotos={t.fotos ?? []}
                onChange={(fotos) => editar('titulares', (xs) => xs.map((x) => (x.id === t.id ? { ...x, fotos: typeof fotos === 'function' ? fotos(x.fotos ?? []) : fotos } : x)))}
                onSubir={leerImagenMediana}
                titulo="Más fotos para su ficha"
              />
            </div>
          )
        })}
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Derechos de las fotos</h2></div>
        <p className="form-hint">
          Vale para los titulares y para la galería. Las fotos de una hermandad acaban circulando,
          y esto deja dicho de quién son.
        </p>
        <div className="form-row">
          <label htmlFor="avisoFotos">Aviso bajo las fotos</label>
          <input
            id="avisoFotos"
            type="text"
            value={web.avisoFotos}
            onChange={(e) => editar('avisoFotos', e.target.value)}
            placeholder="Fotografías propiedad de la hermandad. Prohibida su reproducción sin permiso."
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={web.marcaAgua} onChange={(e) => editar('marcaAgua', e.target.checked)} />
          <span>Marca de agua con el nombre de la hermandad sobre cada foto</span>
        </label>
        {/* Sin nombre no hay marca que pintar, y desde el editor no se ve por
            qué: mejor decirlo que dejar el interruptor puesto sin efecto. */}
        {web.marcaAgua && (
          <p className={`form-hint${marca ? '' : ' form-hint--error'}`}>
            {marca
              ? `Se verá «${marca}» en la esquina de cada foto.`
              : 'Ponle un nombre a la web (en «Marca») o a la hermandad, o no habrá nada que escribir en la marca.'}
          </p>
        )}
      </section>
    </>
  )
}

/* ------------------------------ Portada ------------------------------ */
