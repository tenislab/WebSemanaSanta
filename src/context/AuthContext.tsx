import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase, isSupabaseConfigured, supabaseDisponible, sinModoLocal } from '../lib/supabase'
import { getPersonal } from '../lib/personal'
import { CLAVES_DATOS, leerDatos } from '../lib/persistencia'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'
import { limpiarModoDemo } from '../lib/demo'
import { translateError } from '../lib/erroresAuth'
import { ajustarEspejoALaHermandad, asegurarHermandad, hermandadActualId, olvidarHermandad } from '../lib/multiHermandad'
import { olvidarSesionDelHermano } from '../lib/sesion'

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
  /** Aún no se sabe si la sesión activa necesita el segundo paso (consulta en curso): no dejar pasar todavía. */
  mfaComprobando: boolean
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

/**
 * Se asegura de que la cuenta que acaba de entrar pertenece a una hermandad.
 *
 * Todas las hermandades comparten un proyecto de Supabase, así que una cuenta
 * suelta —recién registrada— no ve absolutamente nada hasta que tiene la
 * suya. Aquí es donde se le crea, y se hace al ENTRAR y no al registrarse
 * porque con la confirmación por correo activada al registrarse todavía no
 * hay sesión: el nombre viaja en los datos de la cuenta y se usa la primera
 * vez que entra de verdad.
 *
 * A quien ya tiene hermandad no se le toca nada: `hermandadActualId()` la
 * devuelve de la caché y esto no llega ni a preguntar.
 */
