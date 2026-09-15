/** Los boletines en PDF, subidos o enlazados. */
import { guardarImagen, hayAlmacen } from '../../../lib/almacenImagenes'
import { nuevoId } from '../../../lib/supabaseSync'
import {
  MAX_PDF_CON_ALMACEN,
  MAX_PDF_SUBIDO,
  urlSegura,
  type Boletin,
  type WebPublica,
} from '../../../lib/webPublica'
import { useState, type ChangeEvent } from 'react'
import { leerImagen, type ActualizarFn, type EditarFn } from './comun'

export function BoletinesTab({ web, editar, actualizar }: { web: WebPublica; editar: EditarFn; actualizar: ActualizarFn }) {
  const [errorPdf, setErrorPdf] = useState<string | null>(null)
  // Con almacén el PDF es un archivo aparte y cabe un boletín en color; sin
  // él se queda dentro de la web, en el navegador, y ahí 2 MB ya es mucho.
  const tope = hayAlmacen() ? MAX_PDF_CON_ALMACEN : MAX_PDF_SUBIDO

  function editarBoletin(id: string, c: Partial<Boletin>) {
    editar('boletines', (xs) => xs.map((b) => (b.id === id ? { ...b, ...c } : b)))
  }
  /** El PDF llega tarde (hay que leerlo entero): se guarda sobre el estado más reciente. */
  function guardarPdf(id: string, c: Partial<Boletin>) {
    actualizar((actual) => ({ ...actual, boletines: actual.boletines.map((b) => (b.id === id ? { ...b, ...c } : b)) }))
  }
  function subirPdf(e: ChangeEvent<HTMLInputElement>, id: string) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type !== 'application/pdf') {
      setErrorPdf('Eso no es un PDF.')
      return
    }
    if (file.size > tope) {
      // Sin almacén, guardar aquí un boletín de 12 MB revienta el
      // almacenamiento del navegador y se pierde TODA la web. Mejor decirlo
      // antes.
      setErrorPdf(
        `«${file.name}» ocupa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo para subir es ` +
        `${(tope / 1024 / 1024).toFixed(0)} MB. Cuélgalo en la nube de la hermandad y pega aquí la dirección.`,
      )
      return
    }
    setErrorPdf(null)
    const lector = new FileReader()
    lector.onload = async () =>
      guardarPdf(id, {
        pdfDataUrl: await guardarImagen(String(lector.result), 'boletines'),
        pdfNombre: file.name,
      })
    lector.onerror = () => setErrorPdf('No se pudo leer el archivo.')
    lector.readAsDataURL(file)
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Boletines</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => editar('boletines', (xs) => [{ id: nuevoId(), titulo: 'Nuevo boletín', subtitulo: '', pdfNombre: null, pdfDataUrl: null, pdfUrl: '', portadaDataUrl: null, fecha: '' }, ...xs])}
        >
          + Nuevo boletín
        </button>
      </div>
      <p className="form-hint">
        En la web salen como un expositor, con su portada y un botón de descarga. Puedes
        <b> subir el PDF</b> (hasta {(tope / 1024 / 1024).toFixed(0)} MB) o
        <b> pegar la dirección</b> donde ya esté colgado, que es lo que aguanta de verdad.
      </p>
      {errorPdf && <p className="form-hint form-hint--alerta">{errorPdf}</p>}
      {web.boletines.length === 0 && <p className="form-hint">Aún no hay boletines.</p>}

      {web.boletines.map((b) => {
        const enlaceMal = Boolean(b.pdfUrl.trim()) && !urlSegura(b.pdfUrl)
        const sinArchivo = !b.pdfDataUrl && !urlSegura(b.pdfUrl)
        return (
          <div className="assign-box" key={b.id}>
            <div className="assign-box__row">
              <div className="boletin-portada">
                {b.portadaDataUrl
                  ? <img src={b.portadaDataUrl} alt="" />
                  : <span aria-hidden="true">PDF</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="form-row">
                  <input type="text" value={b.titulo} onChange={(e) => editarBoletin(b.id, { titulo: e.target.value })} placeholder="Título" aria-label="Título del boletín" />
                </div>
                <div className="form-grid-2">
                  <div className="form-row">
                    <input type="text" value={b.fecha} onChange={(e) => editarBoletin(b.id, { fecha: e.target.value })} placeholder="Cuaresma 2026 · nº 34" aria-label="Cuándo" />
                  </div>
                  <div className="form-row">
                    <input type="text" value={b.subtitulo} onChange={(e) => editarBoletin(b.id, { subtitulo: e.target.value })} placeholder="Una línea (opcional)" aria-label="Subtítulo" />
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('boletines', (xs) => xs.filter((x) => x.id !== b.id))}>Quitar</button>
            </div>

            <div className="assign-box__row">
              <label className="btn btn-outline btn-sm">
                {b.portadaDataUrl ? 'Cambiar portada' : 'Portada'}
                <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => guardarPdf(b.id, { portadaDataUrl: d }))} />
              </label>
              {b.portadaDataUrl && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => editarBoletin(b.id, { portadaDataUrl: null })}>Quitar portada</button>
              )}
              <label className="btn btn-outline btn-sm">
                {b.pdfDataUrl ? 'Cambiar PDF' : 'Subir PDF'}
                <input type="file" accept="application/pdf" hidden onChange={(e) => subirPdf(e, b.id)} />
              </label>
              <span className="table-subtle">
                {b.pdfDataUrl ? `✓ ${b.pdfNombre ?? 'PDF subido'}` : 'Sin archivo subido'}
              </span>
              {b.pdfDataUrl && (
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editarBoletin(b.id, { pdfDataUrl: null, pdfNombre: null })}>Quitar PDF</button>
              )}
            </div>

            <div className="form-row">
              <label>O la dirección donde está colgado</label>
              <input
                type="text"
                value={b.pdfUrl}
                onChange={(e) => editarBoletin(b.id, { pdfUrl: e.target.value })}
                placeholder="https://hermandad.es/boletines/cuaresma-2026.pdf"
                aria-invalid={enlaceMal}
              />
              {enlaceMal && <p className="form-hint form-hint--alerta">Esa dirección no vale: tiene que empezar por https://</p>}
              {!enlaceMal && b.pdfDataUrl && b.pdfUrl.trim() && (
                <p className="form-hint">Hay archivo subido y dirección: en la web manda el archivo subido.</p>
              )}
              {sinArchivo && <p className="form-hint">Sin archivo ni dirección, en la web pone «Próximamente» en vez de un botón que no descarga nada.</p>}
            </div>
          </div>
        )
      })}
    </section>
  )
}

/* --------------------------- Al compartir (SEO) --------------------------- */
/**
 * Cómo se ve el enlace pegado en WhatsApp y en los resultados de Google. Es lo
 * primero que ve la gente de la hermandad, y hasta ahora salía vacío o con lo
 * que el navegador pillara.
 */
/* ---------------------------- Avisos por correo --------------------------- */
/**
 * QUIEN SIGUE A LA HERMANDAD SIN SER HERMANO.
 *
 * Vecinos del barrio, devotos, gente que se crió allí y vive fuera. Se enteran
 * de los cultos por casualidad, porque los avisos van al censo y ellos no están
 * en el censo — y no pueden estarlo: de ahí cuelgan cuotas, papeletas y
 * antigüedad.
 */
