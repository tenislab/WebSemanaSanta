/**
 * LOS COLORES DE LA MARCA, escritos una sola vez.
 *
 * El logotipo es una ilustración y ya no se dibuja en código, pero sus colores
 * los siguen necesitando varias cosas: la baldosa del icono de la pestaña, el
 * membrete de los documentos que se imprimen y la barra del navegador en el
 * móvil (`theme-color`). Repartidos por ahí se despegan del logo en cuanto
 * alguien retoca un tono, y entonces la aplicación tiene dos dorados.
 *
 * Están en `lib` y no dentro de `components/Logo.tsx` porque de ahí los lee
 * también el generador del icono, que es un script y no puede importar un
 * componente de React.
 */

/** El granate del hábito. Es el color de la cabecera y el de la barra del móvil. */
export const GRANATE = '#7B1520'

/** El oro de la orfebrería: la orla, la G y el farol del logotipo. */
export const ORO = '#C9A55C'

/**
 * El hueso del papel. Es el fondo de la baldosa del icono: la marca es oro y
 * granate, y suelta sobre una pestaña oscura el farol se pierde. Con la
 * baldosa detrás se lee igual en pestaña clara y en oscura, que es lo único
 * que importa en 16 píxeles.
 */
export const HUESO = '#F7F1E4'
