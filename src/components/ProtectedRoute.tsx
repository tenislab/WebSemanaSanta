import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
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
   * Una cuenta de hermano no es personal de la hermandad: aunque tenga sesión
   * real de Supabase, no entra aquí. La regla está bien; lo que estaba mal era
   * no decirlo.
   *
   * Sin explicación, esto se lee como que la aplicación está rota. Pulsas
   * «Gestiono la hermandad», te lleva al panel y te devuelve al área del
   * hermano en un parpadeo: parece que los dos botones de «¿Quién eres?»
   * llevan al mismo sitio. Pasa mucho más de lo que parece, porque el enlace
   * de recuperar contraseña ABRE SESIÓN con esa cuenta: quien acaba de
   * recuperar la de un hermano se queda con esa sesión puesta sin saberlo.
   *
   * OJO CON «SOLO»: en una hermandad casi todo el que gestiona es ADEMÁS
   * hermano. El Hermano Mayor es hermano, la secretaria es hermana, el
   * tesorero paga su cuota como cualquiera. A esos NO se les puede echar del
   * panel: son personal, y entran por la puerta de personal.
   *
   * Por eso se pregunta a la base de datos en vez de mirar el metadata de la
   * sesión, que además de ser reescribible por el propio usuario solo sabe
   * decir «es hermano» y no «es solo hermano».
   *
   * Se manda el motivo para que el área del hermano lo cuente al llegar.
   */
  if (session && configured && soloHermano) {
    return <Navigate to="/hermano" replace state={{ motivo: 'cuenta-de-hermano' }} />
  }

  // Mientras no se sabe qué es esta cuenta, no se pinta el panel: enseñarlo y
  // quitarlo medio segundo después es peor que esperar ese medio segundo.
  if (session && configured && soloHermano === null) {
    return <div className="app-cargando" aria-busy="true"><p>Un momento…</p></div>
  }

  return <>{children}</>
}
