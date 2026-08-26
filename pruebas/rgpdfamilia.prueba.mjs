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
export default async function ({ cargar, caso }) {
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
    conBase.indexOf('tutor_id') < conBase.indexOf(".from('hermanos').delete()"))
  caso('borra por id, no por correo a ciegas', true,
    /solicitudes_alta'\)\.delete\(\)\.in\('id'/.test(conBase))
  caso('ya no borra todo lo que comparta correo', false,
    /solicitudes_alta'\)\.delete\(\)\.eq\('email'/.test(conBase))
}
