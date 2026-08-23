import { supabaseAlta, isSupabaseConfigured } from './supabase'
import { hermandadActualId } from './multiHermandad'

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
export type ResultadoDeAcceso = {
  id: string | null
  error: string | null
  /**
   * Cómo se ha llamado la cuenta por dentro. Hay que GUARDARLO en la ficha
   * (`correo_acceso`): es lo que la pantalla de entrar busca a partir del DNI.
   * Si se crea la cuenta y no se apunta, esa persona no entra nunca.
   */
  correoAcceso?: string | null
}

/**
 * CÓMO SE LLAMA POR DENTRO LA CUENTA DE UN HERMANO: hermandad + DNI.
 *
 * NO ES SU CORREO, y ahí está la gracia. Su correo vive en su ficha, sirve para
 * los avisos, es el MISMO en todas las hermandades donde sea hermano, y no se
 * toca. Esto es solo el nombre de la cuenta, que nadie ve ni teclea nunca:
 * quien entra elige hermandad, escribe su DNI y su contraseña.
 *
 * Se separan porque las cuentas de Supabase se identifican por correo, y el
 * correo es único en todo el sistema. Con la cuenta llamándose por su correo,
 * la SEGUNDA hermandad de una persona no podía crearle acceso —«ese correo ya
 * lo usa otra cuenta»— y esa persona se quedaba en el censo sin poder entrar.
 * En Andalucía ser hermano de dos o tres hermandades es lo normal.
 *
 * Tiene que dar exactamente lo mismo que `correo_de_acceso()` en el SQL: una
 * lo escribe al crear la cuenta y la otra lo lee al iniciar sesión, y si no
 * coincidieran esa persona no entraría nunca.
 */
export function correoDeAcceso(hermandadId: string, dni: string): string {
  const limpio = (dni ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const corto = hermandadId.replace(/-/g, '').slice(0, 12)
  return `${limpio}.${corto}@acceso.gobergo.com`
}

/**
 * La cuenta de un hermano: entra a su área con su DNI y su clave.
 *
 * El `dni` va en los datos de la cuenta porque el acceso del hermano se hace
 * por DNI, no por correo: la pantalla busca cómo se llama la cuenta a partir
 * del DNI y luego inicia sesión con ella.
 */
export async function crearAccesoHermano(
  email: string,
  password: string,
  dni: string,
  nombre: string,
): Promise<ResultadoDeAcceso> {
  /*
   * EL PRIMER PARÁMETRO SIGUE SIENDO SU CORREO, pero ya no es el nombre de la
   * cuenta: es el respaldo. La cuenta se llama por hermandad + DNI, y solo si
   * no se sabe de qué hermandad —cosa que no debería pasar— se cae al correo,
   * que es como se hacía antes.
   *
   * Se deja así, y no quitando el parámetro, porque los seis sitios que llaman
   * a esto ya tienen el correo a mano y ninguno tiene el id de la hermandad:
   * pedírselo obligaría a tocar los seis para no ganar nada.
   */
  const hermandadId = await hermandadActualId()
  const usuario = hermandadId ? correoDeAcceso(hermandadId, dni) : email
  const r = await crear(usuario, password, { tipo: 'hermano', dni, nombre }, '/hermano')
  return { ...r, correoAcceso: r.id && hermandadId ? usuario : null }
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
