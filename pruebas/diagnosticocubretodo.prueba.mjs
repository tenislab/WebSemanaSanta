/**
 * EL DIAGNÓSTICO TIENE QUE MIRAR TODAS LAS FUNCIONES QUE LA APLICACIÓN LLAMA.
 *
 * ============================================================================
 * DE DÓNDE SALE ESTO
 * ============================================================================
 *
 * `DIAGNOSTICO.sql` es lo que se pega en Supabase para saber si a una base le
 * falta algo. Entre otras cosas lleva una lista de las funciones que tienen que
 * existir, y esa lista la escribe `scripts/generar-diagnostico.mjs` buscando
 * `supabase.rpc('…')` por el código.
 *
 * Y lo buscaba en TRES CARPETAS A MANO, sin bajar a las subcarpetas:
 * `src/pages`, `src/pages/app` y `src/components`, un nivel cada una. En cuanto
 * una pantalla se partió en su propia carpeta, lo de dentro se volvió
 * invisible: `src/pages/portal/Identificarse.tsx` llama a
 * `resolver_email_hermano` —la función con la que el hermano ENTRA— y al
 * mudarse ahí la función se cayó de la lista.
 *
 * O sea: a una hermandad a la que le faltara esa función en la base, el
 * diagnóstico le habría dicho que todo estaba bien y el «entrar» no le
 * funcionaría, sin relación aparente entre las dos cosas.
 *
 * ============================================================================
 * POR QUÉ HACE FALTA ESTA PRUEBA Y NO BASTA LA QUE YA HABÍA
 * ============================================================================
 *
 * Ya hay una que comprueba que `DIAGNOSTICO.sql` está al día, y NO PUEDE CAZAR
 * ESTO: compara el fichero con lo que sale de volver a generarlo, así que con
 * el generador ciego los dos coinciden —mal a la vez— y sale verde. Medido con
 * `scripts/romper.sh`: se dejó el generador mirando un solo nivel y las 5.619
 * comprobaciones siguieron pasando.
 *
 * Lo que hace falta es una de COBERTURA: no «¿coinciden?», sino «¿está todo lo
 * que la aplicación usa?». Esta lee el código ella misma, recorriendo de verdad.
 */
export default async function ({ caso }) {
  const { readdir, readFile } = await import('node:fs/promises')

  async function todos(dir) {
    const salida = []
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const ruta = `${dir}/${e.name}`
      if (e.isDirectory()) salida.push(...(await todos(ruta)))
      else if (/\.tsx?$/.test(e.name)) salida.push(ruta)
    }
    return salida
  }

  // Lo que la aplicación llama de verdad, recorriendo `src` y `api` enteros.
  const llamadas = new Map()
  for (const f of [...(await todos('src')), ...(await todos('api'))]) {
    const src = await readFile(f, 'utf8')
    for (const m of src.matchAll(/\.rpc\(\s*'([a-z_0-9]+)'/g)) {
      if (!llamadas.has(m[1])) llamadas.set(m[1], f)
    }
  }
  caso('se encuentran las funciones que llama la aplicación', true, llamadas.size >= 30)

  const diag = await readFile('supabase/DIAGNOSTICO.sql', 'utf8')
  const enLaLista = new Set([...diag.matchAll(/^\s*\('([a-z_0-9]+)'\),?\s*$/gm)].map((m) => m[1]))
  caso('y la lista del diagnóstico se lee', true, enLaLista.size >= 30)

  /*
   * LA COMPROBACIÓN QUE IMPORTA. El mensaje lleva el fichero donde está la
   * llamada: sin eso, «falta tal función» manda a buscarla por todo el código.
   */
  const sinVigilar = [...llamadas].filter(([fn]) => !enLaLista.has(fn))
  caso('el diagnóstico mira todas las funciones que la aplicación llama', [],
    sinVigilar.map(([fn, donde]) => `${fn} (en ${donde})`))

  /*
   * Y LA QUE LO EMPEZÓ TODO, por su nombre: es la que usa el hermano para
   * entrar, la única de la lista que puede dejar a una hermandad entera fuera
   * de su área sin que nada más se note.
   */
  caso('la función con la que entra el hermano está vigilada', true, enLaLista.has('resolver_email_hermano'))
  caso('y se llama desde donde se mudó la pantalla', true,
    (llamadas.get('resolver_email_hermano') ?? '').includes('src/pages/portal/'))

  /*
   * Y QUE EL GENERADOR RECORRA DE VERDAD. Es el cable: la lista puede estar
   * completa hoy y volverse a quedar corta mañana en cuanto alguien añada una
   * carpeta, que es exactamente lo que pasó.
   */
  const gen = await readFile('scripts/generar-diagnostico.mjs', 'utf8')
  caso('el generador baja a las subcarpetas', true, /async function todasLasPantallas\(/.test(gen))
  caso('y no vuelve a listar carpetas a mano', false,
    /readdir\('src\/pages\/app'\)/.test(gen) || /readdir\('src\/components'\)\)\.filter/.test(gen))
}
