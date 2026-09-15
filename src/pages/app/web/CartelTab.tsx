/** Los carteles de la hermandad. */
import { nuevoId } from '../../../lib/supabaseSync'
import { GUION_CARTEL, cartelesOrdenados, type Cartel, type WebPublica } from '../../../lib/webPublica'
import { leerImagenGrande, type ActualizarFn, type EditarFn } from './comun'

export function CartelTab({ web, editar, actualizar }: { web: WebPublica; editar: EditarFn; actualizar: ActualizarFn }) {
  const carteles = cartelesOrdenados(web.carteles)

  function editarUno(id: string, c: Partial<Cartel>) {
    editar('carteles', (xs) => xs.map((x) => (x.id === id ? { ...x, ...c } : x)))
  }
  /** La imagen llega tarde (hay que leerla y subirla): sobre el estado más reciente. */
  function guardarImagenDe(id: string, dataUrl: string) {
    actualizar((actual) => ({
      ...actual,
      carteles: actual.carteles.map((x) => (x.id === id ? { ...x, imagenDataUrl: dataUrl } : x)),
    }))
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">El cartel</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => editar('carteles', (xs) => [{ ...GUION_CARTEL, id: nuevoId() }, ...xs])}
        >
          + Nuevo cartel
        </button>
      </div>
      <p className="form-hint">
        El de este año se enseña grande, con su autor y su técnica. Los anteriores se quedan debajo
        en una tira: no los borres, la colección de carteles es media historia de la hermandad.
      </p>
      {carteles.length === 0 && <p className="form-hint">Todavía no hay ningún cartel.</p>}
      {carteles.map((c) => (
        <div key={c.id} className="mini-card">
          <div className="mini-card__head">
            <strong>{c.titulo || `Cartel ${c.anio || 'sin año'}`}</strong>
            <button
              type="button"
              className="btn btn-ghost btn-sm rgpd-borrar"
              onClick={() => {
                if (!window.confirm(`¿Quitar «${c.titulo || 'este cartel'}» de la web?`)) return
                editar('carteles', (xs) => xs.filter((x) => x.id !== c.id))
              }}
            >
              Quitar
            </button>
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor={`cartelTitulo-${c.id}`}>Título</label>
              <input
                id={`cartelTitulo-${c.id}`} type="text" value={c.titulo}
                onChange={(e) => editarUno(c.id, { titulo: e.target.value })}
                placeholder="Cartel de la Semana Santa 2027"
              />
            </div>
            <div className="form-row">
              <label htmlFor={`cartelAnio-${c.id}`}>Año</label>
              <input
                id={`cartelAnio-${c.id}`} type="text" inputMode="numeric" value={c.anio}
                onChange={(e) => editarUno(c.id, { anio: e.target.value })}
                placeholder="2027"
              />
              {/* Sin año no se puede ordenar, y el de este año se queda detrás
                  de uno de hace diez solo porque se subiera antes. */}
              <p className="form-hint">Es lo que ordena los carteles. Sin él, este se va al final.</p>
            </div>
          </div>
          <div className="form-row">
            <label htmlFor={`cartelImg-${c.id}`}>La imagen</label>
            {c.imagenDataUrl && (
              <img
                src={c.imagenDataUrl}
                alt=""
                style={{ maxWidth: 180, borderRadius: 8, display: 'block', marginBottom: '0.6rem' }}
              />
            )}
            <input
              id={`cartelImg-${c.id}`} type="file" accept="image/*"
              onChange={(e) => leerImagenGrande(e, (d) => guardarImagenDe(c.id, d))}
            />
            {/* Un cartel se mira de cerca y se amplía: es de las pocas imágenes
                de la web que merecen el tamaño grande. */}
            <p className="form-hint">Se guarda a tamaño grande: un cartel se amplía para leer la letra pequeña.</p>
          </div>
          <div className="form-row">
            <label htmlFor={`cartelAlt-${c.id}`}>Qué se ve en él</label>
            <input
              id={`cartelAlt-${c.id}`} type="text" value={c.alt}
              onChange={(e) => editarUno(c.id, { alt: e.target.value })}
              placeholder="El Señor con la cruz al hombro, de perfil, sobre fondo dorado"
            />
            <p className="form-hint">Para quien no puede ver la imagen. También lo lee Google.</p>
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor={`cartelAutor-${c.id}`}>Autor</label>
              <input
                id={`cartelAutor-${c.id}`} type="text" value={c.autor}
                onChange={(e) => editarUno(c.id, { autor: e.target.value })}
                placeholder="Nombre del pintor o del fotógrafo"
              />
            </div>
            <div className="form-row">
              <label htmlFor={`cartelTecnica-${c.id}`}>Técnica</label>
              <input
                id={`cartelTecnica-${c.id}`} type="text" value={c.tecnica}
                onChange={(e) => editarUno(c.id, { tecnica: e.target.value })}
                placeholder="Óleo sobre lienzo · Fotografía · Técnica mixta"
              />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor={`cartelPres-${c.id}`}>Presentación</label>
            <input
              id={`cartelPres-${c.id}`} type="text" value={c.presentacion}
              onChange={(e) => editarUno(c.id, { presentacion: e.target.value })}
              placeholder="Sábado 14 de febrero, 20:00, casa de hermandad"
            />
          </div>
          <div className="form-row">
            <label htmlFor={`cartelTexto-${c.id}`}>Lo que se quiera contar</label>
            <textarea
              id={`cartelTexto-${c.id}`} rows={3} value={c.texto}
              onChange={(e) => editarUno(c.id, { texto: e.target.value })}
              placeholder="La escena elegida, por qué se eligió, lo que se contó el día de la presentación."
            />
          </div>
        </div>
      ))}
    </section>
  )
}

/* ------------------------------- Caridad -------------------------------- */
/**
 * LA CARIDAD, con cifras.
 *
 * «¿Y esto en qué se gasta?» es la pregunta que llega de fuera, y la respuesta
 * estaba en un párrafo dentro de Historia, que no lo lee nadie.
 *
 * Las cifras son tres y no un informe: es lo que cabe en un vistazo desde el
 * móvil, que es desde donde se lee esto. Y van con ejemplo puesto, porque
 * delante de tres cajas vacías no las rellena nadie.
 */
