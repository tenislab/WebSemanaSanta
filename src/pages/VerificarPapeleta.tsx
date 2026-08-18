import { Link, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { decodificarVerificacion } from '../lib/verificacion'

/**
 * Página pública a la que apunta el QR de la papeleta. Los datos vienen
 * codificados en el propio enlace, así que se ven al escanear desde cualquier
 * móvil, sin base de datos. La comprobación reforzada contra el sistema de la
 * hermandad (y marcar «entregada» el día de salida) llegará con Supabase.
 */
export default function VerificarPapeleta() {
  const [params] = useSearchParams()
  const datos = decodificarVerificacion(params.get('d'))

  return (
    <div className="verificar">
      <header className="verificar__head">
        <Logo size={32} />
        <Link className="btn btn-outline btn-sm" to="/">
          Ir a Cabildo
        </Link>
      </header>

      <main className="verificar__main">
        {datos ? (
          <article className="verificar__card">
            <p className="eyebrow eyebrow--gold">Papeleta de sitio · {datos.a}</p>
            <div className="verificar__sello" aria-hidden="true">✓</div>
            <h1>{datos.h}</h1>
            <p className="verificar__sub">Hermano/a nº {datos.nh}</p>

            <dl className="verificar__list">
              <div>
                <dt>Papeleta</dt>
                <dd>nº {String(datos.n).padStart(4, '0')}</dd>
              </div>
              <div>
                <dt>Sitio</dt>
                <dd>{datos.t}</dd>
              </div>
              <div>
                <dt>Hermandad</dt>
                <dd>{datos.hd}</dd>
              </div>
            </dl>

            <p className="verificar__nota">
              Datos leídos del propio código. La verificación reforzada (comprobar contra el sistema
              de la hermandad y marcar la entrega el día de salida) estará disponible al conectar la
              base de datos.
            </p>
          </article>
        ) : (
          <article className="verificar__card verificar__card--error">
            <div className="verificar__sello verificar__sello--err" aria-hidden="true">!</div>
            <h1>Código no válido</h1>
            <p className="verificar__nota">
              Este enlace no contiene una papeleta legible. Vuelve a escanear el código de una
              papeleta de sitio.
            </p>
          </article>
        )}
      </main>
    </div>
  )
}
