/** La galería, por álbumes. Es la pestaña que más pesa en megas. */
import { nuevoId } from '../../../lib/supabaseSync'
import {
  avisoDePeso,
  pesoWeb,
  type AlbumGaleria,
  type FotoGaleria,
  type WebPublica,
} from '../../../lib/webPublica'
import { useEffect, useState } from 'react'
import { duplicarEn, leerArchivos, leerImagenes, miniatura, type ActualizarFn, type EditarFn } from './comun'

export function GaleriaTab({ web, editar, actualizar }: { web: WebPublica; editar: EditarFn; actualizar: ActualizarFn }) {
  function editarAlbum(id: string, c: Partial<AlbumGaleria>) {
    editar('albumes', (xs) => xs.map((a) => (a.id === id ? { ...a, ...c } : a)))
  }
  function moverAlbum(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.albumes.length) return
    const arr = [...web.albumes]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    editar('albumes', arr)
  }
  function moverFoto(album: AlbumGaleria, i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= album.fotos.length) return
    const fotos = [...album.fotos]
    ;[fotos[i], fotos[j]] = [fotos[j], fotos[i]]
    editarAlbum(album.id, { fotos })
  }
  /**
   * Añade la foto al álbum leyendo el estado más reciente: la compresión tarda,
   * y con el objeto capturado en el render se perdían fotos al subir varias
   * seguidas.
   */
  async function anadirFoto(albumId: string, dataUrl: string) {
    // Se guarda también una copia pequeña: la rejilla usa esa y la grande solo
    // se descarga al abrir la foto a pantalla completa.
    const mini = await miniatura(dataUrl)
    actualizar((actual) => ({
      ...actual,
      albumes: actual.albumes.map((a) =>
        a.id === albumId
          ? { ...a, fotos: [...a.fotos, { id: nuevoId(), fotoDataUrl: dataUrl, miniDataUrl: mini, pie: '' } as FotoGaleria] }
          : a,
      ),
    }))
  }

  const totalFotos = web.albumes.reduce((n, a) => n + a.fotos.length, 0)
  const [soltandoEn, setSoltandoEn] = useState<string | null>(null)

  const peso = avisoDePeso(pesoWeb(web))
  // Las fotos subidas antes de que hubiera copia pequeña: siguen mandando la
  // grande a la rejilla, que es de donde viene casi todo el peso.
  const sinMini = web.albumes.reduce((n, a) => n + a.fotos.filter((f) => !f.miniDataUrl).length, 0)
  const [aligerando, setAligerando] = useState(false)

  /**
   * Le hace una copia pequeña a las fotos que no la tengan. No se vuelve a
   * comprimir la grande: ya está comprimida, y volver a hacerlo solo le quita
   * calidad. Va de una en una para no clavar el navegador con treinta fotos.
   */
  async function aligerar() {
    setAligerando(true)
    try {
      for (const a of web.albumes) {
        for (const f of a.fotos) {
          if (f.miniDataUrl) continue
          const mini = await miniatura(f.fotoDataUrl)
          actualizar((actual) => ({
            ...actual,
            albumes: actual.albumes.map((x) =>
              x.id !== a.id ? x : { ...x, fotos: x.fotos.map((y) => (y.id === f.id ? { ...y, miniDataUrl: mini } : y)) },
            ),
          }))
        }
      }
    } finally {
      setAligerando(false)
    }
  }

  // Pegar una captura o una foto del portapapeles va al primer álbum, que es
  // el que se está mirando el 90 % de las veces.
  useEffect(() => {
    function pegar(e: ClipboardEvent) {
      const archivos = [...(e.clipboardData?.files ?? [])]
      const destino = soltandoEn ?? web.albumes[0]?.id
      if (archivos.length === 0 || !destino) return
      e.preventDefault()
      leerArchivos(archivos, (d) => anadirFoto(destino, d))
    }
    window.addEventListener('paste', pegar)
    return () => window.removeEventListener('paste', pegar)
  })

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Galería</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => editar('albumes', (xs) => [...xs, { id: nuevoId(), titulo: 'Nuevo álbum', descripcion: '', fecha: '', fotos: [] }])}
        >
          + Nuevo álbum
        </button>
      </div>
      <p className="form-hint">
        Las fotos van por álbumes («Salida 2026», «Restauración del paso»). En la web cada álbum
        sale con su título y su fecha, y al pulsar una foto se abre a pantalla completa. El aviso
        de derechos y la marca de agua se ponen en «Titulares».
        {totalFotos > 0 && ` Ahora mismo: ${totalFotos} ${totalFotos === 1 ? 'foto' : 'fotos'}.`}
      </p>

      {/* Lo que pesa la web. Las fotos viajan dentro del contenido, así que
          esto es lo que se descarga cada visita. */}
      <div className={`banner-inline ${peso.nivel === 'malo' ? 'banner-inline--warn' : 'banner-inline--accent'}`}>
        <span>
          Tu web pesa <b>{peso.peso}</b>
          {peso.segundos >= 2 && `: unos ${peso.segundos} segundos en un móvil con mala cobertura`}
          {peso.nivel === 'malo' && '. Pasado de aquí, el navegador puede no dejar guardarla'}.
          {sinMini > 0 && ` Hay ${sinMini} ${sinMini === 1 ? 'foto' : 'fotos'} sin copia pequeña.`}
        </span>
        {sinMini > 0 && (
          <button type="button" className="btn btn-outline btn-sm" disabled={aligerando} onClick={aligerar}>
            {aligerando ? 'Aligerando…' : 'Aligerar las fotos'}
          </button>
        )}
      </div>
      {web.albumes.length === 0 && (
        <p className="form-hint">Todavía no hay ningún álbum. Crea el primero con el botón de arriba.</p>
      )}

      {web.albumes.map((a, i) => (
        <div className="assign-box" key={a.id}>
          <div className="assign-box__row">
            <input
              type="text"
              value={a.titulo}
              onChange={(e) => editarAlbum(a.id, { titulo: e.target.value })}
              placeholder="Título del álbum"
              aria-label="Título del álbum"
            />
            <input
              type="text"
              value={a.fecha}
              onChange={(e) => editarAlbum(a.id, { fecha: e.target.value })}
              placeholder="Viernes Santo de 2026"
              aria-label="Cuándo fue"
            />
            <button type="button" className="icon-btn" title="Subir" disabled={i === 0} onClick={() => moverAlbum(i, -1)}>▲</button>
            <button type="button" className="icon-btn" title="Bajar" disabled={i === web.albumes.length - 1} onClick={() => moverAlbum(i, 1)}>▼</button>
            {/* Las fotos de la copia llevan id nuevo: el visor las localiza por
                id en la lista de TODAS, y dos iguales lo descolocaban. */}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => editar('albumes', (xs) => duplicarEn(xs, a.id, (x) => ({
                ...x,
                id: nuevoId(),
                titulo: `${x.titulo} (copia)`,
                fotos: x.fotos.map((f) => ({ ...f, id: nuevoId() })),
              })))}
            >
              Duplicar
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm rgpd-borrar"
              onClick={() => {
                // Un álbum con fotos dentro no se borra de un clic sin más.
                if (a.fotos.length > 0 && !window.confirm(`«${a.titulo || 'Este álbum'}» tiene ${a.fotos.length} ${a.fotos.length === 1 ? 'foto' : 'fotos'}. ¿Seguro que quieres borrarlo?`)) return
                editar('albumes', (xs) => xs.filter((x) => x.id !== a.id))
              }}
            >
              Quitar álbum
            </button>
          </div>
          <div className="form-row">
            <input
              type="text"
              value={a.descripcion}
              onChange={(e) => editarAlbum(a.id, { descripcion: e.target.value })}
              placeholder="Una línea de contexto (opcional)"
              aria-label="Descripción del álbum"
            />
          </div>

          <div className="settings-card__head" style={{ marginTop: '0.4rem' }}>
            <h3 className="settings-card__title" style={{ fontSize: '0.95rem' }}>
              {a.fotos.length === 0 ? 'Sin fotos' : `${a.fotos.length} ${a.fotos.length === 1 ? 'foto' : 'fotos'}`}
            </h3>
            <label className="btn btn-outline btn-sm">
              + Añadir fotos
              {/* `multiple`: se suben las de una salida entera de una vez. */}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => leerImagenes(e, (d) => anadirFoto(a.id, d))}
              />
            </label>
          </div>
          <div
            className={`soltar-fotos${soltandoEn === a.id ? ' soltar-fotos--activa' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setSoltandoEn(a.id) }}
            onDragLeave={() => setSoltandoEn(null)}
            onDrop={(e) => {
              e.preventDefault()
              setSoltandoEn(null)
              leerArchivos([...e.dataTransfer.files], (d) => anadirFoto(a.id, d))
            }}
          >
            Arrastra aquí las fotos, o pégalas con {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+V
          </div>
          {a.fotos.length > 0 && (
            <div className="galeria-editor">
              {a.fotos.map((f, j) => (
                <div className="galeria-editor__item" key={f.id}>
                  <img src={f.fotoDataUrl} alt="" />
                  <input
                    type="text"
                    value={f.pie}
                    onChange={(e) => editarAlbum(a.id, { fotos: a.fotos.map((x) => (x.id === f.id ? { ...x, pie: e.target.value } : x)) })}
                    placeholder="Pie de foto"
                    aria-label="Pie de foto"
                  />
                  {/* Quién la hizo: se publica como «Foto: …» bajo el pie y en el visor. */}
                  <input
                    type="text"
                    value={f.autor ?? ''}
                    onChange={(e) => editarAlbum(a.id, { fotos: a.fotos.map((x) => (x.id === f.id ? { ...x, autor: e.target.value } : x)) })}
                    placeholder="Autor de la foto"
                    aria-label="Autor de la foto"
                  />
                  <div className="galeria-editor__acciones">
                    <button type="button" className="icon-btn" title="Antes" disabled={j === 0} onClick={() => moverFoto(a, j, -1)}>◀</button>
                    <button type="button" className="icon-btn" title="Después" disabled={j === a.fotos.length - 1} onClick={() => moverFoto(a, j, 1)}>▶</button>
                    <button
                      type="button"
                      className="icon-btn rgpd-borrar"
                      title="Quitar foto"
                      onClick={() => editarAlbum(a.id, { fotos: a.fotos.filter((x) => x.id !== f.id) })}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

/* ------------------------------ Actualidad ------------------------------ */
