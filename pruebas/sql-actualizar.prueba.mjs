/**
 * QUE «ACTUALIZAR.SQL» SE PUEDA EJECUTAR SOBRE UNA BASE QUE YA FUNCIONA.
 *
 * De dónde sale esto. A una hermandad con la base montada se le venía diciendo
 * «ejecuta estos cinco ficheros sueltos», y en esa lista iba
 * `permisos-por-hermandad.sql`. Ese fichero redefine `modulo_permitido()`, y
 * `hermano-con-cargo.sql` —que en el instalador va DESPUÉS— la vuelve a
 * definir con una vía más: el hermano que lleva un cargo en su ficha.
 *
 * De todas las definiciones de una función manda la última que se ejecuta. Así
 * que ejecutar el fichero viejo por su cuenta, meses después, RETIRA esa
 * tercera vía: el tesorero que además es hermano se queda sin Tesorería, el
 * secretario sin el censo, y la única pista es un «no tienes permiso» donde
 * ayer no lo había. Nada avisa, porque el SQL se ejecuta sin error.
 *
 * La regla que evita esa clase de accidente es mecánica, así que se comprueba
 * mecánicamente: en el fichero de actualizar solo entra lo que NADIE redefine
 * después.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const { generar, PIEZAS_ACTUALIZACION } = await import('../scripts/generar-actualizar.mjs')
  const { PIEZAS } = await import('../scripts/generar-todo-en-uno.mjs')

  const enDisco = await readFile('supabase/ACTUALIZAR.sql', 'utf8')
  const recienHecho = await generar()
  caso('ACTUALIZAR.sql está al día', true, enDisco === recienHecho)
  if (enDisco !== recienHecho) {
    console.log('    → ejecuta: node scripts/generar-actualizar.mjs')
  }

  const orden = PIEZAS.map(([f]) => f)
  const deActualizar = PIEZAS_ACTUALIZACION.map(([f]) => f)

  // Nada inventado: todo lo que actualiza tiene que estar también en el
  // instalador, o una base nueva nacería sin ello.
  caso('todo lo de actualizar está en el instalador', '',
    deActualizar.filter((f) => !orden.includes(f)).join(', '))

  // Y en el mismo orden relativo, que es el orden en que se puede ejecutar.
  const posiciones = deActualizar.map((f) => orden.indexOf(f))
  caso('y en el mismo orden', true, posiciones.every((p, i) => i === 0 || p > posiciones[i - 1]))

  /*
   * --- LA COMPROBACIÓN QUE IMPORTA ---
   *
   * Para cada fichero de actualizar, se miran las funciones que define y se
   * busca si alguno POSTERIOR del instalador vuelve a definir alguna. Si la
   * hay, ese fichero no se puede ejecutar suelto: dejaría la versión vieja.
   */
  const defineFunciones = async (fichero) => {
    const texto = await readFile(`supabase/${fichero}`, 'utf8')
    return new Set(
      [...texto.matchAll(/create (?:or replace )?function\s+([a-z_0-9]+)\s*\(/gi)].map((m) => m[1]),
    )
  }
  const pisadas = []
  for (const fichero of deActualizar) {
    const mias = await defineFunciones(fichero)
    if (mias.size === 0) continue
    for (const posterior of orden.slice(orden.indexOf(fichero) + 1)) {
      for (const fn of await defineFunciones(posterior)) {
        if (mias.has(fn)) pisadas.push(`${fichero} define ${fn}(), que ${posterior} redefine después`)
      }
    }
  }
  caso('ninguna pieza redefine algo que otra pisa después', '', pisadas.join(' · '))

  /*
   * --- Y EL CASO CONCRETO QUE PASÓ, escrito aparte ---
   * Aunque la comprobación de arriba ya lo cubre, se deja nombrado: es el que
   * hay que reconocer si alguien vuelve a proponerlo.
   */
  caso('permisos-por-hermandad.sql NO va en actualizar', false,
    deActualizar.includes('permisos-por-hermandad.sql'))
  // De ese fichero solo hacía falta el relleno de «eventos» y «web», que vive
  // aparte justamente por esto y no toca ninguna función.
  caso('pero sí el relleno de eventos y web', true,
    deActualizar.includes('permisos-eventos-y-web.sql'))
  const relleno = await readFile('supabase/permisos-eventos-y-web.sql', 'utf8')
  caso('y ese relleno no define ninguna función', false, /create (or replace )?function/i.test(relleno))
  caso('ni resiembra la lista entera', false, /sembrar_permisos_de_fabrica\(/.test(relleno))
  // Solo añade a los cargos que la hermandad ya reconoce: si nunca tuvo
  // «Vocal», no se le inventa uno.
  caso('solo añade a cargos que ya existen', true, /where exists \(\s*select 1 from permisos_cargo pc/.test(relleno))
  caso('y no pisa lo que haya', true, /on conflict do nothing;/.test(relleno))

  /*
   * --- pg_cron se enciende a mano ---
   * Metido aquí, el fichero entero fallaría en la primera línea de quien no
   * haya activado la extensión, y con él todo lo que viniera detrás.
   */
  caso('las tareas programadas no van dentro', false, deActualizar.includes('tareas-programadas.sql'))
  caso('pero se explica dónde se activan', true, /Database → Extensions → pg_cron/.test(enDisco))

  /*
   * --- QUE DIGA CÓMO HA QUEDADO ---
   *
   * En el editor de Supabase solo se ve el resultado de la última consulta, y
   * «Success. No rows returned» no distingue entre «se ha hecho todo» y «se ha
   * hecho la mitad». El informe del final es la diferencia entre creer que
   * está puesto y saberlo.
   */
  caso('termina con el informe de qué ha quedado puesto', true, /order by esta, que;\s*$/.test(enDisco))
  for (const senal of ['ajustes_cuotas', 'visitas_web', 'suscriptores_web', "id = 'imagenes'", "id = 'copias'"]) {
    caso(`el informe comprueba ${senal}`, true, enDisco.includes(senal))
  }

  // Y que lo nuevo de verdad esté dentro, no solo nombrado en la cabecera.
  caso('lleva la columna de ajustes de cuotas', true,
    /alter table hermandad_settings add column if not exists ajustes_cuotas jsonb;/.test(enDisco))
  caso('lleva el almacén de imágenes', true, /insert into storage\.buckets[\s\S]{0,200}'imagenes'/.test(enDisco))

  /*
   * QUE NO SE HAYA CONVERTIDO EN EL INSTALADOR.
   *
   * `ACTUALIZAR.sql` existe para traer SOLO lo que le falta a una base que ya
   * funciona. El día que se le cuele el esquema entero deja de tener sentido:
   * son 5.800 líneas que nadie lee, y lo que no se lee no se revisa.
   *
   * Se comprueba por lo que LLEVA DENTRO y no solo por lo que ocupa. El
   * tamaño es un indicio flojo —cada arreglo nuevo lo alarga un poco, y una
   * línea arbitraria acaba moviéndose para que pase la prueba, que es
   * justamente cómo una prueba deja de servir—. Lo que no puede aparecer
   * nunca es la creación de las tablas base: eso es el instalador.
   */
  for (const delInstalador of [
    'create table if not exists hermanos',
    'create table if not exists cuotas',
    'create table if not exists papeletas',
    'create table if not exists movimientos',
  ]) {
    /*
     * Con el nombre ENTERO, no como prefijo. `movimientos_stock` —la tabla de
     * la tienda que dice por qué subió o bajó el género— empieza por
     * «movimientos», y con `includes` a secas hacía saltar esta prueba por una
     * tabla que sí tiene que estar aquí.
     */
    const suyo = new RegExp(`${delInstalador}\\s*\\(`)
    caso(`no trae «${delInstalador}»: eso es el instalador`, false, suyo.test(enDisco))
  }

  /*
   * Y QUE SIGA SIENDO UN SUBCONJUNTO, no una copia.
   *
   * Aquí había una comprobación de tamaño —«menos de la mitad de líneas que el
   * instalador»— y la he quitado porque medía lo que no era. Las dos listas
   * comparten las piezas nuevas: cada arreglo entra en las dos, así que el
   * instalador crece igual de rápido pero partiendo de mucho más alto, y la
   * proporción sube sola hasta cruzar cualquier raya que se ponga. Al cruzarla
   * hoy —4.235 frente a 8.095— la salida honesta no era subir la raya: el
   * comentario de ahí arriba ya avisa de que mover el listón para que pase la
   * prueba es justamente cómo una prueba deja de servir.
   *
   * Lo que de verdad importa no es cuánto ocupa sino QUÉ TRAE: que sea una
   * parte de lo que instala el otro y no el otro entero. Eso son las piezas,
   * y eso no se mueve solo.
   */
  const piezas = (texto) => texto.split('\n')
    .map((l) => l.match(/^--\s+([A-Z0-9-]+\.SQL) —/)?.[1])
    .filter(Boolean)
  const suyas = piezas(enDisco)
  const delOtro = piezas(await readFile('supabase/TODO-EN-UNO.sql', 'utf8'))
  caso('el instalador trae más piezas que la actualización', true, delOtro.length > suyas.length)
  caso('y las de la actualización están todas en el instalador', [],
    suyas.filter((p) => !delOtro.includes(p)))
}
