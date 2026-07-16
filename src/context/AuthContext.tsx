import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getPersonal } from '../lib/personal'

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

/** Factor de verificación en dos pasos (TOTP) ya dado de alta. */
export interface FactorMfa {
  id: string
  status: 'verified' | 'unverified'
}

interface AuthContextValue {
  session: AppSession | null
  user: AppUser | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<AuthResult & { mfaRequerido?: boolean }>
  /** Entra con el usuario de prueba en un clic (solo existe en modo demostración). */
  signInDemo: () => Promise<AuthResult>
  signUp: (
    email: string,
    password: string,
    meta: { hermandad: string; nombre: string },
  ) => Promise<AuthResult & { needsConfirmation?: boolean }>
  resetPassword: (email: string) => Promise<AuthResult>
  signOut: () => Promise<void>

  /** Hay una sesión con contraseña correcta pero pendiente de completar el segundo paso. */
  mfaPendiente: boolean
  /** Completa el segundo paso al iniciar sesión, con el código de la app de autenticación. */
  verificarCodigoMfa: (code: string) => Promise<AuthResult>
  /** Factores TOTP ya dados de alta para la sesión activa. */
  listarFactoresMfa: () => Promise<FactorMfa[]>
  /** Empieza a dar de alta la verificación en dos pasos: devuelve el código QR y la clave manual. */
  activarMfa: () => Promise<AuthResult & { factorId?: string; qrCode?: string; secret?: string }>
  /** Confirma el alta con el primer código generado por la app de autenticación. */
  confirmarMfa: (factorId: string, code: string) => Promise<AuthResult>
  /** Desactiva un factor de verificación en dos pasos. */
  desactivarMfa: (factorId: string) => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Usuario de demostración: solo existe mientras Supabase no está conectado
 * (`isSupabaseConfigured` es false). En cuanto se añaden las claves de
 * Supabase, esta rama deja de usarse por completo — no hace falta borrar
 * nada a mano.
 */
export const DEMO_EMAIL = 'demo@cabildo.app'
export const DEMO_PASSWORD = 'demo1234'
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
  const [mfaPendiente, setMfaPendiente] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setDemoUser(readDemoUser())
      setLoading(false)
      return
    }

    async function sincronizarSesion(session: { user: Parameters<typeof mapSupabaseUser>[0] } | null) {
      setRealUser(session ? mapSupabaseUser(session.user) : null)
      if (!session || !supabase) {
        setMfaPendiente(false)
        return
      }
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      setMfaPendiente(Boolean(data && data.currentLevel === 'aal1' && data.nextLevel === 'aal2'))
    }

    supabase.auth.getSession().then(({ data }) => {
      sincronizarSesion(data.session).finally(() => setLoading(false))
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      sincronizarSesion(newSession)
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
          if (error) return { error: translateError(error.message) }
          const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          const mfaRequerido = Boolean(data && data.currentLevel === 'aal1' && data.nextLevel === 'aal2')
          return { error: null, mfaRequerido }
        }

        const normalizado = email.trim().toLowerCase()

        if (normalizado === DEMO_EMAIL && password === DEMO_PASSWORD) {
          const u = buildDemoUser(DEMO_EMAIL, 'Hermandad de prueba', 'Usuario Demo')
          sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(u))
          setDemoUser(u)
          return { error: null }
        }

        // Personal con cargo (tesorero/a, secretaría…): mismo formulario,
        // acceso limitado a los módulos que su cargo tenga permitidos.
        const miembro = getPersonal().find(
          (p) => p.activo && p.email.trim().toLowerCase() === normalizado,
        )
        if (miembro && miembro.clave === password) {
          const u = buildDemoUser(miembro.email, 'Hermandad de prueba', miembro.nombre)
          u.user_metadata.cargo = miembro.cargo
          u.user_metadata.personalId = miembro.id
          sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(u))
          setDemoUser(u)
          return { error: null }
        }

        return {
          error: `Estás en modo demostración. Usa el usuario de prueba: ${DEMO_EMAIL} / ${DEMO_PASSWORD}, o el acceso de personal que te haya dado tu hermandad.`,
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
            options: {
              data: { hermandad: meta.hermandad, nombre: meta.nombre },
              emailRedirectTo: `${window.location.origin}/login`,
            },
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

      mfaPendiente: isSupabaseConfigured && mfaPendiente,

      async verificarCodigoMfa(code) {
        if (!supabase) return { error: 'No disponible en modo demostración.' }
        const { data: factores, error: listError } = await supabase.auth.mfa.listFactors()
        if (listError) return { error: translateError(listError.message) }
        const factor = factores?.totp.find((f) => f.status === 'verified')
        if (!factor) return { error: 'No se encontró ningún factor de verificación activo.' }
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: factor.id,
        })
        if (challengeError) return { error: translateError(challengeError.message) }
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: factor.id,
          challengeId: challenge.id,
          code,
        })
        if (verifyError) return { error: 'Código incorrecto. Inténtalo de nuevo.' }
        setMfaPendiente(false)
        return { error: null }
      },

      async listarFactoresMfa() {
        if (!supabase) return []
        const { data } = await supabase.auth.mfa.listFactors()
        return (data?.totp ?? []).map((f) => ({ id: f.id, status: f.status }))
      },

      async activarMfa() {
        if (!supabase) return { error: 'La verificación en dos pasos necesita Supabase conectado.' }
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
        if (error) return { error: translateError(error.message) }
        return { error: null, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
      },

      async confirmarMfa(factorId, code) {
        if (!supabase) return { error: 'No disponible en modo demostración.' }
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
        if (challengeError) return { error: translateError(challengeError.message) }
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          code,
        })
        if (verifyError) return { error: 'Código incorrecto. Revisa la hora de tu móvil y vuelve a intentarlo.' }
        return { error: null }
      },

      async desactivarMfa(factorId) {
        if (!supabase) return { error: 'No disponible en modo demostración.' }
        const { error } = await supabase.auth.mfa.unenroll({ factorId })
        if (error) return { error: translateError(error.message) }
        return { error: null }
      },
    }),
    [activeUser, loading, mfaPendiente],
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
