/**
 * LA ENTRADA DEL HERMANO ES UNA ESCENA, NO UNA PANTALLA MÁS.
 *
 * Es lo primero que ve un hermano de la hermandad, y va pintada como una
 * portada impresa: papel color hueso, latón, granate, la portada de piedra de
 * fondo y el damasco. Eso obliga a dos cosas que se rompen solas:
 *
 *   1. La escena se sale del tema. Fija sus propios colores en vez de seguir
 *      el claro/oscuro del navegador. Y si se fija la LETRA hay que fijar
 *      también lo que hay DETRÁS: la primera versión se dejó el cristal de la
 *      cabecera y en modo oscuro salía «Gobergo» en marrón sobre negro.
 *
 *   2. Media pantalla estaba pintada para el cristal oscuro del acceso —letra
 *      color crema, bordes blancos translúcidos—. Sobre papel hueso eso no se
 *      ve: crema sobre crema. Pasó tres veces seguidas (el aviso de demo, los
 *      nombres de las cuentas de prueba, el rótulo de encima) y las tres se
 *      descubrieron mirando la captura, que es justo lo que no escala.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile('src/styles/global.css', 'utf8')
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')

  // --- La escena es SOLO la entrada ---
  caso('la entrada se marca como escena', true, /className="portal portal--entrada"/.test(portal))
  /*
   * Y el área de dentro NO. Allí el hermano está trabajando: fondo normal y
   * modo oscuro que funciona. Con los adornos colgados de `.portal` a secas se
   * colaban también en el panel de dentro.
   */
  const decoraciones = [...css.matchAll(/^\.portal(--entrada)?::(before|after)\b/gm)]
  // Con el suelo puesto: sin él, borrar las dos reglas dejaría 0 === 0 y la
  // prueba pasaría celebrando que no hay fondo.
  caso('el fondo sigue teniendo sus capas', true, decoraciones.length >= 2)
  caso('los adornos del fondo cuelgan de la escena, no de `.portal`',
    decoraciones.length, decoraciones.filter((m) => m[1] === '--entrada').length)

  // --- Fija su color, y fija TODO su color ---
  const escena = css.slice(css.indexOf('.portal--entrada {'))
    .slice(0, css.slice(css.indexOf('.portal--entrada {')).indexOf('}') + 1)
  for (const v of ['--text', '--text-muted', '--bg-raised', '--bg-sunken', '--line', '--line-strong']) {
    caso(`la escena fija ${v}`, true, escena.includes(`${v}:`))
  }
  /*
   * Estas tres son las que faltaban. La cabecera es cristal: sin fijarlas se
   * quedaba con el cristal NEGRO del modo oscuro y encima la letra oscura que
   * sí se había fijado.
   */
  for (const v of ['--glass-surface', '--glass-surface-strong', '--glass-border']) {
    caso(`y también ${v}, que es lo que hay detrás de la letra`, true, escena.includes(`${v}:`))
  }

  await loQueEstabaPintadoParaElCristalOscuro({ caso, css })
  await losDibujosDelFondo({ caso, css })
}

/**
 * Cada trozo de interfaz que nació sobre el panel de acceso lleva un color
 * claro fijo. Los que además se usan en la entrada necesitan su versión sobre
 * papel, o desaparecen.
 */
async function loQueEstabaPintadoParaElCristalOscuro({ caso, css }) {
  const enLaEntrada = [
    ['.banner--info', 'el aviso de modo demostración'],
    ['.demo-accounts__label', 'el rótulo «o entra como un hermano concreto»'],
    ['.demo-account b', 'el nombre de la cuenta de prueba'],
    ['.demo-account small', 'el número de hermano'],
    ['.demo-account__cred', 'el DNI y la contraseña de prueba'],
  ]
  for (const [sel, que] of enLaEntrada) {
    caso(`${que} se repinta para el papel`, true,
      css.includes(`.portal--entrada ${sel} {`) || css.includes(`.portal--entrada ${sel} `))
  }
}

/**
 * Los dibujos del fondo van metidos en el propio CSS. Un `#` sin escapar corta
 * la dirección en seco —el navegador lo lee como el principio de un ancla— y
 * la capa desaparece sin dar ningún error: el fondo sale liso y parece que
 * «no se ha aplicado el diseño».
 */
async function losDibujosDelFondo({ caso, css }) {
  const dibujos = [...css.matchAll(/url\("(data:image\/svg\+xml,[^"]*)"\)/g)].map((m) => m[1])
  caso('hay dibujos metidos en el CSS', true, dibujos.length >= 4)
  caso('ninguno lleva una almohadilla sin escapar', [],
    dibujos.filter((d) => d.includes('#')).map((d) => d.slice(0, 60)))
  caso('todos abren con un <svg>', dibujos.length,
    dibujos.filter((d) => d.startsWith('data:image/svg+xml,%3Csvg')).length)
  caso('y cierran', dibujos.length, dibujos.filter((d) => d.endsWith('%3C/svg%3E')).length)
  /*
   * Y ninguno lleva `<` ni `>` en crudo: dentro de un `url("…")` de CSS pasan,
   * pero rompen en cuanto el mismo dibujo se copia a un atributo de HTML.
   */
  caso('sin ángulos en crudo', [], dibujos.filter((d) => /[<>]/.test(d)).map((d) => d.slice(0, 40)))

  // El arco de piedra guarda su proporción. Estirado a lo alto de la pantalla
  // volvía a ser el óvalo borroso que era antes de dibujarlo.
  const arco = css.slice(css.indexOf('.portal--entrada::before {'))
  caso('el arco no se estira', true, /aspect-ratio: 2 \/ 3/.test(arco.slice(0, 400)))
}
