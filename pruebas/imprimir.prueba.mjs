/**
 * Lo que sale por la impresora.
 *
 * Estos son los papeles que la hermandad da EN MANO: el recibo de la cuota, la
 * papeleta de sitio, el justificante de un pago, el orden del cortejo, el
 * padrón que se lleva al cabildo de cuentas. Se comprobaron generando los PDF
 * de verdad a tamaño A4 y mirándolos uno a uno.
 *
 * Tres cosas estaban mal, y ninguna se ve en pantalla:
 *
 *  1. LAS DOS HOJAS EN BLANCO. Un recibo de 14 cm salía en TRES folios: el
 *     recibo y dos hojas más, en blanco y teñidas del color de fondo de la
 *     aplicación. El documento se saca del flujo y lo demás se esconde con
 *     `visibility: hidden`... que esconde pero NO quita sitio, así que la
 *     pantalla de Cuotas seguía midiendo sus 1.987 px y la impresora contaba
 *     tres hojas. Una hermandad que imprime 400 recibos se encontraba con 800
 *     folios de más.
 *
 *  2. EL PIE PISANDO LA ÚLTIMA LÍNEA. El pie que se repite en cada hoja va
 *     fijo al fondo y no le quita sitio a nada: cuando la tabla llenaba la
 *     hoja justa, se pintaba encima de la última fila.
 *
 *  3. EL DOCUMENTO QUE SE TIRABA A MEDIO IMPRIMIR. `window.print()` no promete
 *     devolver el control cuando el papel ya ha salido.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile('src/styles/global.css', 'utf8')

  // ---------------------------------------------------------------------
  // 1. Las dos hojas en blanco
  // ---------------------------------------------------------------------
  caso('la app deja de ocupar al imprimir', true,
    css.includes('body:not(.print-masivo) #root { height: 0; overflow: hidden; }'))
  // El `:not()` no es un adorno: en la impresión masiva de papeletas el
  // contenido que se imprime sí vive dentro de #root y necesita su alto para
  // paginar. Sin la excepción salían las 400 papeletas en un folio.
  caso('menos en la impresión masiva', true, css.includes('body:not(.print-masivo)'))
  // Y el papel es blanco: con «imprimir fondos» activado —que al guardar en
  // PDF se activa solo— el folio entero salía del color hueso de la app.
  caso('el papel va en blanco', true, /@media print \{[^}]*\}[\s\S]{0,400}html, body \{ background: #fff !important; \}/.test(css))

  // ---------------------------------------------------------------------
  // 2. El hueco del pie repetido
  // ---------------------------------------------------------------------
  // Un `tfoot` es lo único que Chrome repite en TODAS las hojas y además le
  // reserva su alto. Va vacío: el hueco es todo su trabajo.
  caso('en pantalla el hueco no existe', true, css.includes('.print-pie-hueco { display: none; }'))
  caso('y al imprimir es un pie de tabla', true, css.includes('.print-pie-hueco { display: table-footer-group; }'))
  caso('con alto de sobra para el pie', true, /\.print-pie-hueco td \{[\s\S]{0,80}height: 10mm/.test(css))
  for (const doc of ['src/components/InformeImpreso.tsx', 'src/components/EstadoCuentas.tsx']) {
    const t = await readFile(doc, 'utf8')
    caso(`${doc.split('/').pop()} reserva el hueco`, true, t.includes('className="print-pie-hueco"'))
  }

  // El pie sigue fijo abajo (se probó bajarlo al margen y desaparecía: el
  // navegador recorta lo fijo al área de contenido).
  caso('el pie sigue clavado abajo', true, /\.print-hoja \{[\s\S]{0,200}position: fixed; bottom: 0/.test(css))

  // ---------------------------------------------------------------------
  // 3. Nada se tira mientras se imprime
  // ---------------------------------------------------------------------
  const informes = await readFile('src/pages/app/Informes.tsx', 'utf8')
  caso('el estado de cuentas espera a afterprint', true, informes.includes("window.addEventListener('afterprint', recoger"))
  caso('y no se recoge en la línea siguiente', false, /window\.print\(\)\n\s*setImprimiendoEstado\(false\)/.test(informes))
  // Red de seguridad: hay navegadores viejos que no lanzan `afterprint`, y sin
  // ella el Estado de Cuentas se quedaría tapando la pantalla para siempre.
  caso('con red de seguridad', true, /setTimeout\(recoger, 10000\)/.test(informes))

  /*
   * Y TODA LA PANTALLA MIRA AL MISMO SITIO.
   *
   * Los informes ya se calculaban con los datos de la base —está contado en la
   * cabecera de `Informes.tsx`: el Estado de Cuentas llegó a imprimirse con
   * todas las partidas a 0,00 €— pero el arreglo se quedó a medias. Los cuatro
   * recuadros de arriba (Hermanos, Cobrado, Papeletas, BALANCE) seguían
   * leyéndose del navegador con `leerDatos`, así que la misma pantalla decía
   * dos cosas: los recuadros, una; los informes de debajo, otra.
   *
   * Con base de datos conectada `leerDatos` devuelve VACÍO si este navegador
   * no tiene copia (ver `lib/persistencia.ts`), así que en un ordenador
   * recién estrenado el Balance de tesorería salía 0 € encima de unos
   * informes con las cifras de verdad.
   *
   * Se comprueba que no queda ni un `leerDatos` en la pantalla: mientras haya
   * uno, hay dos fuentes para la misma pregunta.
   */
  caso('Informes no lee ninguna colección del navegador', false, /\bleerDatos\(/.test(informes))
  /*
   * Y QUE LOS RECUADROS SE RECALCULEN. La lista de dependencias estaba vacía,
   * o sea que se calculaban una vez al abrir y se quedaban congelados aunque
   * los datos de la base llegaran un segundo después — que es lo que pasa
   * siempre, porque llegan por la red.
   */
  caso('y los recuadros se recalculan cuando llegan los datos', true,
    /const kpis = useMemo\([\s\S]*?\}, \[hermanos, cuotas, papeletas, movimientos\]\)/.test(informes))

  const papeletas = await readFile('src/pages/app/Papeletas.tsx', 'utf8')
  caso('las papeletas en masa, igual', true, papeletas.includes("window.addEventListener('afterprint', recoger"))
  caso('y también con red', true, /setTimeout\(recoger, 10000\)/.test(papeletas))

  // ---------------------------------------------------------------------
  // 4. El mismo nombre en todos los papeles
  // ---------------------------------------------------------------------
  // El censo impreso salía encabezado «Tu hermandad» mientras el recibo de la
  // misma hermandad, impreso cinco minutos antes, llevaba su nombre de verdad.
  const hermanos = await readFile('src/pages/app/Hermanos.tsx', 'utf8')
  caso('el censo impreso lleva el nombre de la hermandad', true,
    hermanos.includes('useHermandadSettings(fallbackNombre)'))
  for (const [modulo, fichero] of [['Cuotas', 'Cuotas'], ['Tesorería', 'Tesoreria'], ['Papeletas', 'Papeletas'],
    ['Cortejo', 'Cortejo'], ['Informes', 'Informes']]) {
    const t = await readFile(`src/pages/app/${fichero}.tsx`, 'utf8')
    caso(`${modulo} ya lo llevaba`, true, t.includes('useHermandadSettings(fallbackNombre)'))
  }

  // ---------------------------------------------------------------------
  // 5. Lo que se decidió NO cambiar
  // ---------------------------------------------------------------------
  // El padrón de nueve columnas mide 962 px en un folio de 688, y Chrome lo
  // resuelve encogiendo la hoja al 72 %. Se probó dejar que las celdas
  // partieran: cabía al 100 %... y salía «Acti / vo», «Baj / a» y los
  // teléfonos en tres líneas, en cinco hojas en vez de dos.
  caso('el informe no parte las palabras', true,
    /\.informe-doc__table th, \.informe-doc__table td \{ padding: 3pt 8pt 3pt 0; white-space: nowrap; \}/.test(css))

  // Y lo que ya estaba bien, que no se caiga: cabeceras repetidas y filas
  // enteras.
  caso('la cabecera se repite en cada hoja', true, css.includes('thead { display: table-header-group; }'))
  caso('ninguna fila se parte en dos', true, /tr, \.cortejo-orden__tramo, \.informe-bloque[^}]*break-inside: avoid/.test(css))
}
