/**
 * Que las funciones del servidor ARRANQUEN.
 *
 * EL FALLO QUE COSTÓ LA PORTADA: `api/w.ts` importaba `src/lib/seoWeb`, que
 * importaba `src/lib/webPublica`, que importa `./supabase`, cuya primera línea
 * es
 *
 *     const url = import.meta.env.VITE_SUPABASE_URL
 *
 * `import.meta.env` es cosa de Vite: en el navegador existe, en el servidor
 * NO. Así que la función reventaba al arrancar, antes de ejecutar una sola
 * línea nuestra:
 *
 *     TypeError: Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')
 *
 * Y como `vercel.json` manda a esa función la RAÍZ del dominio y todas las
 * webs de hermandad, lo que se veía en gobergo.com era «This Serverless
 * Function has crashed · 500». La puerta principal caída sin que nada de la
 * aplicación estuviera mal.
 *
 * No se veía de ninguna forma: en desarrollo esa función no se ejecuta, el
 * `tsc` no se queja (los tipos son correctos), el `build` no la toca y las
 * pruebas no la arrancaban. Solo se veía en producción, y en producción se
 * veía como una pantalla de error de Vercel.
 *
 * Esta prueba la CONSTRUYE igual que Vercel —a paquete de Node— y la importa.
 * Si alguien vuelve a colar un import de navegador, salta aquí.
 */
