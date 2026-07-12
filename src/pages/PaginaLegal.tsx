import { Link, Navigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { DOCUMENTOS_LEGALES, getDocumentoLegal } from '../data/legal'

export default function PaginaLegal() {
  const { slug } = useParams<{ slug: string }>()
  const doc = slug ? getDocumentoLegal(slug) : undefined
  if (!doc) return <Navigate to="/" replace />

  // Si aún quedan campos por rellenar ([...]), se avisa: son plantillas que el
  // titular debe completar con sus datos reales y revisar antes de publicar.
  const pendiente = JSON.stringify(doc).includes('[')

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
          <p className="legal-doc__fecha">Última actualización: {doc.actualizado}</p>

          {pendiente && (
            <div className="legal-aviso" role="note">
              <strong>Documento de ejemplo pendiente de completar.</strong> Los campos entre
              corchetes <code>[…]</code> deben rellenarse con los datos reales del titular, y el
              texto debe revisarse con un profesional antes de darle validez legal.
            </div>
          )}

          <p className="legal-doc__intro">{doc.intro}</p>

          {doc.secciones.map((s, i) => (
            <section className="legal-seccion" key={i}>
              {s.titulo && <h2>{s.titulo}</h2>}
              {s.parrafos?.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
              {s.lista && (
                <ul>
                  {s.lista.map((li, k) => (
                    <li key={k}>{li}</li>
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
        <span>© 2026 Cabildo · Todos los derechos reservados</span>
        <span>Hecho con cariño para el mundo cofrade</span>
      </footer>
    </div>
  )
}
