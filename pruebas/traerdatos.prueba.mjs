/**
 * «TRAER VUESTROS DATOS», la pestaña de Ajustes donde se sube el archivo UNA vez.
 *
 * Antes había que ir pantalla por pantalla —el censo en Hermanos, los recibos
 * en Cuotas, la caja en Tesorería, las piezas en Inventario— y buscar el mismo
 * archivo cuatro veces en la carpeta de descargas. Y es lo primero que hace
 * una hermandad, el día del alta, cuando menos sabe dónde está cada cosa.
 *
 * Lo que se comprueba aquí no es la pintura: son las tres decisiones que, si
 * se tuercen, convierten esta pantalla en un peligro.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/components/TraerDatos.tsx', 'utf8')
  const cfg = await readFile('src/pages/app/Configuracion.tsx', 'utf8')

  // --- Está donde se dice que está.
  caso('la pestaña existe en Ajustes', true, /\{ id: 'traer', label: 'Traer vuestros datos'/.test(cfg))
  caso('y se pinta', true, /seccion === 'traer' && <TraerDatos \/>/.test(cfg))

  /*
   * --- 1. NO HAY UN BOTÓN QUE LO IMPORTE TODO DE GOLPE ---
   *
   * Sería un botón que mueve el censo, el dinero y el patrimonio a la vez sin
   * enseñar antes qué va a pasar. El paso de «esto es lo que va a pasar» es la
   * razón por la que alguien se atreve a pulsar el otro: lo que se ahorra aquí
   * es buscar el archivo cuatro veces, no el repaso.
   *
   * Se comprueba por donde no se puede disimular: esta pantalla no llama a
   * `aplicarTabla` ni a `aplicar`. Quien importa siguen siendo los asistentes.
   */
  caso('no aplica nada por su cuenta', false, /aplicarTabla\(|\baplicar\(/.test(src))
  caso('reutiliza el asistente del censo', true, /<ImportarCenso\b/.test(src))
  caso('y el de tablas, tres veces', 3, (src.match(/<ImportarTabla\b/g) ?? []).length)
  caso('cada uno con el archivo ya leído', 4, (src.match(/libroInicial=\{/g) ?? []).length)

  /*
   * --- 2. LAS CUOTAS VEN EL CENSO RECIÉN IMPORTADO ---
   *
   * Aquí se trae el censo y, dos clics después, el historial. Los recibos
   * enganchan por DNI. Con un censo congelado al montar la pantalla, el
   * asistente diría «no hay ningún hermano con el DNI …» en las mil filas,
   * sobre un censo que acaba de entrar y sí está.
   */
  caso('el contexto sale del censo vivo', true, /useContextoDeImportacion\(hermanos\)/.test(src))
  caso('y el censo es el de la tabla, no una copia', true, /useSupabaseTable<Hermano>/.test(src))

  /*
   * --- 3. EL CENSO SE BUSCA CON SU PROPIO EMPAREJADOR ---
   *
   * `hojaDelCenso` conoce sinónimos que el genérico no: «Nº de cuenta» es un
   * IBAN, «¿está de baja?» significa lo contrario que activo. Si esta pantalla
   * dijera «no hay pestaña de censo» y el asistente de Hermanos sí la
   * encontrara, no habría forma de saber a cuál creer.
   */
  caso('el censo va por hojaDelCenso', true, /hojaDelCenso\(hojas\)/.test(src))
  caso('y las tablas por hojaQueCuadra', true, /hojaQueCuadra\(hojas, campos\)/.test(src))

  // --- Y dice QUÉ falta, no solo que no se puede. «No se ha encontrado» sobre
  // un archivo que la hermandad sabe que trae sus cuotas se lee como que la
  // aplicación no sirve; nombrando la columna, se arregla en Excel en un minuto.
  caso('nombra las columnas que faltan', true, /Falta decir cuál es \$\{x\.faltan\.join/.test(src))
  caso('y deja repasarlas igualmente', true, /Repasar las columnas/.test(src))

  // El input de archivo va en `.importar-suelta`, que es la clase que lo
  // esconde y deja el botón. Con otra sale el «Examinar…» del sistema al lado.
  caso('el botón de archivo está bien vestido', true, /className="importar-suelta"/.test(src))
  // Sin `accept`: con la lista de tipos puesta, el cuadro del sistema grisea
  // archivos que sí valen y se lee como que la aplicación está rota.
  caso('el selector no filtra por tipo', false, /accept=/.test(src))

  await losAsistentesArrancanConElArchivo({ cargar, caso })
}

/**
 * Que los dos asistentes sepan arrancar con un archivo ya leído.
 *
 * Es lo que hace que la pestaña de Ajustes no sea otro importador más, sino el
 * mismo de siempre con el primer paso ya hecho. Si esto se rompiera, la
 * pantalla se abriría pidiendo el archivo otra vez y no habría ahorrado nada.
 */
async function losAsistentesArrancanConElArchivo({ caso }) {
  const { readFile } = await import('node:fs/promises')
  for (const fichero of ['src/components/ImportarCenso.tsx', 'src/components/ImportarTabla.tsx']) {
    const src = await readFile(fichero, 'utf8')
    const nombre = fichero.split('/').pop()
    caso(`${nombre} acepta un libro ya leído`, true, /libroInicial\?: \{ nombre: string; hojas: Hoja\[\] \} \| null/.test(src))
    caso(`${nombre} entra directo en columnas`, true, /if \(!abierto \|\| !libroInicial\) return/.test(src))
    /*
     * Y SOLO SE SALTA ESE PASO. Los otros tres siguen enteros: aquí se traen
     * recibos y patrimonio, y el tercero —«esto es lo que va a pasar»— no se
     * puede saltar por venir el archivo de otro sitio.
     */
    caso(`${nombre} conserva el ensayo`, true, /setPaso\('ensayo'\)/.test(src))
    caso(`${nombre} conserva el deshacer`, true, /setDeshecho\(/.test(src))
  }
}
