import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type AuthResult = { error: string | null }

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (
    email: string,
    password: string,
    meta: { hermandad: string; nombre: string },
  ) => Promise<AuthResult & { needsConfirmation?: boolean }>
  resetPassword: (email: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const NOT_CONFIGURED_MSG =
  'Supabase todavía no está conectado. Añade tus claves en el archivo .env para activar el acceso.'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured: isSupabaseConfigured,

      async signIn(email, password) {
        if (!supabase) return { error: NOT_CONFIGURED_MSG }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error ? translateError(error.message) : null }
      },

      async signUp(email, password, meta) {
        if (!supabase) return { error: NOT_CONFIGURED_MSG }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { hermandad: meta.hermandad, nombre: meta.nombre } },
        })
        if (error) return { error: translateError(error.message) }
        // Si la confirmación por email está activada, no hay sesión todavía.
        const needsConfirmation = !data.session
        return { error: null, needsConfirmation }
      },

      async resetPassword(email) {
        if (!supabase) return { error: NOT_CONFIGURED_MSG }
        const redirectTo = `${window.location.origin}/login`
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
        return { error: error ? translateError(error.message) : null }
      },

      async signOut() {
        if (!supabase) return
        await supabase.auth.signOut()
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

/** Traduce los mensajes de error más comunes de Supabase Auth al español. */
function translateError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed'))
    return 'Aún no has confirmado tu correo. Revisa tu bandeja de entrada.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Ese correo ya tiene una cuenta. Inicia sesión.'
  if (m.includes('password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('unable to validate email')) return 'El correo no parece válido.'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
  return message
}
