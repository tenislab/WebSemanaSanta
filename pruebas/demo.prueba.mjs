/**
 * EL MODO DEMOSTRACIÓN NO PUEDE ASOMAR EN UNA HERMANDAD DE VERDAD.
 *
 * Llegó mirando una captura: «en tu captura sale el modo demo que dejamos
 * atrás hace muchísimo». La captura era mía y estaba hecha sin conectar
 * Supabase, que es justo lo que enciende la demostración —así que ahí no
 * había fallo—, pero la pregunta destapó uno que sí lo era.
 *
 * LO QUE ESTÁ EN JUEGO. La pantalla de entrar, en demostración, enseña
 * usuarios y contraseñas escritos en claro; y la del hermano enseña el DNI y
 * la clave de acceso de cuatro hermanos del censo. Con Supabase conectado ese
 * censo no es de ejemplo: es el REAL. Que eso aparezca en una página pública
 * es una fuga de datos personales, no un detalle de presentación.
 *
 * Y la marca que la demostración deja guardada decidía, además, si la
 * aplicación lee de la base o del navegador.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')

  /*
   * 1. LA MARCA VIEJA NO PUEDE MANDAR SOBRE LA BASE DE DATOS.
   *
   * Solo se puede encender desde pantallas que exigen que NO haya Supabase,
   * así que con Supabase configurado y la marca puesta, es un resto: de
   * cuando esto se probaba sin base de datos, o de un navegador que jugó con
   * la demostración antes del despliegue.
   *
   * Y ese resto no era inofensivo: `useSupabaseTable` decide al montarse si
   * lee de la base o del navegador, y esta función era la mitad de esa
   * decisión. Con la marca vieja, la secretaría trabajaba contra su propio
   * navegador —altas, cuotas, papeletas— sin escribir en la base y sin un
   * solo aviso. Se limpiaba al iniciar sesión, pero eso llega tarde si la
   * tabla ya se montó.
   */
  const demo = await cargar('src/lib/demo.ts')
  localStorage.setItem('cabildo-demo-modo', 'llena')
  // En estas pruebas no hay Supabase configurado, así que aquí la marca SÍ
  // vale: es el caso para el que se hizo la demostración.
  caso('sin base de datos, la marca vale', true, demo.modoDemoActivo())
  localStorage.removeItem('cabildo-demo-modo')

  // Y con base de datos no puede valer, haya lo que haya guardado. Se
  // comprueba en el código porque `isSupabaseConfigured` se fija al arrancar.
  const src = await readFile('src/lib/demo.ts', 'utf8')
  const cuerpo = src.slice(src.indexOf('export function modoDemoActivo'))
  caso('con base de datos, la marca no vale', true,
    /if \(isSupabaseConfigured\) return false/.test(cuerpo.slice(0, cuerpo.indexOf('\n}'))))

  /*
   * 2. NINGUNA PANTALLA DE DEMOSTRACIÓN SIN SU GUARDA.
   *
   * Cada bloque que enseña credenciales tiene que estar detrás de una
   * condición que exija que NO hay Supabase. Se comprueba que la guarda
   * exista y que salga de `isSupabaseConfigured`, no de una variable suelta
   * que alguien pueda poner a `true` sin querer.
   */
  const auth = await readFile('src/components/AuthForm.tsx', 'utf8')
  caso('el bloque de entrar está guardado', true, /\{!configured && mode === 'login' &&/.test(auth))
  // `configured` viene de `useAuth()`, y allí sale de `isSupabaseConfigured`.
  // Se comprueba en su origen: si mañana alguien lo definiera de otra forma,
  // el bloque de credenciales podría salir con la base conectada.
  const ctx = await readFile('src/context/AuthContext.tsx', 'utf8')
  caso('y «configured» sale de Supabase', true,
    /configured: isSupabaseConfigured/.test(ctx))

  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  caso('el del área del hermano también', true, /\{hayDemo && \(/.test(portal))
  caso('y su guarda es Supabase', true, /const hayDemo = !isSupabaseConfigured/.test(portal))
  // Los hermanos que se ofrecen de un clic salen de la MISMA guarda: si se
  // separase, con Supabase caído se enseñaría el DNI del censo real.
  caso('los accesos rápidos cuelgan de esa guarda', true, /hayDemo \? hermanos\.filter/.test(portal))

  /*
   * 3. «Tu hermandad (modo demo)» ES UN NOMBRE DE RESPALDO, NO UN MODO.
   *
   * Es lo que se lee cuando la hermandad no tiene nombre puesto, y solo en la
   * rama sin Supabase. Con base de datos, la lista son las hermandades dadas
   * de alta de verdad: aunque venga vacía, porque un hermano que entrara en
   * esa entrada falsa pediría el alta en una hermandad que no existe.
   */
  const herm = await readFile('src/lib/hermandades.ts', 'utf8')
  const dir = herm.slice(herm.indexOf('export function directorioCompleto'))
  // Se corta en el TEXTO, no en el comentario que lo explica (que vive dentro
  // de la propia rama de Supabase y cortaría demasiado pronto).
  const antesDelNombre = dir.slice(0, dir.search(/'[^']*modo demo\)'/))
  // Solo el texto de verdad, no el comentario que explica por qué está ahí.
  caso('solo hay un texto que diga «modo demo»', 1,
    (herm.match(/'[^']*modo demo\)'/g) ?? []).length)
  caso('y la rama con base de datos vuelve antes', true,
    /if \(isSupabaseConfigured\)[\s\S]*return reales\.map/.test(antesDelNombre))
}
