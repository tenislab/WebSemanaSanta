/**
 * Que la aplicación se pueda usar con el pulgar.
 *
 * Los hermanos entran desde el móvil: pagan la cuota en la cola del banco y
 * miran su sitio en el cortejo el Martes Santo por la mañana. Y quien lleva la
 * hermandad acaba mirando el censo en el autobús.
 *
 * Todo esto se midió en un navegador de verdad a 390×844 (un iPhone normal) y
 * se arregló. Lo que se comprueba aquí es que no se vuelva atrás sin querer:
 * son reglas de CSS, y un cambio de estilo a las tres de la mañana las tira
 * sin que nadie se entere hasta que un hermano no puede pulsar un botón.
 *
 * Lo que se midió, antes → después:
 *   · botón de menú                34 px → 44
 *   · buscador de la barra         31 px → 44
 *   · casillas de la matriz        18 px → 24
 *   · celdas del calendario     41×33 px → 41×46
 *   · alto antes de la primera fila del censo  1.232 px → 879
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile('src/styles/global.css', 'utf8')

  /**
   * Todo lo que se aplica a un ancho (o a un tipo de puntero) dado.
   *
   * No vale con quedarse con el primer `@media` que coincida: hay quince
   * bloques `max-width: 560px` repartidos por el fichero, uno por sección, y
   * la primera versión de esta prueba miraba el de la portada y daba por
   * perdidas reglas que sí estaban. Se juntan todos, que es justo lo que hace
   * el navegador.
   */
  function reglas(consulta) {
    let acumulado = ''
    let desde = 0
    for (;;) {
      const i = css.indexOf(consulta, desde)
      if (i === -1) return acumulado
      const abre = css.indexOf('{', i)
      let nivel = 0
      for (let j = abre; j < css.length; j++) {
        if (css[j] === '{') nivel++
        else if (css[j] === '}') {
          nivel--
          if (nivel === 0) {
            acumulado += css.slice(abre + 1, j) + '\n'
            desde = j
            break
          }
        }
      }
      if (desde <= i) return acumulado
    }
  }

  // ---------------------------------------------------------------------
  // El tamaño de lo que se pulsa
  // ---------------------------------------------------------------------
  // Va por `pointer: coarse` —el dedo— y no por el ancho de la ventana: una
  // tableta de 1024 px también se toca, y una ventana estrecha en un portátil
  // se sigue usando con ratón.
  const dedo = reglas('@media (pointer: coarse)')
  caso('hay reglas para el dedo', true, dedo.length > 0)

  // La referencia son 44 px, que es lo que ocupa la yema de un pulgar adulto.
  const de44 = [
    '.app-menu-btn { width: 44px; height: 44px;',
    '.theme-toggle { width: 44px; height: 44px; }',
    '.icon-btn { width: 44px; height: 44px; }',
    '.app-buscar { min-height: 44px;',
    '.app-nav__link { min-height: 44px;',
    '.btn-sm { min-height: 44px; }',
    'select { min-height: 44px; }',
    '.pricing-periodo__btn { min-height: 44px; }',
    '.dash-head__link { display: inline-flex; align-items: center; min-height: 44px; }',
  ]
  for (const regla of de44) caso(regla.split(' ')[0] + ' llega a 44', true, dedo.includes(regla))

  // Las casillas de marcar: 24 px es el mínimo de la norma (WCAG 2.5.8), y en
  // una tabla que ya se desplaza a lo ancho agrandarlas no rompe nada.
  caso('las casillas suben a 24', true, dedo.includes("input[type='radio'] { width: 24px; height: 24px; }"))
  // Estas tres las fijaban a 16-18 px con más peso que la regla general: si se
  // les quita el nombre propio, vuelven a quedarse pequeñas y no se nota.
  for (const sel of [".permisos-tabla input[type='checkbox']", '.checkbox input', '.eventos-tarea__check input']) {
    caso(`${sel}: se le gana la especificidad`, true, dedo.includes(sel + ' { width: 24px; height: 24px; }'))
  }

  // El calendario: siete columnas en 390 px dan celdas de 41 px de ancho, y el
  // alto lo fijaba una proporción: salían 33. Pulsar el 14 y que se abra el 21.
  caso('las celdas del calendario, 46 de alto', true, dedo.includes('.eventos-cal__celda { min-height: 46px; }'))
  caso('y también en la vista con títulos', true, /eventos-cal__celda \{[^}]*min-height: 46px/.test(reglas('@media (max-width: 760px)')))

  // El salto al contenido NO se toca: solo aparece con el teclado, y con el
  // dedo no hay teclado que lo enfoque.
  caso('el salto al contenido se queda como está', false, dedo.includes('.saltar-al-contenido {'))

  // ---------------------------------------------------------------------
  // El sitio que ocupa cada cosa
  // ---------------------------------------------------------------------
  // En una columna, los cuatro contadores de cabecera ocupaban 570 px: había
  // que bajar 1.200 px —vez y media la pantalla— antes de ver la primera fila
  // del censo. Lo que se viene a hacer al módulo quedaba siempre fuera.
  const movil = reglas('@media (max-width: 560px)')
  caso('hay reglas de móvil', true, movil.length > 0)
  caso('los contadores van de dos en dos', true, movil.includes('.stat-grid { grid-template-columns: 1fr 1fr;'))
  // Y los de tres: la regla de 1000px se los lleva a una columna con
  // `!important`, así que aquí hay que insistir con el mismo peso.
  caso('los de tres también', true, movil.includes('.stat-grid--3 { grid-template-columns: 1fr 1fr !important; }'))
  caso('y el cuerpo del contador se aprieta', true, movil.includes('.stat-tile { padding: 0.75rem'))

  // Un botón de pared a pared con etiqueta larga («Entrar en modo demo (datos
  // de ejemplo)») se salía de su caja y el navegador le cortaba las dos
  // puntas: se leía «ntrar en modo demo (datos de ejempl».
  caso('.btn nace sin partir palabras', true, /\.btn \{[^}]*white-space: nowrap/.test(css))
  caso('pero el de ancho completo sí parte', true, movil.includes('.btn-block { white-space: normal;'))

  // Un filtro redondo estirado de lado a lado no parece un filtro.
  caso('los pastilleros no se estiran', true, movil.includes('.toolbar > .chip { align-self: flex-start; }'))
  // Y el desplegable «Exportar» al lado de un «+ Nuevo hermano» de pared a
  // pared se quedaba a medias.
  caso('las acciones de cabecera se igualan', true, movil.includes('.dash-head__actions .menu-acciones > button { width: 100%; }'))

  // ---------------------------------------------------------------------
  // La tabla en 353 px
  // ---------------------------------------------------------------------
  // Un correo largo es UNA sola palabra: sin poder partirlo, la columna del
  // nombre se plantaba en 237 px y la tabla sobresalía 16 px del borde de la
  // tarjeta, con la pastilla de estado medio comida.
  const tabla = reglas('@media (max-width: 620px)')
  caso('las columnas de apoyo se esconden', true, tabla.includes('.col-opcional { display: none; }'))
  caso('y el correo largo puede partirse', true, /row-person__sub,[\s\S]{0,120}overflow-wrap: anywhere/.test(tabla))
}
