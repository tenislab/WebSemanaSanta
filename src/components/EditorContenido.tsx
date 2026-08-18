import type { ChangeEvent } from 'react'
import { nuevoId } from '../lib/supabaseSync'
import type { ParrafoPagina } from '../lib/webPublica'

/**
 * Editor de párrafos con subtítulo, con opción de reordenarlos. Lo comparten la
 * Historia, las páginas y la ficha de cada titular, para que en la web no haya
 * secciones que sean un pegote de texto plano.
 */
export function EditorParrafos({
  parrafos,
  onChange,
  titulo = 'Párrafos',
  ayuda,
}: {
  parrafos: ParrafoPagina[]
  onChange: (siguiente: ParrafoPagina[]) => void
  titulo?: string
  ayuda?: string
}) {
  function editarUno(id: string, cambios: Partial<ParrafoPagina>) {
    onChange(parrafos.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
  }
  function mover(id: string, dir: -1 | 1) {
    const i = parrafos.findIndex((p) => p.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= parrafos.length) return
    const arr = [...parrafos]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    onChange(arr)
  }

  return (
    <>
      <div className="settings-card__head" style={{ marginTop: '0.5rem' }}>
        <h3 className="settings-card__title" style={{ fontSize: '1rem' }}>{titulo}</h3>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onChange([...parrafos, { id: nuevoId(), subtitulo: '', texto: '' }])}
        >
          + Añadir párrafo
        </button>
      </div>
      {ayuda && <p className="form-hint">{ayuda}</p>}
      {parrafos.length === 0 && (
        <p className="form-hint">
          Todavía no hay texto. Añade un párrafo: el subtítulo es opcional, y sirve para separar los
          apartados de la sección.
        </p>
      )}
      {parrafos.map((par, i) => (
        <div className="assign-box editor-parrafo" key={par.id}>
          <div className="editor-parrafo__head">
            <span className="editor-parrafo__n">{i + 1}</span>
            <input
              type="text"
              value={par.subtitulo}
              onChange={(e) => editarUno(par.id, { subtitulo: e.target.value })}
              placeholder="Subtítulo (opcional)"
            />
            <div className="editor-parrafo__acciones">
              <button
                type="button"
                className="icon-btn"
                title="Subir"
                disabled={i === 0}
                onClick={() => mover(par.id, -1)}
              >
                ▲
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Bajar"
                disabled={i === parrafos.length - 1}
                onClick={() => mover(par.id, 1)}
              >
                ▼
              </button>
              <button
                type="button"
                className="icon-btn rgpd-borrar"
                title="Quitar párrafo"
                onClick={() => onChange(parrafos.filter((x) => x.id !== par.id))}
              >
                ✕
              </button>
            </div>
          </div>
          <textarea
            rows={3}
            value={par.texto}
            onChange={(e) => editarUno(par.id, { texto: e.target.value })}
            placeholder="Texto del párrafo"
          />
        </div>
      ))}
    </>
  )
}

/**
 * Fotos de una sección: subir, reordenar y quitar. Recibe ya la función de
 * lectura del archivo porque la compresión vive en la página del CMS.
 */
export function EditorFotos({
  fotos,
  onChange,
  onSubir,
  titulo = 'Fotos',
}: {
  fotos: string[]
  /**
   * Acepta también una función de la lista actual: al subir una foto, el
   * archivo se lee y se comprime en segundo plano, y con la lista capturada en
   * el render se perdía lo editado entretanto.
   */
  onChange: (siguiente: string[] | ((actual: string[]) => string[])) => void
  /** Lee el archivo elegido y devuelve la imagen ya comprimida. */
  onSubir: (e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void) => void
  titulo?: string
}) {
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= fotos.length) return
    const arr = [...fotos]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    onChange(arr)
  }

  return (
    <>
      <div className="settings-card__head" style={{ marginTop: '0.5rem' }}>
        <h3 className="settings-card__title" style={{ fontSize: '1rem' }}>{titulo}</h3>
        <label className="btn btn-outline btn-sm">
          + Añadir foto
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onSubir(e, (d) => onChange((actuales) => [...actuales, d]))}
          />
        </label>
      </div>
      {fotos.length > 0 && (
        <div className="galeria-editor">
          {fotos.map((f, i) => (
            <div className="galeria-editor__item" key={i}>
              <img src={f} alt="" />
              <div className="galeria-editor__acciones">
                <button type="button" className="icon-btn" title="Antes" disabled={i === 0} onClick={() => mover(i, -1)}>◀</button>
                <button type="button" className="icon-btn" title="Después" disabled={i === fotos.length - 1} onClick={() => mover(i, 1)}>▶</button>
                <button
                  type="button"
                  className="icon-btn rgpd-borrar"
                  title="Quitar foto"
                  onClick={() => onChange(fotos.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
