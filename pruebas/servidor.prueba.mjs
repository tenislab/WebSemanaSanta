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
     * Y que RESPONDA, no solo que cargue. Un fallo dentro del manejador no se
     * ve al importar: se ve cuando entra alguien.
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
  }

  // Y que no se vuelva a colar el import que lo rompió. Las funciones de
  // servidor solo pueden tocar ficheros que no sepan nada del navegador.
  const { readFile } = await import('node:fs/promises')
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
}
