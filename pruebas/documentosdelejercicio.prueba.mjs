/**
 * LOS DOCUMENTOS DEL EJERCICIO NO SON DOS BOTONAZOS.
 *
 * «Lo de estado de las cuentas son botones enormes que ocupan de más, hay que
 * buscar otra forma más limpia de ponerlo.»
 *
 * Eran dos tarjetas seguidas —Memoria del ejercicio y Estado de cuentas
 * anual—, cada una con su título, su párrafo de dos líneas, su desplegable de
 * año y su botón primario grande y oscuro. Medido en el navegador: 197 px +
 * 177 px, o sea 374 px de cabecera para dos acciones.
 *
 * Y lo que lo delataba estaba en la MISMA pantalla, más abajo: los seis
 * informes ya se ofrecen en una tabla, una fila por informe, con un icono para
 * verlo. Informes tenía dos lenguajes para lo mismo —elige un documento y
 * llévatelo— y el de arriba era el caro. Así que estos dos pasan al de abajo:
 * una fila por documento, lo que hace a la izquierda y lo que se pulsa a la
 * derecha. 374 px → 260 px, y sin un solo botón primario.
 *
 * Lo que vigila esto es que al compactar no se haya caído nada por el camino,
 * que es lo que suele pasar: el año, el Excel de la memoria, el aviso del
 * ejercicio cerrado y los rótulos de los dos desplegables, que no tienen
 * etiqueta visible y sin `aria-label` dejan a un lector de pantalla con dos
 * listas de años sin decir de qué son.
 */
import { fuenteDe } from './fuentes.mjs'

export default async function ({ caso }) {
  const pantalla = await fuenteDe('src/pages/app/Informes.tsx')

  // La lista existe y tiene una fila por documento.
  caso('hay una lista de documentos', true, /<ul className="documentos">/.test(pantalla))
  const filas = pantalla.match(/className="documentos__fila"/g) ?? []
  caso('con una fila por documento', 2, filas.length)

  /*
   * EL TROZO SE ACOTA, Y SE COMPRUEBA QUE SE HA ACOTADO. Un `indexOf` que no
   * encuentra devuelve -1, y `slice(-1, n)` no da error: da un trozo de otro
   * sitio o vacío, y la guarda se pone verde mirando donde no debe. Ya pasó en
   * este repositorio.
   */
  const desde = pantalla.indexOf('<ul className="documentos">')
  const hasta = pantalla.indexOf('<SeccionPyG')
  caso('se encuentra la lista', true, desde > 0 && hasta > desde)
  const lista = pantalla.slice(desde, hasta)

  // Los dos documentos siguen siendo los dos documentos, y en ese orden: la
  // memoria es el papel que abre el cabildo general y el estado de cuentas es
  // una de sus partes, así que quien prepara la carpeta empieza por la memoria.
  const posMemoria = lista.indexOf('Memoria del ejercicio')
  const posEstado = lista.indexOf('Estado de cuentas anual')
  caso('está la memoria', true, posMemoria >= 0)
  caso('está el estado de cuentas', true, posEstado >= 0)
  caso('y la memoria va primera', true, posMemoria < posEstado)

  /*
   * LO QUE NO SE PUEDE PERDER AL COMPACTAR.
   */
  caso('la memoria se puede imprimir', true, /setImprimiendo\('memoria'\)/.test(lista))
  caso('y bajar en Excel', true, /onClick=\{exportarMemoriaExcel\}/.test(lista))
  caso('el estado de cuentas se puede descargar', true, /setImprimiendoEstado\(true\)/.test(lista))
  caso('cada documento elige su año', 2, (lista.match(/<select/g) ?? []).length)
  caso('el año de la memoria es el de la memoria', true, /setAnioMemoria\(Number/.test(lista))
  caso('y el del estado de cuentas el suyo', true, /setAnioEstado\(Number/.test(lista))

  /*
   * EL AVISO DEL EJERCICIO CERRADO. Es la letra pequeña que dice que el censo
   * que sale en la memoria de un año pasado es el de HOY, no el de aquel año.
   * Va impreso dentro del documento, pero hay que decirlo ANTES de mandarlo a
   * imprimir, no al leer el papel. Y va pegado a la fila de la memoria, que es
   * de quien habla: en una lista de dos documentos, un aviso suelto al final no
   * dice de cuál es.
   */
  caso('avisa si el ejercicio ya está cerrado', true, /!memoria\.esElAnioEnCurso/.test(lista))
  caso('y el aviso va dentro de la lista', true, /className="documentos__aviso"/.test(lista))
  const posAviso = lista.indexOf('documentos__aviso')
  caso('pegado a la memoria, no al final', true, posAviso > posMemoria && posAviso < posEstado)

  /*
   * LOS DOS DESPLEGABLES DE AÑO NO TIENEN ETIQUETA VISIBLE —el nombre del
   * documento está en la otra mitad de la fila—, así que el `aria-label` es lo
   * único que los distingue para quien no ve la pantalla. Y tienen que ser
   * DISTINTOS entre sí: dos «Ejercicio» no distinguen nada.
   */
  const rotulos = [...lista.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1])
  caso('los dos años van rotulados', 2, rotulos.length)
  caso('y con rótulos distintos', 2, new Set(rotulos).size)
  caso('y cada uno nombra su documento', true,
    rotulos.every((r) => /memoria|estado de cuentas/i.test(r)))

  /*
   * Y NO VUELVEN LOS BOTONAZOS. Lo que se pidió quitar es justo esto: un botón
   * primario grande por documento. En una lista de documentos ninguno es «el»
   * importante, y marcarlos todos como importantes es no marcar ninguno.
   */
  caso('ningún botón primario en la lista', false, /btn-primary/.test(lista))
  caso('y los de la fila son pequeños', true,
    (lista.match(/btn-sm/g) ?? []).length >= 3)

  /*
   * LAS ACCIONES NO SE ESTIRAN. Si la columna de los botones puede crecer, el
   * desplegable de año se estira a lo ancho de la fila y el conjunto vuelve a
   * parecer un botonazo. En pantalla estrecha sí baja entero a su línea.
   */
  const css = await fuenteDe('src/styles/global.css')
  caso('las acciones no se estiran', true,
    /\.documentos__acciones \{[^}]*flex: none/.test(css))
  caso('y en el móvil bajan a su propia línea', true,
    /@media \(max-width: 640px\) \{\s*\.documentos__acciones \{ flex: 1 1 100%/.test(css))
  // La descripción es la que puede crecer, que es la que lleva el texto largo.
  caso('la descripción es la que crece', true,
    /\.documentos__que \{ flex: 1 1 18rem/.test(css))
}
