import { Link } from 'react-router-dom'
import type { Requisito } from '../lib/requisitos'

/**
 * El aviso de «esto no funciona todavía porque falta configurarlo». Rojo, en el
 * sitio donde se nota, y con las tres cosas que hacen falta para resolverlo:
 * qué no va, por qué, y quién lo arregla y dónde.
 *
 * La norma que sigue es la del proyecto: **no se esconde nada**. El botón que
 * no funciona se queda donde está y al lado se explica qué le falta. Ocultarlo
 * tiene dos problemas: la hermandad no descubre nunca que existe, y quien lo
 * configura no sabe qué hay que hacer.
 *
 * `compacto` es para cuando va dentro de un panel lateral o una tarjeta, donde
 * el aviso entero se comería la pantalla: enseña el titular y el arreglo, y
 * deja el «por qué» detrás de un desplegable.
 */
export default function AvisoFalta({
  requisito,
  compacto = false,
  className,
}: {
  requisito: Requisito
  compacto?: boolean
  className?: string
}) {
  // Lo que ya está configurado no se anuncia: un aviso permanente que dice
  // «todo bien» acaba siendo ruido y deja de leerse.
  if (requisito.listo) return null
  return (
    <div className={`aviso-falta${compacto ? ' aviso-falta--compacto' : ''}${className ? ` ${className}` : ''}`} role="note">
      <p className="aviso-falta__titulo">
        <span className="aviso-falta__marca" aria-hidden="true" />
        {requisito.queNoVa}
      </p>
      {compacto ? (
        <details className="aviso-falta__detalle">
          <summary>Por qué</summary>
          <p>{requisito.porQue}</p>
        </details>
      ) : (
        <p className="aviso-falta__porque">{requisito.porQue}</p>
      )}
      <p className="aviso-falta__arreglo">{requisito.comoSeArregla}</p>
      {requisito.enlace && (
        <Link className="aviso-falta__enlace" to={requisito.enlace.a}>
          {requisito.enlace.texto} →
        </Link>
      )}
    </div>
  )
}