export default async function ({ caso }) {
  const { build } = await import('esbuild')
  const { readFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { mkdtempSync } = await import('node:fs')
  const { join } = await import('node:path')

  const salida = mkdtempSync(join(tmpdir(), 'gobergo-api-'))

  for (const funcion of ['w', 'seo']) {
    const destino = join(salida, `${funcion}.mjs`)
    let construida = true
    try {
      await build({
        entryPoints: [`api/${funcion}.ts`],
        bundle: true,
        platform: 'node',
        format: 'esm',
        outfile: destino,
        logLevel: 'silent',
      })
    } catch {
      construida = false
    }
    caso(`api/${funcion}.ts se construye`, true, construida)
    if (!construida) continue

    // Y AHORA LO QUE DE VERDAD IMPORTA: que se pueda importar sin reventar.
    // Eso es exactamente lo que hace Vercel al arrancarla en frío.
    let arranca = true
    let motivo = ''
    try {
      const modulo = await import(destino)
      caso(`api/${funcion}.ts exporta su manejador`, 'function', typeof modulo.default)
    } catch (e) {
      arranca = false
      motivo = String(e).split('\n')[0]
    }
    caso(`api/${funcion}.ts arranca${motivo ? ' — ' + motivo : ''}`, true, arranca)
    if (!arranca) continue

    /*
     * EL TAMAÑO, que es la señal más afilada de todas.
     *
     * Cuando se coló el import malo, `@supabase/supabase-js` entero acabó
     * DENTRO del paquete de la función: 896 KB en vez de 10. Ese número es
     * imposible de conseguir con código nuestro —son tres ficheros de texto—,
     * así que un salto ahí significa siempre lo mismo: alguien ha vuelto a
     * importar media aplicación en una función de servidor.
     *
     * Vale la pena aunque el arranque ya se compruebe arriba: una biblioteca
     * de navegador puede colarse y no reventar hasta que se use, y entonces el
     * fallo sale en producción y con un usuario delante.
     */
    const { statSync } = await import('node:fs')
    const kb = Math.round(statSync(destino).size / 1024)
    caso(`api/${funcion}.ts pesa poco (${kb} kB)`, true, kb < 100)

    /*
     * Y QUE NO SE COLARA UN IMPORT DE ARRIBA.
     *
     * Un `import` de la cabecera se resuelve AL CARGAR el módulo, antes de que
     * exista la red de seguridad de dentro. Si falla, Vercel devuelve un 500 y
     * no hay nada que lo pare. Por eso lo que hace falta se pide con
     * `await import(...)` dentro del try: si algún día vuelve a arrastrar
     * código de navegador, la página se sirve sin adornar en vez de caerse.
     *
     * Los `import type` no cuentan: los borra el compilador.
     */
    const fuente = await readFile(`api/${funcion}.ts`, 'utf8')
    caso(`api/${funcion}.ts no importa nada de src arriba`, false,
      /^import (?!type )[^\n]*from '\.\.\/src\//m.test(fuente))
    caso(`api/${funcion}.ts lo pide dentro del manejador`, true,
      /await import\('\.\.\/src\/lib\/seoWeb'\)/.test(fuente))
    // Y que el manejador esté envuelto: sin eso, la red no existe.
    caso(`api/${funcion}.ts tiene red de seguridad`, true,
      /export default async function handler[\s\S]{0,200}try \{\s*await servir\(req, res\)/.test(fuente))

    /*
     * Y que RESPONDA, no solo que cargue. Un fallo dentro del manejador no se
     * ve al importar: se ve cuando entra alguien.
     *
     * SE PRUEBA DE DOS MANERAS: sin variables de entorno y CON ellas. La
     * primera vez que se probó esto solo se hizo sin ellas, y con eso la
     * función ni siquiera llega a consultar Supabase —`consulta()` se sale en
     * la primera línea— así que la mitad del código no se ejecutaba. En
     * producción esas variables SÍ están puestas.
     *
     * El servidor de mentira apunta a una dirección que no existe: eso obliga
     * a recorrer el camino de «la consulta falla», que es justo el que no se
     * había probado nunca.
     */
    for (const url of ['/', '/w/una-hermandad', '/n/una-noticia']) {
      const r = { code: 0, body: '' }
      const res = {
        status(c) { r.code = c; return this },
        setHeader() {},
        send(b) { r.body = b ?? '' },
      }
      let respondio = true
      let fallo = ''
      try {
        const modulo = await import(destino)
        await modulo.default({ url, headers: { host: 'gobergo.com' } }, res)
      } catch (e) {
        respondio = false
        fallo = String(e).split('\n')[0]
      }
      caso(`api/${funcion}.ts responde a ${url}${fallo ? ' — ' + fallo : ''}`, true, respondio)
      // Nunca un 500 en la puerta: sin base de datos ni red, se sirve la
      // página sin adornar, pero se sirve.
      caso(`api/${funcion}.ts no devuelve 500 en ${url}`, false, r.code >= 500)
    }

    // Y ahora CON credenciales, que es como está en producción.
    const antes = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY }
    process.env.SUPABASE_URL = 'https://no-existe-a-proposito.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'clave-de-mentira'
    try {
      for (const url of ['/', '/w/una-hermandad']) {
        const r = { code: 0, body: '' }
        const res = { status(c) { r.code = c; return this }, setHeader() {}, send(b) { r.body = b ?? '' } }
        let respondio = true
        let fallo = ''
        try {
          const modulo = await import(destino)
          await modulo.default({ url, headers: { host: 'gobergo.com' } }, res)
        } catch (e) {
          respondio = false
          fallo = String(e).split('\n')[0]
        }
        caso(`api/${funcion}.ts responde a ${url} con credenciales${fallo ? ' — ' + fallo : ''}`, true, respondio)
        caso(`api/${funcion}.ts no devuelve 500 en ${url} con credenciales`, false, r.code >= 500)
      }
    } finally {
      if (antes.url === undefined) delete process.env.SUPABASE_URL
      else process.env.SUPABASE_URL = antes.url
      if (antes.key === undefined) delete process.env.SUPABASE_ANON_KEY
      else process.env.SUPABASE_ANON_KEY = antes.key
    }
  }

  // Y que no se vuelva a colar el import que lo rompió. Las funciones de
  // servidor solo pueden tocar ficheros que no sepan nada del navegador.
  for (const funcion of ['w', 'seo']) {
    const fuente = await readFile(`api/${funcion}.ts`, 'utf8')
    caso(`api/${funcion}.ts no importa webPublica en tiempo de ejecución`, false,
      /^import \{[^}]*\} from '\.\.\/src\/lib\/webPublica'/m.test(fuente))
  }
  const seo = await readFile('src/lib/seoWeb.ts', 'utf8')
  caso('seoWeb tira del fichero puro', true, seo.includes("from './webPublicaPuro'"))
  const puro = await readFile('src/lib/webPublicaPuro.ts', 'utf8')
  // El fichero puro no importa NADA en tiempo de ejecución, solo tipos.
  caso('el fichero puro solo importa tipos', false, /^import (?!type )/m.test(puro))

  // La red de seguridad: pase lo que pase, nunca un 500 en la puerta.
  const w = await readFile('api/w.ts', 'utf8')
  caso('la función lleva red de seguridad', true, /try \{\n\s*await servir\(req, res\)/.test(w))
  caso('y si falla sirve la página sin adornar', true,
    /se sirve la página sin adornar/.test(w))

  // El idioma sale de la hermandad, y limpio. Si alguien vuelve a meter el
  // valor crudo en el HTML, salta aquí.
  caso('el idioma del HTML sale de la hermandad', true, /lang="\$\{idioma\}"/.test(w))
  caso('y pasa por el filtro', true, /const idioma = idiomaSeguro\(web\.idioma\)/.test(w))
}
