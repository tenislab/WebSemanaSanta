/**
 * EL PAPEL: QUE LO QUE SE IMPRIME NO CREZCA CON LA HOJA.
 *
 * ----------------------------------------------------------------------------
 * LO QUE PASÓ
 * ----------------------------------------------------------------------------
 *
 * Llegó reportado como «al imprimir papeletas sale enorme, que sea solo una
 * página». En la captura, el diálogo de Chrome decía **A1** y **Horizontal**
 * —papel de plano de arquitecto— y la papeleta partida en tres hojas.
 *
 * Dos causas, las dos aquí:
 *
 * 1. EL `@page` NO DECLARABA TAMAÑO. Sin `size`, el navegador usa el último
 *    papel que tuviera puesto quien imprime. Nadie había elegido A1 para esto:
 *    Chrome lo recordaba de otra cosa, y en una casa de hermandad ese «otra
 *    cosa» es el plano de la carroza o el cartel de la cuaresma.
 * 2. EL MODELO SUBIDO POR LA HERMANDAD NO TENÍA TOPE. `.modelo-render` llevaba
 *    `max-width: none !important` en el bloque de impresión, o sea «ocupa todo
 *    el ancho que haya». Medido con el navegador: 1.420 px —unos 37 cm— frente
 *    a los 15,5 cm del diseño genérico, que sí tenía su tope.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ SE VIGILAN LAS DOS Y NO SOLO LA PRIMERA
 * ----------------------------------------------------------------------------
 *
 * Porque `@page { size }` es una PREFERENCIA: el diálogo la usa para abrir en
 * A4, y quien imprime puede cambiarla, y hay impresoras configuradas con otro
 * papel de serie. Si el tope del documento dependiera de eso, el mismo fallo
 * volvería en cuanto alguien tocara el desplegable.
 *
 * Las medidas de verdad —hojas, milímetros de la hoja y centímetros del
 * documento— las toma `scripts/caza/medir-papeleta-impresa.mjs`, que imprime a
 * PDF con el mismo motor que el diálogo. Esto de aquí es lo que puede correr en
 * cada `npm test`: que las dos reglas sigan escritas.
 */
import { fuente, sinComentarios } from './fuentes.mjs'

export default async function ({ caso }) {
  const css = sinComentarios(await fuente('src/styles/global.css'))

  // ---------------------------------------------------------------------
  // 1. EL TAMAÑO DE PÁGINA, DECLARADO.
  // ---------------------------------------------------------------------
  const reglaPage = css.match(/@page\s*\{[^}]*\}/)
  caso('hay una regla @page', true, reglaPage !== null)
  caso('y dice el tamaño', true, /size:\s*A4\s+portrait/.test(reglaPage?.[0] ?? ''))
  /*
   * Y SIGUE PONIENDO LOS MÁRGENES AHÍ, que es otro arreglo anterior: con
   * `margin` en la caja del documento solo había margen arriba en la PRIMERA
   * hoja, y de la segunda en adelante el texto llegaba al borde del papel.
   */
  caso('y los márgenes', true, /margin:\s*1\.4cm/.test(reglaPage?.[0] ?? ''))

  // ---------------------------------------------------------------------
  // 2. EL MODELO SUBIDO, TOPADO EN CENTÍMETROS.
  // ---------------------------------------------------------------------
  /*
   * El tope tiene que estar EN CENTÍMETROS y no en porcentaje ni en píxeles:
   * es lo único que no depende de la hoja. Un `max-width: 100%` vuelve a crecer
   * con el papel, que es de donde se viene.
   */
  caso('el modelo subido tiene ancho en centímetros al imprimir', true,
    /\.modelo-render\.print-doc\s*\{[^}]*width:\s*18\.2cm\s*!important/.test(css))
  caso('y tope de ancho, también en centímetros', true,
    /\.modelo-render\.print-doc\s*\{[^}]*max-width:\s*18\.2cm\s*!important/.test(css))
  /*
   * Y QUE NO VUELVA EL `max-width: none`, que es la línea exacta que causó el
   * fallo. Se busca sobre el selector a secas —el que había— porque es el que
   * alguien reescribiría «para que se vea más grande en pantalla» sin saber que
   * esa regla está dentro de `@media print`.
   */
  caso('y no se suelta el ancho del modelo', false,
    /\.modelo-render\s*\{\s*max-width:\s*none/.test(css))

  // ---------------------------------------------------------------------
  // 3. EL DISEÑO GENÉRICO SIGUE CON EL SUYO.
  // ---------------------------------------------------------------------
  /*
   * Este tope ya estaba y no se toca: a 21 cm de ancho, un recibo de cuatro
   * líneas parece un cartel. Está aquí para que el arreglo del modelo no se lo
   * lleve por delante al pasar por encima.
   */
  caso('la papeleta y el recibo genéricos siguen a 15,5 cm', true,
    /width:\s*15\.5cm\s*!important/.test(css))

  // ---------------------------------------------------------------------
  // 4. UNA PAPELETA POR HOJA, Y SIN CORTARSE POR LA MITAD.
  // ---------------------------------------------------------------------
  caso('la tanda salta de hoja en cada papeleta', true,
    /\.impresion-masiva__pagina\s*\{\s*page-break-after:\s*always/.test(css))
  caso('y la última no deja una hoja en blanco detrás', true,
    /\.impresion-masiva__pagina:last-child\s*\{\s*page-break-after:\s*auto/.test(css))
  caso('y una papeleta no se parte entre dos hojas', true,
    /break-inside:\s*avoid/.test(css))
}
