/**
 * LOS FONDOS DE LA PORTADA, PASANDO UNO TRAS OTRO.
 *
 * «La web tiene que dejar poner fotos de fondo que vayan pasando una tras
 * otra, especificando las dimensiones y diciendo que si no son esas puede
 * perder calidad, donde pone lo real hermandad del nazareno detrás.»
 *
 * La lista de fotos y el turno de cinco segundos YA estaban. Lo que no estaba
 * es lo demás, y las tres cosas son del mismo tamaño que lo que sí había:
 *
 *  1. EL PASO ERA UN CORTE SECO. El fondo era un `background-image` en la
 *     propia sección, y eso no se puede animar: se sustituye de golpe. Detrás
 *     del nombre de la hermandad, un corte cada cinco segundos es un parpadeo.
 *     Ahora hay una capa por foto y lo que cambia es la opacidad.
 *
 *  2. NO SE RESPETABA «QUE NADA SE MUEVA». `prefers-reduced-motion` lo lleva
 *     puesto quien se marea con lo que se mueve, y una foto cambiando sola
 *     detrás de un texto es el caso de libro. Un carrusel no se apaga desde el
 *     CSS: hay que NO arrancar el temporizador.
 *
 *  3. NO SE DECÍAN LAS MEDIDAS. Ni una palabra, en la pantalla donde se elige
 *     la foto. Era literalmente la mitad de lo que se pedía.
 *
 * Y el aviso lleva un NÚMERO, no un «puede perder calidad», porque con lo
 * segundo no se decide nada. El número sale de dos cosas comprobadas:
 * `comprimirImagen` escala con `Math.min(1, …)` —nunca agranda— y la cabecera
 * ocupa todo el ancho del sitio (medido en el navegador a 390, 768, 1366, 1920
 * y 2560 px: la caja de la cabecera mide lo mismo que el sitio en los cinco).
 * Entonces 1.920 ÷ 1.200 = 1,6 y no hay que creerse nada.
 */
import { fuenteDe, cuerpoDeLaFuncion, sinComentarios, fuenteLlana } from './fuentes.mjs'

