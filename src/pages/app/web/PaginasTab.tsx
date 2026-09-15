/** Páginas libres: lo que no encaja en ninguna sección de fábrica. */
import { EditorFotos, EditorParrafos } from '../../../components/EditorContenido'
import { nuevoId } from '../../../lib/supabaseSync'
import { GUION_PAGINA_CARIDAD, type PaginaWeb, type WebPublica } from '../../../lib/webPublica'
import { duplicarEn, leerImagenMediana, type EditarFn } from './comun'

export function PaginasTab({ web, editar, paginaSel, setPaginaSel }: { web: WebPublica; editar: EditarFn; paginaSel: string | null; setPaginaSel: (id: string | null) => void }) {
  const sel = web.paginas.find((p) => p.id === (paginaSel ?? web.paginas[0]?.id)) ?? null
  function editarPagina(id: string, c: Partial<PaginaWeb>) { editar('paginas', (xs) => xs.map((p) => (p.id === id ? { ...p, ...c } : p))) }
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
    editar('paginas', (xs) => [...xs, p])
    setPaginaSel(p.id)
  }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Páginas y textos</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={nuevaPagina}>+ Nueva página</button>
        {/* La página que más se pide y la que peor se arranca. */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const id = nuevoId()
            editar('paginas', (xs) => [...xs, {
              ...GUION_PAGINA_CARIDAD,
              id,
              enMenu: true,
              parrafos: GUION_PAGINA_CARIDAD.parrafos.map((x) => ({ ...x, id: nuevoId() })),
            }])
            setPaginaSel(id)
          }}
        >
          + Bolsa de caridad (guion)
        </button>
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
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const copiaId = nuevoId()
                  editar('paginas', (xs) => duplicarEn(xs, sel.id, (x) => ({
                    ...x,
                    id: copiaId,
                    titulo: `${x.titulo} (copia)`,
                    parrafos: x.parrafos.map((pa) => ({ ...pa, id: nuevoId() })),
                  })))
                  setPaginaSel(copiaId)
                }}
              >
                Duplicar
              </button>
            </div>
          </div>

          {/* Mismos editores que la Historia y los titulares: un solo sitio que
              mantener y las mismas posibilidades (reordenar) en todas partes. */}
          <EditorParrafos
            parrafos={sel.parrafos}
            onChange={(parrafos) => editarPagina(sel.id, { parrafos })}
          />
          <EditorFotos
            fotos={sel.fotos}
            onChange={(fotos) => editar('paginas', (ps) => ps.map((p) => (
              p.id === sel.id ? { ...p, fotos: typeof fotos === 'function' ? fotos(p.fotos) : fotos } : p
            )))}
            onSubir={leerImagenMediana}
            titulo="Fotos de la página"
          />

          <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" style={{ marginTop: '0.6rem' }} onClick={() => {
            const conTexto = sel.parrafos.some((x) => x.texto.trim()) || sel.entradilla.trim() || sel.fotos.length > 0
            if (conTexto && !window.confirm(`«${sel.titulo || 'Esta página'}» tiene contenido escrito. ¿Seguro que quieres borrarla?`)) return
            editar('paginas', (xs) => xs.filter((p) => p.id !== sel.id))
            setPaginaSel(null)
          }}>Eliminar página</button>
        </div>
      )}
    </section>
  )
}

/* -------------------------------- Cartel -------------------------------- */
/**
 * EL CARTEL DEL AÑO.
 *
 * Es la pieza que más se comparte de una hermandad —se presenta en un acto, se
 * cuelga en el barrio y circula por los grupos de WhatsApp durante semanas— y
 * hasta ahora se subía como una foto más de la galería: perdida entre las
 * treinta de la salida, sin decir de quién era ni de qué año.
 *
 * Aquí lleva su ficha, y los de años anteriores no se borran: la colección de
 * carteles de una hermandad es media historia gráfica.
 */
