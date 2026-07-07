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
  const { session, loading, configured } = useAuth()
  const location = useLocation()

  if (loading) {
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

  return <>{children}</>
}