export default async function ({ caso }) {
  const marco = sinComentarios(await fuenteDe('src/components/sitio/marco.tsx'))
  const hero = cuerpoDeLaFuncion(marco, 'export function HeroFondo')
  caso('se encuentra la cabecera', true, hero.length > 400)

  // ---------------------------------------------------------------------
  // 1. SE CRUZAN, NO SE CORTAN.
  // ---------------------------------------------------------------------
  caso('hay una capa por foto', true, /fotos\.map\(\(f, n\) =>/.test(hero))
  caso('y la puesta se marca con una clase', true, /sitio__hero-foto--puesta/.test(hero))
  /*
   * EL FONDO YA NO VA EN LA SECCIÓN. Es la recaída que importa: si alguien
   * vuelve a ponerle `backgroundImage` a `.sitio__hero`, las capas siguen ahí
   * pero el corte seco vuelve por debajo y encima se pintan las dos cosas.
   * Medido en el navegador: `backgroundImage` de la sección es `none`.
   */
  caso('la sección no lleva fondo propio', false, /sitio__hero sitio__hero--[\s\S]{0,200}backgroundImage/.test(hero))

  const css = sinComentarios(await fuenteDe('src/styles/global.css'))
  caso('las capas se cruzan con opacidad', true,
    /\.sitio__hero-foto \{[^}]*opacity: 0;[^}]*transition: opacity/.test(css))
  caso('y la puesta se ve', true, /\.sitio__hero-foto--puesta \{ opacity: 1; \}/.test(css))
  caso('las capas cubren el hueco', true, /\.sitio__hero-foto \{[^}]*background-size: cover/.test(css))

  /*
   * Y TODAS ESTÁN PUESTAS DESDE EL PRINCIPIO. Es lo que hace que el paso no se
   * vea en blanco: con una sola capa que cambia de dirección, la primera vuelta
   * pide la imagen justo cuando ya le toca enseñarla. Se comprueba por lo
   * contrario: que no se pinte solo la que está puesta.
   */
  caso('las fotos no se piden cuando ya les toca', false,
    /fotos\.filter\([\s\S]{0,60}=== puesta/.test(hero) || /n === puesta &&/.test(hero))

  // ---------------------------------------------------------------------
  // 2. QUIETO ES QUIETO.
  // ---------------------------------------------------------------------
  /*
   * Lo importante es que NO ARRANQUE EL TEMPORIZADOR, no solo que no haya
   * transición: quitar la transición y dejar el temporizador es exactamente el
   * corte seco de antes con otro nombre. Medido: con `prefers-reduced-motion`
   * puesto, a los seis segundos sigue en la primera foto.
   */
  caso('la cabecera pregunta si se quiere quieto', true, /const quieto = useQuieto\(\)/.test(hero))
  caso('y no arranca el turno', true, /if \(fotos\.length < 2 \|\| quieto\) return/.test(hero))
  caso('y se vuelve a decidir si el ajuste cambia', true, /\[fotos\.length, quieto\]/.test(hero))
  // Cinturón en el CSS, por si alguna capa se pinta de todas formas.
  caso('el CSS también lo respeta', true,
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.sitio__hero-foto \{ transition: none/.test(css))

  /*
   * EL GANCHO SE SUSCRIBE AL CAMBIO. El ajuste se toca con la página abierta
   * —en el móvil está donde el ahorro de batería—, y leerlo una vez al montar
   * dejaría el carrusel girando para quien acaba de pedir que se pare.
   */
  const imprimir = sinComentarios(await fuenteDe('src/lib/imprimir.ts'))
  const gancho = cuerpoDeLaFuncion(imprimir, 'export function useQuieto')
  caso('se encuentra el gancho', true, gancho.length > 200)
  caso('pregunta por prefers-reduced-motion', true, /prefers-reduced-motion: reduce/.test(gancho))
  caso('y se entera si lo cambian', true, /addEventListener\('change'/.test(gancho))
  caso('y se despide', true, /removeEventListener\('change'/.test(gancho))
  // Sin `matchMedia` no se cae: se mueve, que es lo que hacía antes de existir.
  caso('sin matchMedia no revienta', true, /catch \{[\s\S]{0,200}return false/.test(gancho))

  // ---------------------------------------------------------------------
  // 3. EL ÍNDICE NO APUNTA A UNA FOTO QUE YA NO ESTÁ.
  // ---------------------------------------------------------------------
  /*
   * La hermandad quita fotos con la portada abierta —el editor guarda y la
   * vista previa se entera—, y entonces `i` se queda apuntando más allá del
   * final: la cabecera se queda sin fondo hasta la siguiente vuelta.
   */
  caso('el índice se recorta al número de fotos', true, /i % fotos\.length/.test(hero))
  caso('y con cero fotos no divide por cero', true, /fotos\.length \? i % fotos\.length : 0/.test(hero))

  // ---------------------------------------------------------------------
  // 4. LAS MEDIDAS, DICHAS DONDE SE ELIGE LA FOTO.
  // ---------------------------------------------------------------------
  const portada = sinComentarios(await fuenteDe('src/pages/app/web/PortadaTab.tsx'))
  const portadaLlana = fuenteLlana(await fuenteDe('src/pages/app/web/PortadaTab.tsx'))
  caso('se dice el tamaño recomendado', true, /1\.920 × 1\.080 px/.test(portada))
  caso('y que apaisada', true, /apaisada/.test(portada))
  /*
   * LAS DOS MITADES DEL AVISO, que son las que dejan decidir:
   *   · una más grande se reduce y no pasa nada, y
   *   · una más pequeña NO se agranda, pero se estira al ancho de la pantalla.
   * Decir solo lo segundo asusta sin motivo; decir solo lo primero no avisa.
   */
  caso('una más grande no es un problema', true, /más grande se reduce/.test(portadaLlana))
  caso('una más pequeña no se agranda', true, /más pequeña no se agranda/.test(portadaLlana))
  caso('y se dice por cuánto se estira', true, /×1,6/.test(portada))
  // Con un número, no con un «puede perder calidad» que no deja decidir nada.
  caso('el aviso no es un adjetivo suelto', false, /puede perder calidad/.test(portadaLlana))
  caso('el aviso se ve como aviso', true, /form-hint--aviso/.test(portada))

  /*
   * Y LA AYUDA DICE LO QUE PASA DE VERDAD: que se cruzan (no que se cambian) y
   * que a quien pide quieto se le queda la primera. Lo segundo es información
   * que la hermandad necesita: si no, ve la portada quieta en su ordenador con
   * el ajuste puesto y cree que el carrusel no funciona.
   */
  caso('la ayuda dice que se cruzan', true, /Se cruzan de fondo/.test(portadaLlana))
  caso('y avisa de que a quien pide quieto no le pasan', true,
    /nada se mueva, se le queda la primera fija/.test(portadaLlana))

  // ---------------------------------------------------------------------
  // 5. LA SUBIDA NO AGRANDA, QUE ES DE DONDE SALE EL NÚMERO.
  // ---------------------------------------------------------------------
  /*
   * Si algún día `comprimirImagen` agrandara, el aviso de arriba pasaría a ser
   * mentira sin que nadie toque el texto. De ahí que se vigile aquí: el aviso
   * y el motivo del aviso tienen que caerse juntos.
   */
  const imagen = sinComentarios(await fuenteDe('src/lib/imagen.ts'))
  const comprimir = cuerpoDeLaFuncion(imagen, 'export async function comprimirImagen')
  caso('se encuentra la compresión', true, comprimir.length > 150)
  caso('la escala nunca pasa de 1', true, /Math\.min\(1, maxLado \/ Math\.max\(img\.width, img\.height\)\)/.test(comprimir))
  // Y la portada sube a 1.920, que es el número que dice el aviso.
  caso('las fotos de la portada se guardan a 1.920', true, /leerImagenes\(e, anadir, 1920\)/.test(portada))
}
