/**
 * EL HIDRATADOR: que de verdad vaya a buscar las cinco.
 *
 * `pruebas/plantillas.prueba.mjs` comprueba el código fuente —que ninguna
 * plantilla se guarde sin que alguien la lea—. Esta comprueba lo otro: que al
 * llamar a `hidratarPlantillas()` SALGAN las cinco peticiones y que lo que
 * vuelve acabe en `localStorage`, que es de donde tiran las quince pantallas.
 *
 * Se hace poniendo un doble en `plantillasHermandad` —el punto por el que pasan
 * las cinco— y mirando qué pide. Sin red y sin base de datos: lo que se está
 * comprobando no es que Supabase funcione, es que la llamada exista. El fallo
 * que se está evitando es exactamente ese: cuatro funciones escritas, correctas
 * y probadas, y nadie llamándolas. Con el dato ya en `localStorage` —el
 * ordenador donde se programa— todo parecía bien.
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = join(aqui, '..')

export default async function ({ caso }) {
  /*
   * Se compila el hidratador con el almacén de plantillas cambiado por el
   * doble. Todo lo demás —los cinco módulos, sus eventos, `localStorage`— es
   * el código de verdad.
   */
  const salida = mkdtempSync(join(tmpdir(), 'hidratar-'))
  const res = await build({
    entryPoints: [join(raiz, 'src/lib/hidratar.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    alias: {
      '@supabase/supabase-js': join(aqui, 'stub-supabase.mjs'),
    },
    plugins: [{
      name: 'doble-de-plantillas',
      setup(b) {
        /*
         * `external: true` no es un detalle: sin él, esbuild METE el doble
         * DENTRO del paquete, y entonces la prueba mira una copia distinta de
         * la que usa el código. Se veían cero peticiones con las cinco
         * hechas.
         */
        b.onResolve({ filter: /plantillasHermandad$/ }, () => ({
          path: join(aqui, 'stub-plantillas.mjs'),
          external: true,
        }))
      },
    }],
    define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }) },
  })
  const destino = join(salida, 'hidratar.mjs')
  writeFileSync(destino, res.outputFiles[0].text)
  const m = await import(destino)
  const doble = await import('./stub-plantillas.mjs')

  /* ------------------------------------------------------------------
     LAS CINCO SE PIDEN
     ------------------------------------------------------------------ */
  doble.reiniciar()
  localStorage.clear()
  await m.hidratarPlantillas()

  caso(
    'se piden las cinco ligeras',
    ['ajustes_cuotas', 'asistencia', 'campana', 'campos_propios', 'etiquetas'],
    [...doble.pedidas].sort(),
  )
  /*
   * Y NINGUNA DE LAS DOS QUE PESAN. Llevan dentro la imagen escaneada del
   * modelo: traerlas en cada arranque sería descargarlas para las quince
   * pantallas que no las usan. Las pide la pantalla que las necesita.
   */
  caso(
    'y no las dos que llevan imagen dentro',
    [],
    doble.pedidas.filter((p) => p === 'modelo_papeleta' || p === 'modelo_recibo'),
  )
  caso('hidratar no escribe nada en la base', 0, doble.escritas.length)

  /* ------------------------------------------------------------------
     LO QUE VUELVE ACABA EN `localStorage`

     Es el punto entero del arreglo: las pantallas leen de ahí con funciones
     síncronas. Si lo que trae la base no aterriza en `localStorage`, la
     petición se habría hecho para nada.
     ------------------------------------------------------------------ */
  doble.reiniciar()
  localStorage.clear()
  doble.guardado.set('asistencia', { '2026:h1': { estado: 'asiste', por: 'Diputado' } })
  doble.guardado.set('etiquetas', ['Costalero', 'Acólito'])
  await m.hidratarPlantillas()

  caso(
    'la asistencia que estaba en la base aterriza en este navegador',
    { '2026:h1': { estado: 'asiste', por: 'Diputado' } },
    JSON.parse(localStorage.getItem('cabildo-asistencia') ?? 'null'),
  )
  caso(
    'y las etiquetas también',
    ['Costalero', 'Acólito'],
    JSON.parse(localStorage.getItem('cabildo-etiquetas') ?? 'null'),
  )

  /* ------------------------------------------------------------------
     UNA QUE FALLE NO SE LLEVA A LAS DEMÁS

     Van con `Promise.allSettled` a propósito. Si traer las etiquetas
     reventara, la asistencia —que no se puede rehacer, se marca la madrugada
     del Viernes Santo— tiene que llegar igual. Y sobre todo: traer un dato de
     la hermandad no puede impedir entrar en la aplicación.
     ------------------------------------------------------------------ */
  doble.reiniciar()
  localStorage.clear()
  doble.guardado.set('asistencia', { '2026:h9': { estado: 'no_asiste' } })
  const traerOriginal = doble.traerPlantilla
  let exploto = false
  try {
    // Se rompe la lectura de una de ellas.
    doble.guardado.set('etiquetas', { rompeme: true })
    await m.hidratarPlantillas()
  } catch {
    exploto = true
  }
  caso('hidratar nunca lanza hacia fuera', false, exploto)
  caso(
    'y la asistencia llega aunque otra venga mal',
    { '2026:h9': { estado: 'no_asiste' } },
    JSON.parse(localStorage.getItem('cabildo-asistencia') ?? 'null'),
  )
  caso('el doble seguía en su sitio', true, doble.traerPlantilla === traerOriginal)
}
