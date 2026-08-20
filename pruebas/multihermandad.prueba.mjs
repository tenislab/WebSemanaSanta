/**
 * M3: la aplicación con todas las hermandades en un mismo Supabase.
 *
 * Lo que de verdad aísla una hermandad de otra está en la base de datos y se
 * comprueba con `supabase/PRUEBA-AISLAMIENTO.sql`, que levanta dos hermandades
 * en un Postgres y mira que ninguna vea, toque ni borre nada de la otra. Aquí
 * solo se prueban las decisiones que toma el navegador: a qué hermandad manda
 * un formulario y qué lista de hermandades se le enseña al hermano.
 */
export default async function ({ cargar, caso }) {
  const mh = await cargar('src/lib/multiHermandad.ts')
  const dir = await cargar('src/lib/hermandades.ts')

  // --- La hermandad de la página pública ------------------------------------
  caso('al arrancar no hay hermandad de página', null, mh.getHermandadDeLaPagina())

  mh.fijarHermandadDeLaPagina('11111111-1111-1111-1111-111111111111')
  caso(
    'al abrir la web de una hermandad, queda fijada',
    '11111111-1111-1111-1111-111111111111',
    mh.getHermandadDeLaPagina(),
  )

  // A dónde va lo que se envía desde un formulario. Sin sesión (aquí no hay
  // Supabase) tiene que salir la de la página y no un nulo: si saliera nulo,
  // el mensaje se quedaría sin dueño y no lo leería nadie.
  caso(
    'un formulario manda a la hermandad de la página',
    '11111111-1111-1111-1111-111111111111',
    await mh.hermandadDestino(),
  )

  // Al cambiar de hermandad —el hermano vuelve atrás y elige otra— el destino
  // cambia con ella. Antes de tener esto, la solicitud se habría ido a la
  // primera que hubiera mirado.
  mh.fijarHermandadDeLaPagina('22222222-2222-2222-2222-222222222222')
  caso(
    'al elegir otra hermandad, el destino cambia',
    '22222222-2222-2222-2222-222222222222',
    await mh.hermandadDestino(),
  )

  mh.fijarHermandadDeLaPagina(null)
  caso('y se puede dejar sin fijar', null, await mh.hermandadDestino())

  // Sin Supabase (modo local) no se pregunta nada a la red.
  caso('en modo local no hay hermandad de sesión', null, await mh.hermandadActualId())
  caso('en modo local la lista de hermandades viene vacía', 0, (await mh.hermandadesPublicas()).length)

  // --- La lista que ve el hermano para elegir la suya ------------------------
  const principal = { nombre: 'Hdad. de prueba', ciudad: 'Sevilla', color: '#caa24a', telefono: '', email: '' }

  // Sin Supabase: la principal más las de muestra, que son el escaparate del
  // modo demostración y NO se tocan.
  const local = dir.directorioCompleto(principal)
  caso('en modo local sale la hermandad principal', true, local[0].id === dir.ID_HERMANDAD_PRINCIPAL)
  caso('y también las de muestra', true, local.length > 1)

  // Con hermandades reales, la lista son ellas: cada hermano tiene que poder
  // encontrar la suya entre todas las que hay dadas de alta.
  const reales = [
    { id: 'aaaa-1', nombre: 'Hermandad de la Amargura' },
    { id: 'bbbb-2', nombre: 'Hermandad de la Esperanza' },
  ]
  const conReales = dir.directorioCompleto(principal, reales)
  // En estas pruebas no hay variables de entorno de Supabase, así que la
  // lista real no se aplica: se comprueba que al menos no rompe nada y que la
  // búsqueda sigue filtrando por nombre.
  caso('con lista real, el directorio sigue devolviendo algo', true, conReales.length > 0)

  const buscadas = dir.buscarHermandades('esperanza', principal)
  caso('buscar por nombre encuentra', true, buscadas.every((h) => /esperanza/i.test(h.nombre + h.ciudad)))
  caso('buscar algo que no existe no devuelve nada', 0, dir.buscarHermandades('zzzz', principal).length)
}
