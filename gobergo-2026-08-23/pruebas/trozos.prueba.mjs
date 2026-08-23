/**
 * QUE UN TROZO QUE NO CARGA NO DEJE LA PANTALLA EN BLANCO.
 *
 * Cada página se descarga aparte y su nombre lleva dentro un número que cambia
 * en cada despliegue. Al subir una versión nueva, el `index.html` que el
 * navegador tiene en memoria sigue apuntando a los nombres VIEJOS, que en el
 * servidor ya no existen: la siguiente pantalla que se abra pide un archivo que
 * da 404, `lazy()` lanza, y se queda en blanco.
 *
 * Se arregla recargando, y por eso se lee como «va a rachas»: falla la primera
 * vez, funciona a la segunda, y no hay manera de reproducirlo después. Le pasa
 * a cualquiera que tuviera la aplicación abierta cuando se despliega — o sea, a
 * la secretaría entera un lunes por la mañana.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const app = await readFile('src/App.tsx', 'utf8')

  // NINGUNA página puede quedarse sin la red. Es la comprobación que importa:
  // basta con que alguien añada una pantalla nueva con el `import()` pelado
  // para que vuelva el fallo, y solo en esa pantalla.
  const sinRed = [...app.matchAll(/lazy\(\(\) => import\('([^']+)'\)\)/g)].map((m) => m[1])
  caso('ninguna página se carga sin reintento', '', sinRed.join(', '))
  const cargadoresPelados = [...app.matchAll(/const cargar\w+ = \(\) => import\('([^']+)'\)/g)].map((m) => m[1])
  caso('ni ningún cargador con nombre', '', cargadoresPelados.join(', '))

  // Y que haya páginas de verdad envueltas, no que el patrón haya desaparecido
  // porque alguien quitó el lazy entero.
  const conRed = [...app.matchAll(/conReintento\(\(\) => import\('([^']+)'\)\)/g)]
  caso('y hay muchas con red', true, conRed.length >= 20)

  /*
   * SE RECARGA UNA VEZ, NO EN BUCLE. Si después de recargar el trozo sigue sin
   * cargar, el problema es otro —sin conexión, un archivo que de verdad falta—
   * y hay que dejar que el error salga: una pantalla en blanco es mala, pero
   * una página que se recarga sola cada segundo es peor y además no se puede
   * ni cerrar bien.
   */
  caso('la recarga deja marca', true, /sessionStorage\.setItem\(MARCA_RECARGA/.test(app))
  caso('y no recarga si ya se intentó', true, /if \(yaSeIntento\) throw e/.test(app))
  /*
   * Y la marca SE BORRA al cargar bien. Sin esto la red serviría una sola vez
   * por pestaña, y el siguiente despliegue del mismo día volvería a dejar la
   * pantalla en blanco.
   */
  caso('la marca se borra al cargar bien', true, /removeItem\(MARCA_RECARGA\)/.test(app))

  // Mientras la página se va, no se pinta nada: una promesa que no resuelve.
  caso('no se pinta nada mientras recarga', true, /new Promise<T>\(\(\) => \{\}\)/.test(app))
}
