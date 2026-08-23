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

  // Mucho más corto que el instalador: si no lo fuera, no habría razón para
  // que existiera.
  const todoEnUno = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  caso('es bastante más corto que el instalador', true,
    enDisco.split('\n').length < todoEnUno.split('\n').length / 3)
}
