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
  const { readFile } = await import('node:fs/promises')
  const html = await readFile('index.html', 'utf8')

  /** Los colores de la marca, sacados del propio logo. */
  const logo = await readFile('src/components/Logo.tsx', 'utf8')
  const colorDe = (nombre) => logo.match(new RegExp(`const ${nombre} = '([^']+)'`))?.[1]
  const coloresDeLaMarca = {
    verde: colorDe('VERDE'),
    rojo: colorDe('ROJO'),
    oro: colorDe('ORO'),
  }
  caso('se encuentran los colores de la marca', 3, Object.values(coloresDeLaMarca).filter(Boolean).length)

  const iconos = [...html.matchAll(/href="(data:image\/svg\+xml,[^"]+)"/g)].map((m) => m[1])
  caso('hay iconos declarados', true, iconos.length >= 2)

  for (const [i, href] of iconos.entries()) {
    // Lo que de verdad le llega al navegador: todo lo anterior a la primera
    // almohadilla sin codificar.
    const loQueLlega = href.split('#')[0]
    caso(`icono ${i + 1}: llega entero`, href.length, loQueLlega.length)

    // Y que lo que llega sea un SVG completo, no un trozo.
    const svg = decodeURIComponent(href.slice(href.indexOf(',') + 1))
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