async function enlazarHermandad(usuario: { user_metadata?: Record<string, unknown> | null }) {
  const meta = usuario.user_metadata ?? {}
  // A un hermano NUNCA se le crea una hermandad. Su cuenta la da de alta su
  // hermandad y se enlaza con su ficha; si por lo que sea todavía no está
  // enlazada, lo que hay que hacer es arreglar el enlace, no fundar una
  // hermandad nueva con él de titular.
  if (meta.tipo === 'hermano') {
    ajustarEspejoALaHermandad(await hermandadActualId())
    return
  }
  const yaTiene = await hermandadActualId()
  const id = yaTiene ?? (await asegurarHermandad(typeof meta.hermandad === 'string' ? meta.hermandad : ''))
  // La copia local que haya en este navegador puede ser de OTRA hermandad: de
  // quien usó este mismo ordenador antes. Se tira si no es de esta.
  ajustarEspejoALaHermandad(id)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [realUser, setRealUser] = useState<AppUser | null>(null)
  const [demoUser, setDemoUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  // Supabase está configurado pero no responde (proyecto en pausa/caído): la
  // app sigue funcionando en modo local en vez de quedarse sin poder entrar.
  const [degradado, setDegradado] = useState(false)
  // null = todavía no se sabe (consulta en curso). Importante: la sesión se ve
  // ANTES de saber si necesita el segundo paso; hasta resolverlo no se puede
  // dejar entrar (si no, otra pestaña ya abierta en /app renderizaría el panel
  // un instante con la sesión a medio verificar).
  // Arranca en null («aún no se sabe») cuando hay Supabase: así la guardia de
  // ProtectedRoute no deja ver el panel hasta comprobar si la sesión necesita el
  // segundo paso. Antes empezaba en false y esa guardia no se activaba nunca.
  const [mfaPendiente, setMfaPendiente] = useState<boolean | null>(isSupabaseConfigured ? null : false)

  useEffect(() => {
    if (!supabase) {
      setDemoUser(readDemoUser())
      setLoading(false)
      return
    }

    let cancelado = false
    let sub: { subscription: { unsubscribe: () => void } } | null = null
    /**
     * Quién estaba dentro la última vez que pasamos por aquí.
     *
     * Hace falta porque una sesión puede cambiar de persona SIN pasar por una
     * sesión nula. Pasa así: la secretaria de la hermandad A está dentro del
     * panel, en el ordenador de la casa de hermandad. El presidente de la
     * hermandad B abre en ese mismo navegador el enlace de «confirma tu
     * correo». Supabase canjea el token y avisa con la sesión de B, sin emitir
     * antes un cierre de sesión.
     *
     * Como `olvidarHermandad()` solo se llamaba al cerrar sesión, la hermandad
     * recordada seguía siendo la de A: B entraba viendo el censo de A.
     */
    let ultimoUsuario: string | null = null

    async function sincronizarSesion(session: { user: Parameters<typeof mapSupabaseUser>[0] } | null) {
      setRealUser(session ? mapSupabaseUser(session.user) : null)

      // Ha entrado OTRA persona sin que la anterior cerrara: se olvida todo lo
      // de la anterior ANTES de averiguar nada de esta.
      const usuarioAhora = session?.user?.id ?? null
      if (usuarioAhora !== ultimoUsuario && ultimoUsuario !== null) {
        olvidarHermandad()
        ajustarEspejoALaHermandad(null)
      }
      ultimoUsuario = usuarioAhora

      if (!session || !supabase) {
        setMfaPendiente(false)
        olvidarHermandad()
        // Sin sesión no se queda copia de nadie: el siguiente que entre en este
        // ordenador empieza en blanco.
        ajustarEspejoALaHermandad(null)
        return
      }

      // Hay sesión de verdad contra Supabase, así que esto no es una
      // demostración: fuera la marca del modo demo.
      //
      // Hace falta AQUÍ y no solo al iniciar sesión. La marca vive en el
      // navegador y sobrevive a todo: quien primero prueba la demostración
      // —que es lo que hace todo el mundo— y luego conecta su base de datos
      // se queda con ella puesta, y entonces la aplicación le sigue enseñando
      // el censo de ejemplo en vez del suyo. Parece que la base de datos no
      // funciona, cuando lo que pasa es que ni siquiera se está mirando.
      //
      // Poniéndolo donde se resuelve la sesión, quedan cubiertos todos los
      // caminos: registrarse, iniciar sesión, volver con la sesión guardada o
      // confirmar el correo. Los datos de ejemplo nunca llegaron a subirse a
      // Supabase (en modo local no se sincroniza), así que no hay nada que
      // limpiar en la base: solo dejar de mirar al sitio equivocado.
      limpiarModoDemo()
      // No se toca el estado aquí: dejarlo en su valor previo evita que cada
      // re-sincronización (p. ej. el refresco de token, cada hora o al volver a
      // la pestaña) lo ponga en "comprobando" y parpadee el spinner a pantalla
      // completa. El "comprobando" (null) solo ocurre en la carga inicial.
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        setMfaPendiente(Boolean(data && data.currentLevel === 'aal1' && data.nextLevel === 'aal2'))
      } catch {
        // Si no se puede comprobar el nivel, se falla CERRADO: se pide el
        // segundo factor. Antes se dejaba pasar, así que un fallo de red al
        // consultar el nivel bastaba para saltarse la verificación en dos pasos.
        setMfaPendiente(true)
      }

      // Lo último, y después de resolver el segundo paso a propósito: mientras
      // `mfaPendiente` sigue sin saberse, la guardia de las rutas no deja ver
      // el panel y se está mirando un spinner a pantalla completa. Si esta
      // consulta se atasca —la red va mal, la base de datos tarda— con el
      // orden contrario la aplicación se quedaba ahí colgada sin poder entrar.
      await enlazarHermandad(session.user)
    }

    async function arrancar() {
      // Antes de nada, comprobar que Supabase responde. Si está pausado o
      // caído, se entra en modo local (degradado) para que la app siga
      // funcionando: mismos accesos de demostración y datos en el navegador.
      //
      // Salvo que esté la protección puesta, que ES LO NORMAL: con una
      // hermandad de verdad, entrar en local es peor que no entrar. La
      // secretaria vería un censo que no es el suyo —los doce de ejemplo— y
      // pasaría la tarde dando altas que no existen en ningún sitio, sin que
      // nada avise. Se deja caer con su error y se vuelve en un rato. Solo
      // `VITE_MODO_LOCAL=1` (desarrollo) reabre esta puerta.
      const disponible = await supabaseDisponible()
      if (cancelado || !supabase) return
      if (!disponible && !sinModoLocal) {
        setDegradado(true)
        setDemoUser(readDemoUser())
        setMfaPendiente(false)
        setLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (cancelado) return
      await sincronizarSesion(data.session)
      if (cancelado) return
      setLoading(false)
      const res = supabase.auth.onAuthStateChange((_event, newSession) => {
        sincronizarSesion(newSession)
      })
      sub = res.data
    }

    arrancar()

    return () => {
      cancelado = true
      sub?.subscription.unsubscribe()
    }
  }, [])

  // Modo local efectivo: sin Supabase configurado, o configurado pero caído.
  const activeUser = isSupabaseConfigured && !degradado ? realUser : demoUser

  const value = useMemo<AuthContextValue>(
    () => ({
      session: activeUser ? { user: activeUser } : null,
      user: activeUser,
      loading,
      configured: isSupabaseConfigured && !degradado,

      async signIn(email, password) {
        if (supabase && !degradado) {
          try {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) return { error: translateError(error.message) }
            // Acceso real con éxito: salimos del modo demo si lo hubiera.
            limpiarModoDemo()
            const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
            const mfaRequerido = Boolean(data && data.currentLevel === 'aal1' && data.nextLevel === 'aal2')
            return { error: null, mfaRequerido }
          } catch {
            // Supabase dejó de responder a mitad (pausa/caída): pasar a modo
            // local y seguir intentando el acceso con los usuarios de demostración.
            setDegradado(true)
          }
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

        /*
         * Y un HERMANO CON CARGO en su ficha, que es la vía nueva y la
         * recomendada. Sin esto, la demostración enseñaría lo contrario de lo
         * que se ha construido: sin Supabase, `soyTitular()` contesta que sí
         * para no bloquear la demo, así que un hermano con cargo entraría con
         * el panel entero abierto.
         *
         * Entra con su correo y su clave de acceso, la misma con la que entra
         * a su área por DNI: es la misma persona y la misma contraseña.
         */
        const censo = leerDatos<Hermano>(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
        const conCargo = censo.find(
          (h) =>
            h.cargo
            && h.cargo !== 'Hermano de a pie'
            && h.estado !== 'Baja'
            && h.email.trim().toLowerCase() === normalizado,
        )
        if (conCargo && conCargo.claveAcceso === password) {
          const u = buildDemoUser(conCargo.email, 'Hermandad de prueba', conCargo.nombre)
          u.user_metadata.cargo = conCargo.cargo ?? undefined
          u.user_metadata.hermanoId = conCargo.id
          sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(u))
          setDemoUser(u)
          return { error: null }
        }

        return {
          error: `Estás en modo demostración. Usa el usuario de prueba: ${DEMO_EMAIL} / ${DEMO_PASSWORD}, o el acceso que te haya dado tu hermandad.`,
        }
      },

      async signInDemo() {
        if (supabase && !degradado) return { error: 'Supabase ya está conectado: usa una cuenta real.' }
        const u = buildDemoUser(DEMO_EMAIL, 'Hermandad de prueba', 'Usuario Demo')
        sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(u))
        setDemoUser(u)
        return { error: null }
      },

      async signUp(email, password, meta) {
        if (supabase && !degradado) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { hermandad: meta.hermandad, nombre: meta.nombre },
              emailRedirectTo: `${window.location.origin}/login`,
            },
          })
          if (error) return { error: translateError(error.message) }
          // Alta real: se sale del modo demostración aunque todavía no haya
          // sesión (cuando hace falta confirmar el correo antes de entrar).
          limpiarModoDemo()
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
        if (supabase && !degradado) {
          const redirectTo = `${window.location.origin}/login`
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
          return { error: error ? translateError(error.message) : null }
        }
        return {
          error: `En modo demostración no se envían correos. Inicia sesión con el usuario de prueba: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
        }
      },

      async signOut() {
        olvidarHermandad()
        ajustarEspejoALaHermandad(null)
        /*
         * Y LA DEL ÁREA DEL HERMANO, que es otra y vive aparte.
         *
         * Sin esto, quien entraba por su área y cerraba sesión desde el panel
         * seguía «dentro» al volver a /hermano, sin sesión de Supabase detrás:
         * la aplicación lo llevaba a su área en vez de a la de gestión. Y en la
         * casa de hermandad, donde el ordenador lo usan varios, el siguiente
         * veía la ficha del anterior. Explicado entero en `lib/sesion.ts`.
         */
        olvidarSesionDelHermano()
        if (supabase && !degradado) {
          await supabase.auth.signOut()
          return
        }
        sessionStorage.removeItem(DEMO_STORAGE_KEY)
        setDemoUser(null)
      },

      mfaPendiente: isSupabaseConfigured && !degradado && mfaPendiente === true,
      mfaComprobando: isSupabaseConfigured && !degradado && mfaPendiente === null,

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
    [activeUser, loading, mfaPendiente, degradado],
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
