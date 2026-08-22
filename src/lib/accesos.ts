import { supabaseAlta, isSupabaseConfigured } from './supabase'

/**
 * Crear la cuenta con la que una persona entra, y CONTAR si no se ha podido.
 *
 * Esto vivía metido dentro de la pantalla de Hermanos. Está aquí porque hacen
 * falta dos: una para el hermano (entra por /hermano con su DNI) y otra para
 * quien se da de alta como personal externo (entra por /login con su correo).
 * Duplicarlo dejaría dos versiones del mismo texto, y la que no se toca se
 * queda vieja.
 *
 * LO IMPORTANTE ES QUE DEVUELVE EL FALLO. Antes, cuando la cuenta no se podía
 * crear, se escribía en la consola del navegador y se seguía como si nada: la
 * ficha quedaba guardada, la pantalla decía que todo bien, y esa persona NO
 * PODÍA ENTRAR NUNCA. Nadie se enteraba hasta que llamaba preguntando por qué
 * no le funciona, semanas después, normalmente en marzo.
 *
 * Y la causa más común no es rara: el correo ya lo usa otra cuenta. El padre
 * que da de alta a su hijo con su propio correo, el matrimonio que comparte
 * dirección. Eso hay que decirlo en el momento y en cristiano.
 */
export type ResultadoDeAcceso = { id: string | null; error: string | null }

/**
 * La cuenta de un hermano: entra a su área con su DNI y su clave.
 *
 * El `dni` va en los datos de la cuenta porque el acceso del hermano se hace
 * por DNI, no por correo: la pantalla busca el correo a partir del DNI y luego
 * inicia sesión con él.
 */
export async function crearAccesoHermano(
  email: string,
  password: string,
  dni: string,
  nombre: string,
): Promise<ResultadoDeAcceso> {
  return crear(email, password, { tipo: 'hermano', dni, nombre }, '/hermano')
}

/**
 * La cuenta de quien no es hermano y trabaja en la hermandad: entra al panel
 * por /login con su correo.
 *
 * Se sigue pudiendo, pero ya no es el camino recomendado: para alguien que
 * está en el censo, lo suyo es ponerle el cargo en su ficha de hermano y que
 * tenga una sola identidad.
 */
export async function crearAccesoPersonal(
  email: string,
  password: string,
  nombre: string,
  cargo: string,
  hermandad?: string,
): Promise<ResultadoDeAcceso> {
  return crear(email, password, { nombre, cargo, hermandad }, '/login')
}

async function crear(
  email: string,
  password: string,
  datos: Record<string, unknown>,
  destino: string,
): Promise<ResultadoDeAcceso> {
  if (!isSupabaseConfigured || !supabaseAlta) return { id: null, error: null }
  // supabaseAlta: crea la cuenta sin pisar la sesión de quien la está creando.
  const { data, error } = await supabaseAlta.auth.signUp({
    email,
    password,
    options: { data: datos, emailRedirectTo: `${window.location.origin}${destino}` },
  })
  if (error) {
    console.error('No se pudo crear el acceso en Supabase:', error.message)
    return { id: null, error: explicarFalloDeAcceso(error.message, email) }
  }
  return { id: data.user?.id ?? null, error: null }
}

/** El fallo de crear la cuenta, contado para quien está en secretaría. */
export function explicarFalloDeAcceso(crudo: string, email: string): string {
  const t = crudo.toLowerCase()
  if (t.includes('already registered') || t.includes('already been registered') || t.includes('user already')) {
    return `La ficha se ha guardado, pero NO se ha creado su acceso: el correo ${email} ya lo usa otra cuenta. Ponle un correo suyo y vuelve a intentarlo desde su ficha.`
  }
  if (t.includes('password')) {
    return 'La ficha se ha guardado, pero NO se ha creado su acceso: la contraseña no cumple el mínimo que pide Supabase (seis caracteres).'
  }
  if (t.includes('invalid') && t.includes('email')) {
    return `La ficha se ha guardado, pero NO se ha creado su acceso: «${email}» no es una dirección de correo válida.`
  }
  return `La ficha se ha guardado, pero NO se ha creado su acceso (${crudo}). Hasta que se arregle, esta persona no podrá entrar.`
}
