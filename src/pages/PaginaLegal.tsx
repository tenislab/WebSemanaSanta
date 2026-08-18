import { Link, Navigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { DOCUMENTOS_LEGALES, getDocumentoLegal } from '../data/legal'

export default function PaginaLegal() {
  const { slug } = useParams<{ slug: string }>()
  const doc = slug ? getDocumentoLegal(slug) : undefined
  if (!doc) return <Navigate to="/" replace />

  // Los textos legales se dejan EN BLANCO a propósito: cada titular debe
  // publicar los suyos, redactados y revisados por un profesional. Aquí solo
  // se muestra la página con su título y un aviso, lista para completar.
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

          <div className="legal-blank" role="note">
            <p className="legal-blank__title">Documento pendiente de publicación</p>
            <p>
              El texto de este documento se publicará próximamente. Debe redactarlo y revisarlo un
              profesional con los datos reales del titular antes de darle validez legal.
            </p>
          </div>
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
