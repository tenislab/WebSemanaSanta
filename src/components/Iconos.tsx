/**
 * LOS DOS ICONOS QUE DICEN «QUIÉN ERES».
 *
 * ============================================================================
 * POR QUÉ ESTÁN AQUÍ Y NO DIBUJADOS EN CADA PANTALLA
 * ============================================================================
 *
 * Porque el mismo significado sale en DOS sitios y tiene que verse igual en los
 * dos:
 *
 *   · La pantalla de entrada (`/entrar`), donde se elige camino.
 *   · El botón «Mi área de hermano» de la barra de arriba del panel, para quien
 *     además de llevar la hermandad es hermano.
 *
 * Estaban dibujados a mano en cada fichero. Eso funciona hasta el día que se
 * cambia uno: el otro se queda con el dibujo viejo y nadie se da cuenta, porque
 * son dos pantallas que no se miran a la vez. Es el mismo motivo por el que la
 * marca vive en `Logo.tsx` y hay una prueba que impide copiarla.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ ESTOS DOS DIBUJOS
 * ----------------------------------------------------------------------------
 *
 * Antes eran una PERSONA genérica y un MALETÍN, los dos sacados de una librería
 * de iconos. Se entendían, sí, y podrían estar en cualquier aplicación del
 * mundo. El maletín además decía lo que no era: una junta de gobierno no es una
 * oficina, no cobra y no ficha.
 *
 *   · LA MEDALLA es el objeto que dice «pertenezco a esta hermandad». La tiene
 *     cada hermano y se la pone para el cabildo. Con la cruz dentro no hay duda
 *     de qué mundo es.
 *
 *   · EL LIBRO DE REGLAS es el de la hermandad. Quien entra por ahí es
 *     secretaría y junta: gente que trabaja con actas, censo y reglas.
 *
 * Y sobre todo: SON PAREJA. Antes había una persona y un objeto, que es una
 * pareja que no casa; ahora son dos objetos del mismo mundo, se leen juntos y
 * ninguno le pisa el sitio a la marca —que en esa pantalla ya es un nazareno—.
 *
 * ----------------------------------------------------------------------------
 * DETALLES DE DIBUJO
 * ----------------------------------------------------------------------------
 *
 * Misma retícula (24) y mismo grosor de trazo (1,7) que el resto de iconos de
 * la aplicación, para que no canten al lado de los del menú. Las puntas van
 * redondeadas: el lazo de la medalla acaba en dos trazos sueltos y a tope
 * cuadrado parecen cortados con tijera.
 *
 * El color NO se decide aquí: va con `currentColor`, como la marca. En la
 * pantalla de entrada son dorados sobre granate y en la barra de arriba
 * heredan el color del botón.
 */

/** Lo común a los dos, para que no puedan separarse en el grosor ni la rejilla. */
const COMUN = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/**
 * LA MEDALLA DE HERMANO: el lazo, la medalla y la cruz.
 *
 * El significado es «soy hermano/a de una hermandad», y se usa igual en la
 * pantalla de entrada y en el botón que lleva al área del hermano.
 */
export function IconoMedalla() {
  return (
    <svg {...COMUN}>
      {/* El lazo, en dos trazos que bajan hasta la anilla. */}
      <path d="M7.5 3l3 6.5M16.5 3l-3 6.5" />
      <circle cx="12" cy="15" r="6" />
      {/* La cruz. Es lo que la separa de una moneda o de una medalla deportiva. */}
      <path d="M12 11.5v7M8.9 14.4h6.2" />
    </svg>
  )
}

/**
 * EL LIBRO DE REGLAS: el lomo, el canto y la cruz de la cubierta.
 *
 * El significado es «llevo la hermandad»: secretaría, junta de gobierno o
 * personal con cargo.
 */
export function IconoLibroDeReglas() {
  return (
    <svg {...COMUN}>
      <path d="M5.2 4.6A1.6 1.6 0 0 1 6.8 3H18.6v18H6.8a1.6 1.6 0 0 1-1.6-1.6Z" />
      {/* El canto de las hojas: sin esta línea parece una puerta. */}
      <path d="M5.2 17.6h13.4" />
      <path d="M11.6 7v5.4M9.2 9.1h4.8" />
    </svg>
  )
}
