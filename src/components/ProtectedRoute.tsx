import { Navigate, useLocation } from 'react-router-dom'
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
   * Pero NO SE LA ECHA, y tampoco se le pregunta a dónde quiere ir.
   *
   * Aquí ha habido dos versiones y las dos estaban mal:
   *
   *   1. Redirigir en silencio al área del hermano. Pulsabas «gestiono la
   *      hermandad», la pantalla parpadeaba y aparecías en otro sitio. Desde
   *      el otro lado no se distingue de que la aplicación esté rota: los dos
   *      botones de «¿Quién eres?» parecen llevar al mismo lugar.
   *
   *   2. Preguntar «¿a dónde quieres ir?». Peor todavía: ya lo habías dicho al
   *      entrar. Preguntar dos veces lo mismo no es cuidado, es no escuchar.
   *
   * Si ha pedido el panel, se le da el panel. Lo que verá dentro es lo que le
   * corresponda —que si no gestiona será poco— y eso ya lo deciden las
   * políticas de la base de datos, que son las que de verdad mandan y no
   * enseñan un solo dato que no toque. Echarlo de la puerta no protegía nada:
   * solo desconcertaba a quien sí gestionaba y había caído ahí por error, que
   * pasa más de lo que parece porque el enlace de recuperar contraseña ABRE
   * SESIÓN con la cuenta que sea.
   *
   * Quien haya entrado por error tiene el enlace a su área en la barra de
   * arriba, que es donde se busca una salida.
   */

  return <>{children}</>
}
