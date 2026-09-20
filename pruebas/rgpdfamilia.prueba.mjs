/**
 * EL DERECHO DE SUPRESIÓN NO PUEDE LLEVARSE POR DELANTE A LA FAMILIA.
 *
 * Al borrar los datos de un hermano hay que borrar también su SOLICITUD DE
 * ALTA, que lleva su nombre, su DNI, su correo y su teléfono. Como la
 * solicitud es anterior a su ficha, no hay ningún identificador que las una:
 * se busca por DNI y por correo.
 *
 * Y por correo estaba el agujero. El alta de un menor lleva EL CORREO DE SU
 * TUTOR, y está escrito así a propósito —«del menor no se pide correo ni
 * contraseña: entra su tutor por él» (HermanoPortal)—. Así que el padre que
 * ejercía su derecho de supresión se llevaba de paso las solicitudes de alta
 * PENDIENTES de todos sus hijos: desaparecían del panel, secretaría no las
 * veía, y nadie recibía ningún aviso. Se descubriría preguntando por qué el
 * niño no sale en el cortejo.
 *
 * Y un segundo agujero al lado: comparar cadenas vacías. Un censo importado
 * de una hoja sin columna de DNI deja a todo el mundo con `dni: ''` (ver
 * `importar.ts`), y `'' === ''`, así que borrar a uno de esos se llevaba
 * TODAS las solicitudes que tampoco tuvieran DNI.
 */
