/** Los cultos de la web, a mano o traídos del calendario de Eventos. */
import { nuevoId } from '../../../lib/supabaseSync'
import { type CultoWeb, type WebPublica } from '../../../lib/webPublica'
import { Link } from 'react-router-dom'
import { duplicarEn, leerImagen, type EditarFn } from './comun'

export function CultosTab({ web, editar, delCalendario }: { web: WebPublica; editar: EditarFn; delCalendario: CultoWeb[] }) {
  function editarCulto(id: string, c: Partial<CultoWeb>) { editar('cultos', (xs) => xs.map((x) => (x.id === id ? { ...x, ...c } : x))) }
  // Copiar a mano un culto que ya está en el calendario lo publica dos veces.
  const enCalendario = new Set(delCalendario.map((c) => c.titulo.trim().toLowerCase()))
  const repetidos = web.cultosDelCalendario
    ? web.cultos.map((c) => c.titulo.trim()).filter((t) => t && enCalendario.has(t.toLowerCase()))
    : []
  return (
    <>
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Del calendario</h2>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={web.cultosDelCalendario}
          onChange={(e) => editar('cultosDelCalendario', e.target.checked)}
        />
        <span>Publicar solos los próximos actos de <Link to="/app/eventos">Eventos y tareas</Link></span>
      </label>
      <p className="form-hint">
        Así se apunta un culto UNA vez y sale en los dos sitios. Salen los cultos, salidas,
        convivencias y actos de caridad que estén por venir; los cabildos y la formación interna
        no se publican.
      </p>
      {web.cultosDelCalendario && (
        delCalendario.length > 0 ? (
          <ul className="secciones-lista" style={{ marginTop: '0.6rem' }}>
            {delCalendario.map((c) => (
              <li className="seccion-item" key={c.id}>
                <span>{c.titulo}</span>
                <span className="table-subtle">{[c.fecha, c.lugar].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="form-hint form-hint--alerta">
            No hay ningún acto próximo en el calendario, así que ahora mismo no añade nada.
          </p>
        )
      )}
    </section>

    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Escritos a mano</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('cultos', (xs) => [...xs, { id: nuevoId(), titulo: 'Nuevo culto', detalle: '', fecha: '', lugar: '', fotoDataUrl: null }])}>+ Añadir culto</button>
      </div>
      {web.cultos.map((c) => (
        <div className="assign-box" key={c.id}>
          <div className="assign-box__row">
            {c.fotoDataUrl && <img src={c.fotoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
            <label className="btn btn-outline btn-sm">
              {c.fotoDataUrl ? 'Cambiar foto' : 'Foto (opcional)'}
              <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarCulto(c.id, { fotoDataUrl: d }))} />
            </label>
            {c.fotoDataUrl && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => editarCulto(c.id, { fotoDataUrl: null })}>Quitar foto</button>
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => editar('cultos', (xs) => duplicarEn(xs, c.id, (x) => ({ ...x, id: nuevoId(), titulo: `${x.titulo} (copia)` })))}
            >
              Duplicar
            </button>
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('cultos', (xs) => xs.filter((x) => x.id !== c.id))}>Quitar culto</button>
          </div>
          <div className="form-row">
            <label>Título</label>
            <input type="text" value={c.titulo} onChange={(e) => editarCulto(c.id, { titulo: e.target.value })} placeholder="Quinario, Función Principal, Besamanos…" />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label>Cuándo</label>
              <input type="text" value={c.fecha} onChange={(e) => editarCulto(c.id, { fecha: e.target.value })} placeholder="Del 3 al 7 de marzo, 20:30" />
            </div>
            <div className="form-row">
              <label>Dónde</label>
              <input type="text" value={c.lugar} onChange={(e) => editarCulto(c.id, { lugar: e.target.value })} placeholder="Sede canónica" />
            </div>
          </div>
          <div className="form-row">
            <label>Detalle</label>
            <textarea rows={2} value={c.detalle} onChange={(e) => editarCulto(c.id, { detalle: e.target.value })} placeholder="Quién predica, intenciones, avisos…" />
          </div>
        </div>
      ))}
      {repetidos.length > 0 && (
        <p className="form-hint form-hint--alerta">
          {repetidos.length === 1 ? 'Este culto ya está' : 'Estos cultos ya están'} en el calendario y
          saldrá{repetidos.length === 1 ? '' : 'n'} dos veces en la web: {repetidos.join(', ')}.
        </p>
      )}
      {web.cultos.length === 0 && (
        <p className="form-hint">
          Ninguno escrito a mano. Sirven para lo que no está en el calendario: el quinario de todos
          los años, un besamanos con su texto largo…
        </p>
      )}
    </section>
    </>
  )
}

/* --------------------------- Páginas y textos --------------------------- */
