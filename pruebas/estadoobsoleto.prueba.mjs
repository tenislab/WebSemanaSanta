/**
 * NINGÚN `setX(algo-que-usa-x)` FUERA DEL ACTUALIZADOR.
 *
 * Es la trampa que `docs/COMO-TRABAJAR.md` nombra con estas palabras:
 * «calcular con la lista del render y guardar después duplica números de
 * hermano y pierde cambios». Va DENTRO del actualizador: `setX(prev => …)`.
 *
 * Había nueve sitios así, y el que importaba escribía en el LIBRO DE CUENTAS:
 * `setMovimientos(conApunteDeCobro(movimientos, datos))` al apuntar una
 * aportación a una campaña. Lo que se pierde ahí no es una pulsación, es un
 * apunte de dinero.
 *
 * ============================================================================
 * Y NO CUENTA COMO FALLO SI `setX` ES UNA PROP
 * ============================================================================
 *
 * Esto lo aprendí arreglándolo de más. `setCampos` en `CamposPropiosCard` y
 * `setSesgos` en `EditorSegmento` se llaman igual que un setter de React pero
 * son PROPS del tipo `(v: X[]) => void`: reciben un valor, no un actualizador,
 * y el estado lo tiene el padre. Ahí pasar un array nuevo es exactamente su
 * contrato, y «arreglarlo» no compila.
 *
 * Así que el guardia mira si el nombre está DECLARADO en el mismo fichero como
 * estado (`const [x, setX] = useState(...)` o `useSupabaseTable`), y si no lo
 * está, no dice nada. Un guardia que grita donde no hay fallo se acaba
 * silenciando entero.
 */
export default async function ({ caso }) {
  const { readFile, readdir } = await import('node:fs/promises')

  const ficheros = []
  const pilas = ['src']
  while (pilas.length) {
    const d = pilas.pop()
    for (const e of await readdir(d, { withFileTypes: true })) {
      const ruta = `${d}/${e.name}`
      if (e.isDirectory()) pilas.push(ruta)
      else if (/\.(ts|tsx)$/.test(e.name)) ficheros.push(ruta)
    }
  }

  /*
   * SIN COMENTARIOS NI CADENAS, Y ESO NO ES COSMÉTICA.
   *
   * La primera versión de este guardia se puso roja por su propio arreglo: el
   * comentario que explica el fallo CITA la línea vieja
   * (`setMovimientos(conApunteDeCobro(movimientos, …))`), y el detector la leyó
   * como si fuera código. Un guardia que lee los comentarios acusa a quien los
   * escribe.
   */
  const sinAdornos = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')

  const sospechosos = []
  for (const ruta of ficheros.sort()) {
    const txt = sinAdornos(await readFile(ruta, 'utf8'))
    for (const m of txt.matchAll(/\bset([A-Z]\w+)\(\s*(?!\(?\w*\)?\s*=>)([^\n]{0,160})/g)) {
      const nombre = m[1]
      const arg = m[2]
      const estado = nombre[0].toLowerCase() + nombre.slice(1)
      /*
       * EL NOMBRE PELADO, no como propiedad de otra cosa.
       *
       * `setError(r.error)` y `setFilas(corte.filas)` NO son el fallo: leen una
       * propiedad de lo que acaba de volver, no el estado. Sin este filtro
       * salían cuarenta y cinco avisos falsos y los dos de verdad quedaban
       * enterrados entre ellos.
       */
      if (!new RegExp(`(^|[^.\\w])${estado}([^\\w]|$)`).test(arg)) continue

      /*
       * Y NO CUENTA SI ES UNA LOCAL QUE SE LLAMA IGUAL.
       *
       * `const { error } = await activarMfa(); setError(error)` no lee el
       * estado: lee lo que acaba de volver de la llamada, que por costumbre se
       * llama igual que el estado donde va a acabar. Hay ocho así entre
       * `AuthForm` y `Seguridad`, y los ocho son correctos.
       *
       * Se busca la declaración de una local con ese nombre en las veinte
       * líneas de antes, que es donde cabe el `await` que la trae.
       */
      const antes = txt.slice(0, m.index).split('\n').slice(-20).join('\n')
      const localQueTapa = new RegExp(
        `const \\{[^}]*\\b${estado}\\b[^}]*\\}\\s*=|const ${estado}\\s*=`,
      ).test(antes)
      if (localQueTapa) continue
      /*
       * ¿ES ESTADO DE ESTE FICHERO? Si no está declarado aquí como estado, el
       * `set…` es una prop y pasarle un valor es su contrato. Ver la cabecera.
       */
      const esEstado = new RegExp(
        `const \\[${estado}, set${nombre}\\]\\s*=\\s*(useState|useSupabaseTable|usePersistentState|useLista)`,
      ).test(txt)
      if (!esEstado) continue
      // Un homónimo local (`const error = …; setError(error)`) tampoco cuenta.
      const linea = txt.slice(0, m.index).split('\n').length
      sospechosos.push(`${ruta}:${linea}  set${nombre}(${arg.trim().slice(0, 60)}`)
    }
  }
  caso('nada deriva estado del estado fuera del actualizador', [], sospechosos)

  // Y el de la campaña, por su nombre: es el que toca dinero.
  const campanas = sinAdornos(await readFile('src/pages/app/Campanas.tsx', 'utf8'))
  caso('el apunte de una aportación va dentro del actualizador', true,
    /setMovimientos\(\(prev\) => conApunteDeCobro\(prev, datos\)\)/.test(campanas))
  caso('y ya no se calcula con la lista del pintado', false,
    /setMovimientos\(conApunteDeCobro\(movimientos,/.test(campanas))
}
