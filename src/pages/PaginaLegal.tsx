import { Link, Navigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { DOCUMENTOS_LEGALES, getDocumentoLegal } from '../data/legal'

export default function PaginaLegal() {
  const { slug } = useParams<{ slug: string }>()
  const doc = slug ? getDocumentoLegal(slug) : undefined
  if (!doc) return <Navigate to="/" replace />

  // Se muestran los textos de data/legal.ts como PLANTILLA. Mientras queden
  // huecos por rellenar ([...]), se avisa en grande de que no tienen validez
  // legal hasta que el titular ponga sus datos y lo revise un profesional.
  const sinRellenar =
    doc.intro.includes('[') || doc.secciones.some((s) => [...(s.parrafos ?? []), ...(s.lista ?? [])].some((t) => t.includes('[')))

  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header__row">
          <Logo size={32} />
          <Link className="btn btn-outline btn-sm" to="/">
            Volver a la portada
          </Link>
        </div>
      </header>

      <main className="legal-main">
        <article className="legal-doc">
          <p className="eyebrow eyebrow--gold">Legal</p>
          <h1>{doc.titulo}</h1>
          <p className="legal-actualizado">Última actualización: {doc.actualizado}</p>

          {sinRellenar && (
            <div className="legal-blank" role="note">
              <p className="legal-blank__title">Plantilla pendiente de completar</p>
              <p>
                Este texto es un modelo de partida: los datos entre corchetes los debe rellenar el
                titular y revisarlo un profesional antes de darle validez legal.
              </p>
            </div>
          )}

          <p className="legal-intro">{doc.intro}</p>

          {doc.secciones.map((s, i) => (
            <section className="legal-seccion" key={s.titulo ?? i}>
              {s.titulo && <h2>{s.titulo}</h2>}
              {s.parrafos?.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
              {s.lista && (
                <ul>
                  {s.lista.map((li, j) => (
                    <li key={j}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>

        <nav className="legal-otros" aria-label="Otros documentos legales">
          <span>Otros documentos:</span>
          {DOCUMENTOS_LEGALES.filter((d) => d.slug !== doc.slug).map((d) => (
            <Link key={d.slug} to={`/legal/${d.slug}`}>
              {d.titulo}
            </Link>
          ))}
        </nav>
      </main>

      <footer className="legal-footer">
        <span>© 2026 Gobergo · Todos los derechos reservados</span>
        <span>Hecho con cariño para el mundo cofrade</span>
      </footer>
    </div>
  )
}
