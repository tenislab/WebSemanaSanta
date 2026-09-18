/**
 * La cabecera del área del hermano: escudo, nombre de la hermandad y salir.
 *
 * La usan las DOS pantallas —la de identificarse y el portal— con distintos
 * datos, y de ahí que exista.
 */
import EscudoHermandad from '../../components/EscudoHermandad'
import { LogoMark } from '../../components/Logo'
import { type IconoHermandad } from '../../lib/hermandades'
import { Link } from 'react-router-dom'

export function PortalHead({
  hermandad,
  logo,
  color,
  icono,
  onSalir,
  onContarFallo,
  alPanel,
}: {
  hermandad: string
  logo: string | null
  color?: string
  icono?: IconoHermandad
  onSalir?: () => void
  /** Abre el cajón de contar un fallo. */
  onContarFallo?: () => void
  /**
   * Quien lleva cargo entra por la misma puerta que cualquier hermano —su DNI
   * y su clave— y desde aquí pasa al panel de un clic.
   *
   * Antes NO había ningún enlace al panel dentro del área: el único estaba en
   * la pantalla de identificación, o sea antes de entrar. Quien llevaba cargo
   * y entraba a ver su papeleta tenía que cerrar sesión y volver a empezar.
   */
  alPanel?: boolean
}) {
  return (
    <header className="portal__head">
      <div className="portal__brand">
        <span className="portal__logo">
          {/* Un solo sitio decide cómo se ve la insignia de una hermandad: el
              propio `EscudoHermandad`, que enseña el logo si lo hay y dibuja el
              suyo si no. Antes esto tenía su propio `<img>` aparte, y por eso
              el buscador podía quedarse con el dibujo genérico mientras la
              cabecera sí enseñaba el escudo de verdad. */}
          {/* Con color hay hermandad detrás, y el escudo se apaña con lo que
              haya: su logo, su glifo o sus iniciales. Sin color no hay
              hermandad elegida todavía y va la marca de Gobergo. */}
          {color ? (
            <EscudoHermandad color={color} icono={icono} logoDataUrl={logo} nombre={hermandad} size={28} />
          ) : (
            <LogoMark size={28} />
          )}
        </span>
        <span>
          <b>{hermandad}</b>
          <small>Área del hermano</small>
        </span>
      </div>
      <div className="portal__head-acciones">
        {alPanel && (
          <Link to="/app" className="btn btn-outline btn-sm">
            Ir al panel de gestión
          </Link>
        )}
        {/* Contar un fallo TAMBIÉN aquí, y aquí hace más falta que en el panel:
            el hermano está solo con su móvil, sin nadie de la junta al lado a
            quien preguntar. Si no puede decirlo desde aquí, no lo dice. */}
        {onContarFallo && (
          <button className="btn btn-ghost btn-sm" onClick={onContarFallo}>
            Contar un fallo
          </button>
        )}
        {onSalir && (
          <button className="btn btn-ghost btn-sm" onClick={onSalir}>
            Salir
          </button>
        )}
      </div>
    </header>
  )
}
