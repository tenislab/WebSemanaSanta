/**
 * Que el logo de la pestaña no se rompa otra vez.
 *
 * EL FALLO: el favicon va como `data:image/svg+xml,<svg…>` metido en el
 * `index.html`. Y dentro del dibujo hay colores escritos con almohadilla
 * (`fill='#7B1520'`).
 *
 * En un `data:` URI la almohadilla NO es un carácter más: empieza el
 * fragmento, igual que en cualquier dirección web. Así que el navegador
 * recibía los 147 primeros caracteres —hasta el primer color— y tiraba el
 * resto. Un SVG cortado a medias no es un SVG, así que no pintaba nada y la
 * pestaña salía con el globo gris de «sin icono».
 *
 * Y no se nota programando: en local, con la pestaña ya abierta, el navegador
 * suele seguir enseñando el favicon que tenía cacheado.
 */
export default async function ({ caso }) {
  const { readFile, stat } = await import('node:fs/promises')
  const html = await readFile('index.html', 'utf8')

  /*
   * Los colores de la marca, sacados del propio logo — y LOS QUE HAYA.
   *
   * Estaban escritos aquí a mano, uno por uno. Al cambiar de logo esta prueba
   * se puso roja pidiendo unos colores que ya no existían; y al listarlos por
   * nombre (`VERDE`, `ROJO`…) volvió a pasar lo mismo al volver al anterior.
   * Una prueba que hay que actualizar a mano cada vez acaba borrándose.
   */
  const logo = await readFile('src/components/Logo.tsx', 'utf8')
  const coloresDeLaMarca = Object.fromEntries(
    [...logo.matchAll(/const ([A-Z][A-Z_]*) = '(#[0-9A-Fa-f]{3,8})'/g)].map((m) => [m[1], m[2]]),
  )
  caso('se encuentran los colores de la marca', true, Object.keys(coloresDeLaMarca).length >= 2)

  /*
   * El icono ya no va metido en la etiqueta como `data:image/svg+xml,…`: son
   * archivos. Estuvo así para ahorrar una petición y costó dos fallos que no
   * dan error —comillas que cerraban el atributo antes de tiempo, y luego un
   * icono que seguía sin verse sin forma de saber por qué—. Un archivo se abre
   * y se ve.
   */
  const iconos = [...html.matchAll(/<link[^>]*rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1])
  caso('hay iconos declarados', true, iconos.length >= 2)
  caso('y son archivos, no direcciones data:', 0, iconos.filter((h) => h.startsWith('data:')).length)
  caso('todos cuelgan de la raíz', iconos.length, iconos.filter((h) => h.startsWith('/')).length)

  for (const [i, ruta] of iconos.entries()) {
    // El archivo tiene que existir de verdad, no solo estar enlazado: un
    // `href` a un archivo que no está es exactamente lo que se ve como el
    // globo gris, y desde el HTML no se distingue.
    const enDisco = `public${ruta.split('?')[0]}`
    const info = await stat(enDisco).catch(() => null)
    caso(`icono ${i + 1} (${ruta.split('?')[0]}): el archivo existe`, true, !!info)
    if (!info || !enDisco.endsWith('.svg')) continue

    const svg = await readFile(enDisco, 'utf8')
    caso(`icono ${i + 1}: abre y cierra el svg`, true, svg.startsWith('<svg') && svg.trimEnd().endsWith('</svg>'))
    /*
     * Los colores tienen que seguir ahí: si se perdieron, el dibujo sale negro.
     *
     * Y se leen del LOGO, no escritos aquí. Estaban escritos a mano —el
     * granate y el oro de la marca antigua— y al cambiar el logo esta prueba
     * se puso roja pidiendo unos colores que ya no existían. Una prueba que
     * hay que ir actualizando a mano cada vez acaba borrándose.
     */
    for (const [nombre, valor] of Object.entries(coloresDeLaMarca)) {
      caso(`icono ${i + 1}: conserva el ${nombre}`, true, new RegExp(valor.slice(1), 'i').test(svg))
    }
  }

  // El color de la barra del navegador en el móvil, que va aparte.
  caso('hay theme-color', true, /name="theme-color"/.test(html))
}