import { antesQue } from './fuentes.mjs'
export default async function ({ cargar, caso }) {
  await laRamaDeLaBase({ caso })
  const m = await cargar('src/lib/rgpd.ts')

  const CLAVE_SOL = 'cabildo-solicitudes-alta'

  async function borrarY(censo, solicitudes, id) {
    localStorage.clear()
    localStorage.setItem('cabildo-hermanos', JSON.stringify(censo))
    localStorage.setItem('cabildo-cuotas', '[]')
    localStorage.setItem('cabildo-papeletas', '[]')
    localStorage.setItem('cabildo-incidencias', '[]')
    localStorage.setItem(CLAVE_SOL, JSON.stringify(solicitudes))
    await m.borrarDatosHermano(id)
    return JSON.parse(localStorage.getItem(CLAVE_SOL))
  }

  // 1. LA FAMILIA. El padre se va; las solicitudes de sus hijos se quedan.
  {
    const censo = [
      { id: 'padre', nombre: 'El padre', dni: '11111111A', email: 'casa@ejemplo.es' },
      { id: 'otro', nombre: 'Otro', dni: '22222222B', email: 'otro@ejemplo.es' },
    ]
    const sol = [
      // La suya: mismo DNI. Se va.
      { id: 's1', nombre: 'El padre', dni: '11111111A', email: 'casa@ejemplo.es' },
      // La de su hijo: el correo de su padre, pero es del niño. Se queda.
      { id: 's2', nombre: 'Su hijo', dni: '33333333C', email: 'casa@ejemplo.es', tutorId: 'padre' },
      // La de su hija: igual. Se queda.
      { id: 's3', nombre: 'Su hija', dni: '44444444D', email: 'casa@ejemplo.es', tutorId: 'padre' },
      // Y la de un desconocido, que no se toca pase lo que pase.
      { id: 's4', nombre: 'Nadie', dni: '55555555E', email: 'nadie@ejemplo.es' },
    ]
    const quedan = await borrarY(censo, sol, 'padre')
    caso('la suya se borra', false, quedan.some((s) => s.id === 's1'))
    caso('la de su hijo NO se borra', true, quedan.some((s) => s.id === 's2'))
    caso('ni la de su hija', true, quedan.some((s) => s.id === 's3'))
    caso('y la de un desconocido tampoco', true, quedan.some((s) => s.id === 's4'))
    caso('quedan tres', 3, quedan.length)
  }

  /*
   * 2. DOS VACÍOS NO SON LA MISMA PERSONA.
   *
   * El caso llega de un censo importado de una hoja sin columna de DNI: todo
   * el mundo con cadena vacía. Comparando a secas se borraba todo lo que
   * tampoco tuviera DNI, que es medio panel de solicitudes.
   */
  {
    const censo = [{ id: 'x', nombre: 'Sin papeles', dni: '', email: '' }]
    const sol = [
      { id: 'v1', nombre: 'Uno sin dni', dni: '', email: 'uno@ejemplo.es' },
      { id: 'v2', nombre: 'Otro sin dni', dni: '', email: 'dos@ejemplo.es' },
      { id: 'v3', nombre: 'Sin nada', dni: '', email: '' },
    ]
    const quedan = await borrarY(censo, sol, 'x')
    caso('sin DNI no se arrastra a los demás', 3, quedan.length)
  }

  // 3. Y lo que SÍ tiene que seguir funcionando: por correo, cuando la
  //    solicitud es de un adulto y el DNI no coincide (un cambio de formato,
  //    una errata al pasarlo a la ficha).
  {
    const censo = [{ id: 'a', nombre: 'Adulta', dni: '99999999Z', email: 'suya@ejemplo.es' }]
    const sol = [
      { id: 'c1', nombre: 'Adulta', dni: '9999999-9Z', email: 'suya@ejemplo.es' },
      { id: 'c2', nombre: 'Ajena', dni: '88888888Y', email: 'ajena@ejemplo.es' },
    ]
    const quedan = await borrarY(censo, sol, 'a')
    caso('por correo sigue borrando la de un adulto', false, quedan.some((s) => s.id === 'c1'))
    caso('y no toca la de otro', true, quedan.some((s) => s.id === 'c2'))
  }

  /*
   * 4. Y EL CAMINO DE LA BASE DE DATOS, QUE ES EL DE PRODUCCIÓN.
   *
   * Lo de arriba se ejecuta de verdad, pero solo prueba la rama local (sin
   * Supabase). La otra hace lo mismo contra la base y no se puede llamar
   * desde aquí, así que al menos se comprueba que sigue la misma regla — que
   * es justo lo que se separó una vez: la rama de la base ya se guardaba de
   * los vacíos (`if (suDni)`) y la local no.
   *
   * Y una cosa más, que es la que tiene trampa: `solicitudes_alta.tutor_id`
   * es `on delete set null`. En cuanto desaparece la ficha del padre, las
   * solicitudes de sus hijos se quedan sin tutor y ya no hay forma de
   * distinguirlas de las suyas. Por eso hay que mirarlas ANTES de borrar.
   */
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/lib/rgpd.ts', 'utf8')
  // Desde el principio de ESTA función hasta donde empieza la rama local. Sin
  // anclar en la función se cogía otro `todos()` anterior del mismo archivo y
  // el trozo salía vacío.
  const desde = src.indexOf('export async function borrarDatosHermano')
  const conBase = src.slice(desde, src.indexOf('= todos()', desde))

  caso('la rama de la base mira el tutor', true, /tutor_id/.test(conBase))
  caso('y decide antes de borrar la ficha', true,
    antesQue(conBase, 'tutor_id', ".from('hermanos').delete()"))
  caso('borra por id, no por correo a ciegas', true,
    /solicitudes_alta'\)\.delete\(\)\.in\('id'/.test(conBase))
  caso('ya no borra todo lo que comparta correo', false,
    /solicitudes_alta'\)\.delete\(\)\.eq\('email'/.test(conBase))
}

/**
 * Y LA RAMA DE LA BASE, QUE ES LA QUE USA UNA HERMANDAD DE VERDAD.
 *
 * Todo lo de arriba recorre el camino de `localStorage`, que es el del modo
 * demostración. La rama de Supabase —la de una hermandad con su base
 * conectada— no se probaba, y ahí dentro había una consulta cuyo error nadie
 * miraba: la que saca el DNI y el correo de la ficha para poder encontrar
 * después su solicitud de alta.
 *
 * QUÉ PASABA. Si esa consulta falla —red, permisos, tiempo de espera—, el DNI y
 * el correo quedan vacíos, el filtro de búsqueda se queda vacío, el bloque que
 * borra las solicitudes NO LLEGA A ENTRAR... y la ficha se borraba igual. La
 * función devolvía `{ ok: true }` y la pantalla enseñaba «datos suprimidos»,
 * con una fila en `solicitudes_alta` que seguía llevando el nombre, el DNI, el
 * correo y el teléfono de quien acababa de ejercer el artículo 17.
 *
 * Se comprueba con un Supabase de mentira al que se le escribe el guion
 * (`stub-supabase-guion.mjs`), y mirando DOS cosas: qué devuelve la función y
 * QUÉ LLEGÓ A PEDIRLE A LA BASE. Lo segundo es lo que de verdad lo prueba: que
 * el `delete hermanos` no aparezca es lo que dice que no se ha borrado nada.
 */
async function laRamaDeLaBase({ caso }) {
  const { build } = await import('esbuild')
  const { writeFileSync, mkdtempSync } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { tmpdir } = await import('node:os')
  const { fileURLToPath } = await import('node:url')
  const aqui = dirname(fileURLToPath(import.meta.url))
  const raiz = join(aqui, '..')

  const res = await build({
    entryPoints: [join(raiz, 'src/lib/rgpd.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    alias: { '@supabase/supabase-js': join(aqui, 'stub-supabase-guion.mjs') },
    /*
     * CONFIGURADO, y es la única forma de entrar en esta rama:
     * `isSupabaseConfigured` sale de estas dos variables, y el arranque normal
     * de las pruebas las deja vacías a propósito.
     */
    define: {
      'import.meta.env': JSON.stringify({
        VITE_SUPABASE_URL: 'https://ejemplo.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'clave-de-mentira',
      }),
    },
  })
  const salida = mkdtempSync(join(tmpdir(), 'rgpd-base-'))
  const destino = join(salida, 'rgpd.mjs')
  writeFileSync(destino, res.outputFiles[0].text)
  const m = await import(destino)

  const borrarCon = async (guion) => {
    globalThis.__GUION = guion
    globalThis.__LLAMADAS = []
    const r = await m.borrarDatosHermano('h1')
    return { r, llamadas: globalThis.__LLAMADAS }
  }

  const BIEN = {
    'select:uno hermanos': { data: { dni: '11111111A', email: 'yo@ejemplo.es' }, error: null },
    'select solicitudes_alta': { data: [{ id: 's1', dni: '11111111A', tutor_id: null }], error: null },
    'delete hermanos': { data: null, error: null },
    'delete solicitudes_alta': { data: null, error: null },
    'select hermanos': { data: [], error: null },
  }

  // 1. Cuando todo va bien: se borran las DOS cosas.
  {
    const { r, llamadas } = await borrarCon(BIEN)
    caso('con la base al día, la supresión sale bien', true, r.ok)
    caso('se borra la ficha', true, llamadas.includes('delete hermanos'))
    caso('y se borra su solicitud de alta', true, llamadas.includes('delete solicitudes_alta'))
    caso('y se mira el DNI antes de borrar', true,
      llamadas.indexOf('select:uno hermanos') < llamadas.indexOf('delete hermanos'))
  }

  // 2. Y cuando falla la consulta del DNI: NO SE BORRA NADA.
  {
    const { r, llamadas } = await borrarCon({
      ...BIEN,
      'select:uno hermanos': { data: null, error: { message: 'fetch failed', code: '' } },
    })
    caso('si no se puede leer su DNI, NO se borra la ficha', false, llamadas.includes('delete hermanos'))
    caso('ni se da la supresión por hecha', false, r.ok)
    caso('y se dice qué hacer', true, String(r.queHacer ?? '').includes('solicitud de alta'))
  }

  // 3. El caso que abría el agujero, dicho al derecho: no puede pasar que se
  //    borre la ficha y NO la solicitud devolviendo que todo ha ido bien.
  {
    const { r, llamadas } = await borrarCon({
      ...BIEN,
      'select:uno hermanos': { data: null, error: { message: 'timeout', code: '' } },
    })
    const certificaAMedias = r.ok
      && llamadas.includes('delete hermanos')
      && !llamadas.includes('delete solicitudes_alta')
    caso('nunca se certifica una supresión a medias', false, certificaAMedias)
  }

  // 4. Y una ficha que de verdad no existe (data null SIN error) no es un
  //    fallo: ahí no hay solicitud que buscar y el borrado sigue su camino.
  {
    const { r, llamadas } = await borrarCon({ ...BIEN, 'select:uno hermanos': { data: null, error: null } })
    caso('una ficha que no está no bloquea el borrado', true, r.ok)
    caso('y la ficha se borra igual', true, llamadas.includes('delete hermanos'))
  }
}
