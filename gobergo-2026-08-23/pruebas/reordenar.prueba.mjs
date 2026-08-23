/**
 * SUBIR Y BAJAR FILAS SIN QUE SE MUEVA EL BOTÓN.
 *
 * Llegó dicho así: «se mueve muy raro el menú de editar la web, sobre todo en
 * estilo y secciones». Y es literal.
 *
 * Al intercambiar dos filas, el botón que acabas de pulsar SE VA con su fila a
 * la posición nueva. El cursor se queda quieto, así que la segunda pulsación
 * cae sobre el botón de OTRA fila y mueves la que no era. Subir una sección
 * desde el final de quince son catorce pulsaciones: no hay forma de acertar.
 *
 * A teclado es peor: al llegar al extremo ese botón se desactiva, y un botón
 * desactivado PIERDE EL FOCO — te devuelve al principio de la página.
 *
 * Se arregló en las secciones, y ahí se quedó: el itinerario de la estación de
 * penitencia, la junta de gobierno, los titulares y las fotos de la portada
 * seguían igual. Cuatro listas con el mismo fallo en la misma pantalla.
 *
 * Esta prueba existe porque el arreglo es fácil de olvidar al añadir la lista
 * número seis, y el fallo no rompe nada: solo hace que la pantalla se sienta
 * mal, que es lo que más cuesta que alguien reporte.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const foco = await readFile('src/lib/foco.ts', 'utf8')
  const web = await readFile('src/pages/app/WebPublica.tsx', 'utf8')

  // --- El ayudante existe y hace las dos cosas que tiene que hacer.
  caso('el ayudante está en un solo sitio', true, /export function useMoverConElFoco/.test(foco))
  caso('devuelve el foco al botón de su fila', true, /suyo\.focus\(\)/.test(foco))
  // Al llegar al extremo, el botón de ese sentido se desactiva: se pasa al otro.
  caso('y al del sentido contrario si el suyo se desactiva', true, /alterno && !alterno\.disabled/.test(foco))

  /*
   * `CSS.escape` NO vale para meter la clave dentro de unas comillas: está
   * pensado para identificadores sueltos y convierte un id que empieza por
   * cifra —la mitad de los UUID— en algo como `\\33 f2a…`, que ahí ya no
   * encuentra nada. Se escapan solo la comilla y la barra invertida.
   */
  caso('la clave se escapa para ir entre comillas', true, /entrecomillar/.test(foco))
  caso('y no con CSS.escape, que rompe los UUID', false, /CSS\.escape\(movida\.clave\)/.test(foco))

  /*
   * --- LA COMPROBACIÓN QUE IMPORTA ---
   *
   * TODA lista que se pueda reordenar en el editor de la web tiene que usarlo.
   * Se cuentan las funciones `mover(i, dir)` y se comprueba que cada una avisa
   * al ayudante: si alguien añade la sexta lista y se olvida, aquí salta.
   */
  const moveres = [...web.matchAll(/function mover\(i: number, dir: -1 \| 1\) \{[\s\S]{0,420}?\n  \}/g)].map((m) => m[0])
  caso('hay listas reordenables en el editor', true, moveres.length >= 4)
  const sinAvisar = moveres.filter((f) => !/conFoco\.movida\(/.test(f))
  caso('todas avisan de qué fila se ha movido', 0, sinAvisar.length)

  // Y la de secciones, que va por su cuenta desde antes, sigue haciéndolo.
  caso('las secciones siguen recordando cuál se movió', true, /setMovida\(\{ tipo: web\.secciones\[i\]\.tipo, dir \}\)/.test(web))

  /*
   * Y la clave NUNCA puede ser el índice: es lo único que cambia justo al
   * mover. Con el índice, el foco vuelve al mismo sitio de la pantalla —que
   * ahora es otra fila— y el fallo sigue igual con más código.
   */
  const claves = [...web.matchAll(/conFoco\.movida\(([^,]+),/g)].map((m) => m[1].trim())
  caso('ninguna clave es el índice', '', claves.filter((c) => c === 'i' || c === 'j').join(', '))
  caso('y hay una por lista', true, claves.length >= 4)

  // Cada `movida` tiene que tener su `boton` en el marcado: sin el atributo no
  // hay a quién devolverle el foco, y el efecto no encuentra nada.
  const botones = [...web.matchAll(/conFoco\.boton\(/g)].length
  caso('cada lista marca sus dos botones', true, botones >= claves.length * 2)
}
