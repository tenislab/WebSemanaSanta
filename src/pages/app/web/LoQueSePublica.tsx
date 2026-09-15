/**
 * Una fila de «esto es lo que se va a publicar».
 *
 * La usan dos pestañas —Contacto y Compartir— y por eso vive aparte: enseña un
 * dato tal cual va a salir en la web, con de dónde sale y un botón para
 * copiarlo.
 */
import { comoSeExplica, type DatoPublicado } from '../../../lib/contactoPublico'
import { Link } from 'react-router-dom'

export function LoQueSePublica({ dato, deConfiguracion, onCopiar }: {
  dato: DatoPublicado
  /** Lo que hay en Configuración para este campo, para ofrecerlo. */
  deConfiguracion: string
  onCopiar: (valor: string) => void
}) {
  if (dato.origen === 'web') return null
  return (
    <p className="form-hint">
      {comoSeExplica(dato)}
      {deConfiguracion && (
        <>
          {' '}En <Link to="/app/configuracion">Configuración</Link> hay «{deConfiguracion}».{' '}
          {/* El valor va en el texto, que se parte solo; el botón se queda
              corto para que quepa en media columna sin pisar al de al lado. */}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCopiar(deConfiguracion)}>
            Usar ese
          </button>
        </>
      )}
    </p>
  )
}

/* ------------------------------ Contacto ------------------------------ */
