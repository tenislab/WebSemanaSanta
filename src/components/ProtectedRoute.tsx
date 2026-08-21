import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { soloEsHermano } from '../lib/multiHermandad'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Protege una ruta: si no hay sesión, redirige a /login guardando el destino.
 *
 * Mientras Supabase no esté conectado (`configured` es false) no existe
 * autenticación real posible, así que el panel se deja accesible en modo
 * demostración para poder construirlo y enseñarlo por fases. En cuanto se
 * conecte Supabase, la protección real entra en vigor automáticamente.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, configured, mfaPendiente, mfaComprobando } = useAuth()
  const location = useLocation()
  /**
   * `null` mientras se pregunta. No se decide nada hasta saberlo: si empezara
   * en `true` habría un parpadeo en el que se echaría a todo el mundo, y si
   * empezara en `false` un hermano vería el panel un instante.
   */
  const [soloHermano, setSoloHermano] = useState<boolean | null>(null)
  /**
   * Ha elegido entrar al panel aun sabiendo que su cuenta es de hermano.
   * Se respeta: no se le vuelve a preguntar en cada pantalla que abra.
   */
  const [seguirAlPanel, setSeguirAlPanel] = useState(false)
  useEffect(() => {
    if (!session || !configured) {
      setSoloHermano(false)
      return
    }
    let cancelado = false
    void soloEsHermano().then((r) => {
      if (!cancelado) setSoloHermano(r)
    })
    return () => {
      cancelado = true
    }
  }, [session, configured])

  // mfaComprobando: hay sesión pero aún no se sabe si le falta el segundo
  // paso — esperar, no renderizar el panel un instante "por si acaso".
  if (loading || mfaComprobando) {
    return (
      <div className="route-loading">
        <span className="spinner" aria-hidden="true" />
        <span>Cargando…</span>
      </div>
    )
  }

  if (!session && configured) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Contraseña correcta pero falta el segundo paso (verificación en dos
  // pasos): vuelve al login, que retoma directamente en el paso del código.
  if (session && configured && mfaPendiente) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  /**
   * Una cuenta que solo es de hermano no tiene nada que hacer en el panel.
   * Pero AQUÍ NO SE LA ECHA: se le pregunta a dónde quiere ir.
   *
   * Antes había una redirección automática al área del hermano, y era un
   * problema aunque la regla fuera correcta. Pulsas «Gestiono la hermandad»,
   * la pantalla parpadea y apareces en el área del hermano. Desde tu lado no
   * se distingue de que la aplicación esté rota: los dos botones de «¿Quién
   * eres?» parecen llevar al mismo sitio. Y pasa más de lo que parece, porque
   * el enlace de recuperar contraseña ABRE SESIÓN: quien acaba de recuperar la
   * de un hermano se queda con esa sesión puesta sin saberlo.
   *
   * Lo peor es que echar a la fuerza no protegía nada. Quien no gestiona no ve
   * un solo dato aunque entre: las políticas de la base de datos son las que
   * mandan, y no enseñan lo que no toca. O sea que la redirección solo servía
   * para desconcertar a quien sí gestionaba y había caído aquí por error.
   *
   * OJO CON «SOLO»: en una hermandad casi todo el que gestiona es ADEMÁS
   * hermano. El Hermano Mayor es hermano, la secretaria es hermana, el
   * tesorero paga su cuota como cualquiera. A esos no les sale esta pantalla:
   * son personal, y entran por la puerta de personal.
   */
  if (session && configured && soloHermano && !seguirAlPanel) {
    return (
      <div className="dos-puertas">
        <div className="dos-puertas__caja">
          <p className="eyebrow">Acceso</p>
          <h1>¿A dónde quieres ir?</h1>
          <p className="dos-puertas__lead">
            Esta cuenta está en el censo como hermano/a, y no figura como personal de
            gestión. Puedes ir a tu área, o entrar de todas formas al panel.
          </p>
          <div className="entrada-opciones">
            <Link to="/hermano" className="entrada-opcion">
              <span>
                <b>Mi área de hermano</b>
                <small>Tus cuotas, tu papeleta, tu sitio en el cortejo</small>
              </span>
            </Link>
            <button type="button" className="entrada-opcion" onClick={() => setSeguirAlPanel(true)}>
              <span>
                <b>Entrar al panel de gestión</b>
                <small>
                  Si llevas un cargo y no lo ves completo, pídele a secretaría que te dé de
                  alta como personal: no hace falta otra cuenta
                </small>
              </span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Mientras no se sabe qué es esta cuenta, no se pinta el panel: enseñarlo y
  // quitarlo medio segundo después es peor que esperar ese medio segundo.
  if (session && configured && soloHermano === null) {
    return <div className="app-cargando" aria-busy="true"><p>Un momento…</p></div>
  }

  return <>{children}</>
}
