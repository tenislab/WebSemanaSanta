/**
 * LA FICHA DEL HERMANO, PARTIDA EN SEIS PIEZAS: QUE SIGA PARTIDA.
 *
 * Las veintitrés guardas que ya vigilan el censo leen `fuenteDelCenso()`, que
 * pega `Hermanos.tsx` con toda la carpeta `censo/`: por eso no se pusieron
 * rojas al mudar los bloques, y por eso tampoco notarían que alguien los
 * devuelve. Esto vigila la propiedad que hace que el corte valga para algo, y
 * que no es el número de líneas.
 *
 * LO QUE SE VIGILA Y POR QUÉ. Lo que abarata un corte es MOVER EL ESTADO, no
 * pasarlo: cada pieza se llevó sus variables dentro, y el beneficio de verdad
 * no es que el fichero sea más corto —es que teclear una letra del nombre ya no
 * repinta las mil filas del censo—. Devolver un `useState` a `Hermanos.tsx` deja
 * el fichero igual de corto y se lleva el beneficio entero por delante, en
 * silencio. Ese es el retroceso que esto frena.
 *
 * Y NO SE MIRA EL CENSO PEGADO, sino fichero a fichero: la gracia está en
 * CUÁL de ellos tiene cada cosa, y la fuente pegada no puede distinguirlo.
 */
import { fuente, sinComentarios } from './fuentes.mjs'

