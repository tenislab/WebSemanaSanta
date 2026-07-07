import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type AuthResult = { error: string | null }

/** Forma mínima de usuario que usa el resto de la app (real o de demostración). */
interface AppUser {
  id: string
  email?: string
  user_metadata: Record<string, unknown>
}
interface AppSession {
  user: AppUser
}

interface AuthContextValue {
  session: AppSession | null
  user: AppUser | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  /** Entra con el usuario de prueba en un clic (solo existe en modo demostración). */
  signInDemo: () => Promise<AuthResult>
  signUp: (
    email: string,
    password: string,
    meta: { hermandad: string; nombre: string },
  ) => Promise<AuthResult & { needsConfirmation?: boolean }>
  resetPassword: (email: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Usuario de demostración: solo existe mientras Supabase no está conectado
 * (`isSupabaseConfigured` es false). En cuanto se añaden las claves de
 * Supabase, esta rama deja de usarse por completo — no hace falta borrar
 * nada a mano.
 */
const DEMO_EMAIL = 'demo@cabildo.app'
const DEMO_PASSWORD = 'demo1234'
const DEMO_STORAGE_KEY = 'cabildo-demo-user'

function readDemoUser(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AppUser) : null
  } catch {
    return null
  }
}

function buildDemoUser(email: string, hermandad: string, nombre: string): AppUser {
  return { id: `demo-${email.trim().toLowerCase()}`, email: email.trim(), user_metadata: { hermandad, nombre } }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [realUser, setRealUser] = useState<AppUser | null>(null)
  const [demoUser, setDemoUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setDemoUser(readDemoUser())
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setRealUser(data.session ? mapSupabaseUser(data.session.user) : null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setRealUser(newSession ? mapSupabaseUser(newSession.user) : null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const activeUser = isSupabaseConfigured ? realUser : demoUser

  const value = useMemo<AuthContextValue>(
    () => ({
      session: activeUser ? { user: activeUser } : null,
      user: activeUser,
      loading,
      configured: isSupabaseConfigured,

      async signIn(email, password) {
        if (supabase) {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          return { error: error ? translateError(error.message) : null }
        }

        if (
          email.trim().toLowerCase() === DEMO_EMAIL &&
          password === DEMO_PASSWORD
        ) {
          const u = buildDemoUser(DEMO_EMAIL, 'Hermandad de prueba', 'Usuario Demo')
          sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(u))
          setDemoUser(u)
          return { error: null }
        }
        return {
          error: `Estás en modo demostración. Usa el usuario de prueba: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
        }
      },

      async signInDemo() {
        if (supabase) return { error: 'Supabase ya está conectado: usa una cuenta real.' }
        const u = buildDemoUser(DEMO_EMAIL, 'Hermandad de prueba', 'Usuario Demo')
        sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(u))
        setDemoUser(u)
        return { error: null }
      },

      async signUp(email, password, meta) {
        if (supabase) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { hermandad: meta.hermandad, nombre: meta.nombre } },
          })
          if (error) return { error: translateError(error.message) }
          // Si la confirmación por email está activada, no hay sesión todavía.
          const needsConfirmation = !data.session
          return { error: null, needsConfirmation }
        }

        // Sin Supabase no hay verificación real: se crea una sesión de
        // demostración local con los datos introducidos y se entra directo.
        const u = buildDemoUser(email, meta.hermandad, meta.nombre)
        sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(u))
        setDemoUser(u)
        return { error: null, needsConfirmation: false }
      },

      async resetPassword(email) {
        if (supabase) {
          const redirectTo = `${window.location.origin}/login`
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
          return { error: error ? translateError(error.message) : null }
        }
        return {
          error: `En modo demostración no se envían correos. Inicia sesión con el usuario de prueba: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
        }
      },

      async signOut() {
        if (supabase) {
          await supabase.auth.signOut()
          return
        }
        sessionStorage.removeItem(DEMO_STORAGE_KEY)
        setDemoUser(null)
      },
    }),
    [activeUser, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

function mapSupabaseUser(u: { id: string; email?: string; user_metadata: Record<string, unknown> }): AppUser {
  return { id: u.id, email: u.email, user_metadata: u.user_metadata ?? {} }
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
