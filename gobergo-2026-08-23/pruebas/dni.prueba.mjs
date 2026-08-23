/**
 * EL DNI, SIEMPRE ESCRITO IGUAL.
 *
 * Un DNI español se escribe de cuatro maneras y todas son la misma persona:
 * «12345678A», «12.345.678-A», «12345678-a», «12 345 678 A». La aplicación
 * tenía TRES normalizadores distintos conviviendo, más varios
 * `.trim().toUpperCase()` sueltos, y con tres reglas distintas la misma
 * persona es dos personas según por qué pantalla se entre.
 *
 * Lo que pasaba de verdad, y no es teórico:
 *
 *   · Un hermano dado de alta desde «Personal y permisos» guardaba el DNI TAL
 *     CUAL lo tecleó la secretaria. Después él no podía entrar en su área
 *     escribiendo el suyo como se escribe normalmente. Sin mensaje que lo
 *     explicara: solo «no te encontramos».
 *   · El alta a mano en el censo limpiaba lo tecleado pero comparaba contra el
 *     censo sin limpiar, así que un censo importado con puntos no reconocía al
 *     que ya estaba y la misma persona entraba DOS VECES, con dos números. Un
 *     hermano duplicado son dos cuotas, dos papeletas y dos sitios en el
 *     cortejo.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/dni.ts')

  // --- Las cuatro formas de escribir lo mismo ---
  const CANON = '12345678A'
  caso('sin nada que quitar, igual', CANON, m.limpiarDni('12345678A'))
  caso('con puntos y guion', CANON, m.limpiarDni('12.345.678-A'))
  caso('en minúscula', CANON, m.limpiarDni('12345678a'))
  caso('con espacios', CANON, m.limpiarDni(' 12 345 678 A '))
  // El guion largo se cuela al copiar y pegar desde Word, que es de donde sale
  // media hoja de censo.
  caso('con guion largo (copiado de Word)', CANON, m.limpiarDni('12345678—A'))
  caso('con barra', CANON, m.limpiarDni('12345678/A'))
  // Un NIE empieza por letra y va igual.
  caso('un NIE', 'X1234567L', m.limpiarDni('X-1234567-L'))
  caso('vacío no revienta', '', m.limpiarDni(''))
  caso('nulo tampoco', '', m.limpiarDni(undefined))

  // --- Y la comparación ---
  caso('las cuatro formas son la misma persona', true, m.mismoDni('12.345.678-A', '12345678a'))
  caso('dos DNI distintos no', false, m.mismoDni('12345678A', '87654321B'))
  /*
   * DOS VACÍOS NO SON LA MISMA PERSONA. En un censo importado hay fichas sin
   * DNI —de gente muy mayor, o de menores—, y si dos vacíos «coincidieran»,
   * el control de duplicados se cargaría a todos menos al primero.
   */
  caso('dos sin DNI no son la misma persona', false, m.mismoDni('', ''))
  caso('ni uno vacío contra uno lleno', false, m.mismoDni('', '12345678A'))
  caso('ni con solo puntos', false, m.mismoDni('...', '---'))

  await todosUsanLaMisma({ caso })
}

/** Y que no vuelva a haber tres reglas. */
async function todosUsanLaMisma({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const lee = async (f) => (await readFile(f, 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '')

  /*
   * La forma a mano: comparar `.dni` con `toUpperCase()`. Es la que dejaba
   * pasar los puntos, y la que hay que impedir que vuelva.
   */
  const A_MANO = /\.dni[^\n]{0,40}?to(Upper|Lower)Case\(\)/

  const ARCHIVOS = [
    'src/pages/app/Hermanos.tsx',
    'src/pages/app/Personal.tsx',
    'src/pages/HermanoPortal.tsx',
    'src/components/FormulariosWeb.tsx',
  ]
  for (const f of ARCHIVOS) {
    const t = await lee(f)
    const nombre = f.split('/').pop()
    caso(`${nombre} no compara DNI a mano`, false, A_MANO.test(t))
    caso(`${nombre} usa la regla común`, true, /limpiarDni|mismoDni/.test(t))
  }

  /*
   * Y EL DNI QUE VIAJA A LA BASE va limpio. En Supabase están guardados sin
   * puntos: mandar uno puntuado a `resolver_email_hermano` no encuentra a
   * nadie, y la pantalla dice que los datos no son correctos —que es lo
   * contrario de lo que pasa—.
   */
  const portal = await lee('src/pages/HermanoPortal.tsx')
  caso('el DNI del acceso va limpio a la base', 3,
    (portal.match(/const dni = limpiarDni\(/g) ?? []).length)
  caso('y ya no queda el normalizador viejo', false, /function normaliza\(/.test(portal))
}