export default async function ({ caso }) {
/*
 * `fuente` Y NO `fuenteDe`, que es lo contrario de lo que hacen las otras
 * veintitrés. `fuenteDe('src/pages/app/Hermanos.tsx')` devuelve el censo
 * PEGADO —el padre más toda la carpeta `censo/`—, que es justo lo que allí hace
 * falta y aquí lo estropea todo: con la carpeta dentro, «este `useState` ya no
 * está en la pantalla del censo» es falso siempre, porque está en la pieza. La
 * primera versión de esta prueba sacó quince rojos por eso.
 */
  const padre = sinComentarios(await fuente('src/pages/app/Hermanos.tsx'))
  const corregir = sinComentarios(await fuente('src/pages/app/censo/FichaCorregir.tsx'))
  const etiquetas = sinComentarios(await fuente('src/pages/app/censo/FichaEtiquetas.tsx'))
  const sueltos = sinComentarios(await fuente('src/pages/app/censo/FichaDatosSueltos.tsx'))
  const cobro = sinComentarios(await fuente('src/pages/app/censo/FichaCobro.tsx'))
  const certificado = sinComentarios(await fuente('src/pages/app/censo/FichaCertificado.tsx'))

  // ---------------------------------------------------------------------
  // 1. EL ESTADO DE CADA FORMULARIO VIVE EN SU PIEZA, NO ARRIBA.
  // ---------------------------------------------------------------------
  /*
   * Son los nueve borradores que estaban en la pantalla del censo. Cada uno
   * repintaba la tabla entera —mil filas en una hermandad mediana— a cada
   * tecla, porque el estado estaba en el componente que pinta la tabla.
   */
  const BORRADORES = [
    ['ident', corregir, 'FichaCorregir'],
    ['identError', corregir, 'FichaCorregir'],
    ['identSaved', corregir, 'FichaCorregir'],
    ['contacto', corregir, 'FichaCorregir'],
    ['contactoSaved', corregir, 'FichaCorregir'],
    ['nuevaEtiqueta', etiquetas, 'FichaEtiquetas'],
    ['ibanDraft', cobro, 'FichaCobro'],
    ['ibanError', cobro, 'FichaCobro'],
    ['ibanSaved', cobro, 'FichaCobro'],
  ]
  for (const [nombre, pieza, donde] of BORRADORES) {
    const declara = new RegExp(`const \\[${nombre}, set`)
    caso(`\`${nombre}\` se declara en ${donde}`, true, declara.test(pieza))
    caso(`y ya no en la pantalla del censo`, false, declara.test(padre))
  }

  /*
   * Y LAS FUNCIONES CON ELLOS. Un `setIdent` en la pieza y un
   * `guardarIdentidad` en el padre es lo peor de los dos mundos: el estado
   * baja y el manejador tiene que subir otra vez como prop.
   */
  const MANEJADORES = [
    ['guardarIdentidad', corregir, 'FichaCorregir'],
    ['guardarContacto', corregir, 'FichaCorregir'],
    ['crearEtiqueta', etiquetas, 'FichaEtiquetas'],
    ['toggleEtiquetaHermano', etiquetas, 'FichaEtiquetas'],
    ['guardarIban', cobro, 'FichaCobro'],
    ['expedirCertificado', certificado, 'FichaCertificado'],
  ]
  for (const [nombre, pieza, donde] of MANEJADORES) {
    const declara = new RegExp(`function ${nombre}\\(`)
    caso(`\`${nombre}\` vive en ${donde}`, true, declara.test(pieza))
    caso(`y no se quedó en el censo`, false, declara.test(padre))
  }

  // ---------------------------------------------------------------------
  // 2. LOS DATOS SUELTOS NO TIENEN ESTADO, Y ES A PROPÓSITO.
  // ---------------------------------------------------------------------
  /*
   * La foto, el bautismo, la talla y las notas del día de la salida se guardan
   * AL ESCRIBIR, sin botón, como el resto de la ficha. Un borrador local aquí
   * añadiría un «Guardar» que nadie espera y una forma de perder lo escrito al
   * cerrar el cajón.
   */
  caso('los datos sueltos no guardan borrador', false, /useState/.test(sueltos))
  caso('y son dos props', true, /\{ selected, aplicarHermano \}/.test(sueltos))

  // ---------------------------------------------------------------------
  // 3. EL CATÁLOGO DE ETIQUETAS SE RECIBE, NO SE PIDE EN LA FICHA.
  // ---------------------------------------------------------------------
  /*
   * `useEtiquetas()` llama a `cargarEtiquetasDeLaBase()` al montar. La ficha se
   * monta cada vez que alguien abre un hermano, así que llamarlo aquí sería una
   * lectura de red por hermano que se mira — y repasar el censo es abrir
   * cuarenta fichas seguidas. El catálogo lo tiene ya la pantalla del censo,
   * que lo necesita para el etiquetado masivo, y baja como prop.
   */
  caso('la ficha de etiquetas no pide el catálogo', false, /useEtiquetas\(/.test(etiquetas))
  caso('lo recibe de la pantalla', true, /etiquetas: string\[\]/.test(etiquetas))
  caso('y la pantalla sí lo pide, una vez', true, /useEtiquetas\(\)/.test(padre))

  // ---------------------------------------------------------------------
  // 4. LOS CAMPOS SE VUELVEN A SEMBRAR AL CAMBIAR DE HERMANO.
  // ---------------------------------------------------------------------
  /*
   * ES EL FALLO CLÁSICO DE MUDAR UN `useEffect`: el efecto que siembra el
   * formulario con los datos del hermano abierto se quedó en el padre y los
   * `setIdent` bajaron, o la dependencia se cambió por `[selected]` entero. Lo
   * primero deja la ficha con los datos del hermano ANTERIOR —que es tocar la
   * ficha de quien no toca—; lo segundo reinicia el formulario mientras se
   * está escribiendo en él.
   */
  caso('el efecto que siembra está en la pieza', true,
    /\}, \[selected\.id\]\)/.test(corregir))
  caso('y depende del id, no de la ficha entera', false, /\}, \[selected\]\)/.test(corregir))
  caso('siembra la identidad', true, /setIdent\(\{/.test(corregir))
  caso('y el contacto', true, /setContacto\(\{/.test(corregir))

  // ---------------------------------------------------------------------
  // 5. LAS REGLAS QUE PROTEGEN DATOS SE MUDARON CON SU BLOQUE.
  // ---------------------------------------------------------------------
  /*
   * Mudar pantalla es fácil; mudar pantalla PERDIENDO UNA COMPROBACIÓN por el
   * camino también. Estas tres son las que no se pueden caer: sin ellas se
   * cuela un DNI repetido o un número de escalafón de otro, y el error que sale
   * es un «duplicate key» de la base, después de cerrar el panel.
   */
  caso('el DNI solo se valida si se ha tocado', true, /!mismoDni\(dni, selected\.dni\)/.test(corregir))
  caso('no se repite el DNI', true, /h\.id !== selected\.id && mismoDni\(h\.dni, dni\)/.test(corregir))
  caso('ni el número de hermano', true, /h\.id !== selected\.id && h\.numero === numero/.test(corregir))
  /* Y el 0 se deja pasar: el hermano civil no ocupa escalafón. */
  caso('el 0 no cuenta como repetido', true, /numero > 0 && hermanos\.some/.test(corregir))

  /*
   * CAMBIAR EL CONTACTO AVISA AL HERMANO. Es lo primero que se cae al mudar un
   * bloque, porque no se ve en la pantalla: ni el apunte en el registro ni el
   * correo tienen efecto visible en la ficha.
   */
  caso('cambiar el contacto lo apunta', true, /avisarCambiosHermano\(selected, nuevo\)/.test(corregir))
  caso('y le manda correo', true, /avisarPorCorreo\(/.test(corregir))
  caso('corregir la identidad también se apunta', true,
    /detalle: `Corrigió los datos de la ficha de \$\{nombre\}`/.test(corregir))

  // ---------------------------------------------------------------------
  // 6. LA PANTALLA DEL CENSO COLOCA LAS PIEZAS.
  // ---------------------------------------------------------------------
  /*
   * El orden se mira aquí, en el padre, que es quien lo decide. Es el reparto
   * que se acordó al reordenar la ficha: primero lo que se consulta —cuotas,
   * cortejo, certificado—, luego lo que se corrige, y la administración al
   * final, que es lo que se usa una vez en la vida del hermano.
   */
  const ORDEN = ['FichaCertificado', 'FichaCorregir', 'FichaDatosSueltos', 'FichaEtiquetas', 'FichaCobro', 'FichaAdmin']
  const donde = ORDEN.map((p) => padre.indexOf(`<${p}`))
  caso('las seis piezas se colocan', true, donde.every((i) => i > 0))
  caso('y en el orden de la ficha', true, donde.every((i, n) => n === 0 || i > donde[n - 1]))
}
