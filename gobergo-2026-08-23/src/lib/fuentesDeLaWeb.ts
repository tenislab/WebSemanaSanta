/**
 * LAS LETRAS DEL CONSTRUCTOR DE WEBS, cargadas solo donde se usan.
 *
 * El catálogo de parejas tipográficas necesita TRECE familias de Google Fonts.
 * Antes se pedían todas en `index.html`, y una hoja de estilos externa
 * BLOQUEA EL PRIMER PINTADO: cada pantalla del panel —y el área del hermano
 * en su móvil, con datos móviles— esperaba a que Google contestara por trece
 * familias de las que el panel usa UNA (Cormorant Garamond, la de los
 * titulares). En una conexión lenta eso es un segundo o dos de pantalla en
 * blanco en cada visita, pagados por todo el mundo para que el que edita su
 * web —una persona, una vez— tenga el catálogo listo.
 *
 * Ahora `index.html` pide solo la del panel, y esto trae las demás cuando se
 * entra donde de verdad hacen falta: la web pública de la hermandad y su
 * editor. Se inyecta como <link> normal —el navegador la cachea igual— y con
 * `display=swap`, así que mientras llegan se lee con las de respaldo
 * (Georgia, system-ui) que toda pareja del catálogo declara.
 */

const ID = 'fuentes-de-la-web'

/** Las doce familias del catálogo que el panel no usa. */
const FAMILIAS =
  'family=Cinzel:wght@500;600;700'
  + '&family=Playfair+Display:ital,wght@0,500;0,700;1,500'
  + '&family=EB+Garamond:ital,wght@0,400;0,600;1,400'
  + '&family=Merriweather:wght@400;700'
  + '&family=Lora:ital,wght@0,400;0,600;1,400'
  + '&family=Montserrat:wght@400;600;700'
  + '&family=Raleway:wght@400;600;700'
  + '&family=Poppins:wght@400;600;700'
  + '&family=Lato:wght@400;700'
  + '&family=Oswald:wght@400;600'
  + '&family=Bebas+Neue'
  + '&family=Dancing+Script:wght@500;700'

/** Idempotente: la segunda llamada no hace nada. */
export function asegurarFuentesDeLaWeb() {
  if (typeof document === 'undefined' || document.getElementById(ID)) return
  const link = document.createElement('link')
  link.id = ID
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${FAMILIAS}&display=swap`
  document.head.appendChild(link)
}
