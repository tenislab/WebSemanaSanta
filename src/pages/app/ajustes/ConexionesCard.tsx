import { Link } from 'react-router-dom'
import { conexiones, resumenConexiones } from '../../../lib/conexiones'
import { correoDisponible, getAjustesCorreo } from '../../../lib/correo'
import { getWebPublica } from '../../../lib/webPublica'
import { tieneCapacidad, useSuscripcion } from '../../../lib/suscripcion'
import { useCuentasSociales } from '../../../lib/db/comunicados'
import { useHermandadSettings } from '../../../lib/hermandadSettings'

/**
 * El envío de correo: encenderlo, decir quién firma y —lo primero de todo—
 * mandarse una prueba a uno mismo. Sin el botón de prueba, que algo falla se
 * descubre el día que se manda la convocatoria de cabildo a mil personas.
 */
/**
 * QUÉ HAY CONECTADO Y QUÉ FALTA.
 *
 * Llegó dicho así: «no hay apartado que dé opción de conectar, no está en
 * ajustes». Y era verdad: cada cosa se conectaba en su módulo —el correo aquí,
 * las redes en Comunicados, el dominio dentro de un desplegable de la Web— así
 * que no había ningún sitio donde preguntar «¿qué me queda?». Y ese sitio, para
 * cualquiera, es Ajustes.
 *
 * No mueve nada: cada cosa se sigue configurando donde estaba, porque ahí es
 * donde tiene sentido mientras se trabaja. Esto da la lista, el estado y el
 * camino.
 */
export default function ConexionesCard() {
  const settings = useHermandadSettings()
  const { suscripcion } = useSuscripcion()
  const [cuentas] = useCuentasSociales()
  const web = getWebPublica()
  const ajustesCorreo = getAjustesCorreo()

  const lista = conexiones({
    correoListo: correoDisponible(ajustesCorreo),
    // No hay «remitente» configurable: lo que se guarda es a dónde
    // contestan los hermanos si le dan a «responder».
    remitente: ajustesCorreo.responderA || undefined,
    redesConectadas: cuentas.filter((c) => c.conectada).length,
    totalRedes: cuentas.length,
    dominio: (web.dominio ?? '').trim() || undefined,
    webPublicada: web.publicada,
    dominioEnElPack: tieneCapacidad(suscripcion, 'premium'),
    tieneIban: settings.iban.trim().length > 0,
    bizum: settings.bizumTelefono.trim() || undefined,
    stripeCuenta: settings.stripeCuenta.trim() || undefined,
  })
  const resumen = resumenConexiones(lista)

  return (
    <section className="cfg-card">
      <div className="cfg-card__head">
        <div>
          <h2>Conexiones</h2>
          <p className="cfg-card__lead">
            Todo lo que se enchufa desde fuera, junto. Cada cosa se configura en su pantalla —el
            enlace de al lado lleva— y aquí se ve de un vistazo qué falta.
          </p>
        </div>
        <span className="pill pill--info">{resumen.conectadas} de {resumen.posibles}</span>
      </div>

      <ul className="conexiones">
        {lista.map((c) => (
          <li className={`conexion conexion--${c.estado}`} key={c.id}>
            <div className="conexion__texto">
              <h3>
                {c.nombre}
                <span className={`pill ${c.estado === 'conectado' ? 'pill--ok' : c.estado === 'noDisponible' ? 'pill--off' : 'pill--warn'}`}>
                  {c.estado === 'conectado' ? 'Conectado' : c.estado === 'noDisponible' ? 'Todavía no' : 'Sin conectar'}
                </span>
                {c.detalle && <span className="conexion__detalle">{c.detalle}</span>}
              </h3>
              <p>{c.estado === 'noDisponible' ? c.porQueNo : c.paraQue}</p>
              {/* Se dice el camino ADEMÁS de enlazarlo: quien lo lea en el móvil
                  o se lo apunte para hacerlo luego necesita el nombre. */}
              {c.estado !== 'noDisponible' && <small>{c.comoLlegar}</small>}
            </div>
            {c.estado !== 'noDisponible' && (
              <Link className="btn btn-ghost btn-sm" to={c.donde}>
                {c.estado === 'conectado' ? 'Cambiar' : 'Conectar'}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
