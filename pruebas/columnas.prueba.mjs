/**
 * QUE LA APLICACIÓN NO ESCRIBA COLUMNAS QUE LA BASE NO TIENE.
 *
 * EL DESTROZO. `tramoToRow` llevaba escribiendo `hora_citacion` en cada
 * guardado de tramo, y esa columna NO EXISTÍA en ningún `.sql`. Postgres
 * rechaza la sentencia ENTERA cuando una columna no existe:
 *
 *     column "hora_citacion" of relation "tramos" does not exist
 *
 * Así que NINGÚN TRAMO SE GUARDABA NUNCA. Ni al crear ni al editar.
 *
 * Y esto es lo peor: no se veía. La pantalla pintaba el tramo recién creado
 * —el estado de React ya lo tenía— y todo parecía correcto. Solo al recargar
 * aparecía Cortejo con «0/0 puestos cubiertos» y «No hay tramos que coincidan
 * con la búsqueda». Sin tramos no hay cortejo, y sin cortejo las papeletas no
 * se pueden asignar a ningún sitio. De una palabra colgaba la mitad de la
 * Semana Santa de la hermandad.
 *
 * No lo cazaba nada: los tipos de TypeScript son correctos (el objeto es un
 * `Record<string, unknown>`, ahí cabe cualquier cosa), el `build` no mira el
 * SQL, y en modo demostración no hay base de datos que se queje — se guarda en
 * el navegador y funciona. Solo fallaba con Supabase conectado, en producción.
 *
 * Esta prueba compara, columna a columna, lo que cada `xxxToRow` escribe con
 * lo que TODO-EN-UNO.sql crea de verdad.
 */
export default async function ({ caso }) {
  const { readFile, readdir } = await import('node:fs/promises')

  /* 1. Lo que la base TIENE. Se lee de TODO-EN-UNO.sql y no de los ficheros
        sueltos porque es el que se pega en Supabase: si una columna solo está
        en un fichero que se quedó fuera del generador, en la base no está. */
  const sql = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  const tablas = new Map()
  const TIPOS = 'uuid|text|int|integer|boolean|numeric|jsonb|timestamptz|date|bigint|serial'
  for (const m of sql.matchAll(/create table if not exists (\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const cols = new Set()
    for (const linea of m[2].split('\n')) {
      const c = linea.trim().match(new RegExp(`^([a-z_][a-z0-9_]*)\\s+(?:${TIPOS})`, 'i'))
      if (c && !['primary', 'unique', 'check', 'constraint', 'foreign'].includes(c[1])) cols.add(c[1])
    }
    tablas.set(m[1], cols)
  }
  // Las columnas que se añaden después, que son muchas: el esquema ha crecido
  // por `alter table` para no romper las bases que ya existían.
  for (const m of sql.matchAll(/alter table (?:only )?(\w+)\s+add column if not exists\s+([a-z_][a-z0-9_]*)/gi)) {
    if (!tablas.has(m[1])) tablas.set(m[1], new Set())
    tablas.get(m[1]).add(m[2].toLowerCase())
  }
  // `hermandad_id` se la pone multi-hermandad.sql a todas en un bucle.
  for (const s of tablas.values()) s.add('hermandad_id')

  caso('se han leído las tablas del SQL', true, tablas.size >= 15)
  caso('y sus columnas', true, (tablas.get('hermanos')?.size ?? 0) >= 20)

  /* 2. Lo que la aplicación ESCRIBE.
   *
   * OJO CON EL ALCANCE. Esto miraba solo `src/lib/db/` y solo funciones con
   * `export`, y por esas dos rendijas se coló el fallo que dejó sin funcionar
   * las solicitudes de alta durante días: `solicitudToRow` vive en
   * `src/lib/solicitudes.ts` y no se exporta, así que era invisible por
   * partida doble. Escribía `tutor_id` y `fecha_nacimiento`, columnas que la
   * tabla no tenía, y Postgres rechazaba el INSERT entero.
   *
   * Se mira TODO `src/lib`, exportadas o no. Un mapeo no vigilado no es un
   * mapeo más seguro: es el sitio donde se esconde el siguiente. */
  const ficheros = [
    ...(await readdir('src/lib/db')).filter((f) => f.endsWith('.ts')).map((f) => `src/lib/db/${f}`),
    ...(await readdir('src/lib')).filter((f) => f.endsWith('.ts')).map((f) => `src/lib/${f}`),
  ]
  caso('hay mapeos que comprobar', true, ficheros.length >= 10)

  let comprobadas = 0
  const vistas = []
  for (const f of ficheros) {
    const src = await readFile(f, 'utf8')
    for (const m of src.matchAll(/(?:export )?function (\w*[Tt]oRow)\s*\([^)]*\)[^{]*\{\s*return\s*\{([\s\S]*?)\n  \}/g)) {
      const cuerpo = m[2].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      const escritas = [...cuerpo.matchAll(/^\s{4}([a-z_][a-z0-9_]*)\s*:/gm)].map((x) => x[1])
      if (!escritas.length) continue
      const base = f.split('/').pop().replace('.ts', '')
      // Los que no se llaman como su tabla. El resto se adivina por el nombre
      // del fichero, que es la costumbre en `src/lib/db`.
      const ALIAS = {
        solicitudToRow: 'solicitudes_alta',
        mensajeToRow: 'mensajes_web',
        settingsToRow: 'hermandad_settings',
        // El fichero se llama `solicitudesPapeleta.ts` y la tabla
        // `solicitudes_papeleta`: se adivinan igual leyéndolos, pero no
        // coinciden carácter a carácter.
        solicitudPapeletaToRow: 'solicitudes_papeleta',
        // El fichero se llama `mandatosSepa.ts` y la tabla `mandatos_sepa`:
        // mismo caso que `solicitudPapeletaToRow`.
        mandatoSepaToRow: 'mandatos_sepa',
      }
      const tabla = ALIAS[m[1]] ?? [...tablas.keys()]
        .filter((t) => t === base || t === `${base}s` || base.startsWith(t))
        .sort((a, b) => b.length - a.length)[0]
      vistas.push(m[1])
      caso(`${m[1]} apunta a una tabla conocida`, true, Boolean(tabla))
      if (!tabla) continue
      const tiene = tablas.get(tabla)
      const faltan = escritas.filter((c) => !tiene.has(c))
      // El texto del fallo dice QUÉ columna falta y en qué tabla: sin eso, el
      // aviso obliga a buscar a mano entre veinte ficheros.
      caso(`${m[1]} → la tabla "${tabla}" tiene todas sus columnas`, '', faltan.join(', '))
      comprobadas++
    }
  }
  caso('se ha comprobado cada mapeo', true, comprobadas >= 10)

  /*
   * Y QUE NO SE SALTE NINGUNA EN SILENCIO.
   *
   * Esto es la lección de verdad. La prueba no fallaba: es que ni miraba.
   * `solicitudToRow` no entraba porque estaba fuera de la carpeta, y
   * `cuentaToRow` no entra porque no devuelve un objeto literal —lo va
   * montando campo a campo— y el patrón no sabe leerlo.
   *
   * Saltarse una en silencio es peor que no tener la prueba, porque el verde
   * dice «mirado» cuando quiere decir «no he sabido». Así que se cuentan las
   * que hay y las que se han leído: si no cuadra, salta.
   *
   * `cuentaToRow` se apunta aparte, con su motivo. Escribe dos columnas fijas
   * (`conectada`, `usuario`) sobre `cuentas_sociales`, comprobadas a mano. Si
   * alguien la cambia para devolver un literal, entrará sola y esta lista se
   * queda corta — que también salta.
   */
  const NO_LEGIBLES = ['cuentaToRow']
  let declaradas = 0
  for (const f of ficheros) {
    const src = await readFile(f, 'utf8')
    for (const m of src.matchAll(/(?:export )?function (\w*[Tt]oRow)\s*\(/g)) {
      declaradas++
      const conocida = vistas.includes(m[1]) || NO_LEGIBLES.includes(m[1])
      caso(`${m[1]} no se cuela sin mirar`, true, conocida)
    }
  }
  caso('se han visto todas las que hay', declaradas, vistas.length + NO_LEGIBLES.length)
  // Los tres que viven fuera de `src/lib/db` y antes no se miraban. Si alguien
  // los mueve o los renombra, que salte aquí y no en producción.
  for (const n of ['solicitudToRow', 'mensajeToRow', 'settingsToRow']) {
    caso(`se vigila ${n}`, true, vistas.includes(n))
  }

  await guardadoDeLaHermandad({ caso })
  await guardadosQueSeVen({ caso })
  await elModoLocalVieneApagado({ caso })
  await nadieSeQuedaSinUsar({ caso })
}

/**
 * Y LO QUE SE GUARDA SOLO EN EL NAVEGADOR, cuando no debería.
 *
 * Es la misma familia de fallo que la columna que faltaba, vista del otro
 * lado: la pantalla dice que ha guardado, y ha guardado — pero en un sitio
 * que solo existe en ese ordenador.
 *
 * Los tres casos que ya costaron caro: el modelo de papeleta y la hoja de
 * asistencia (se borraban al cerrar sesión), los ajustes de cuotas y el
 * catálogo de etiquetas. Los dos últimos eran los peores, porque no se perdían
 * — simplemente no valían desde otro ordenador, y nadie tiene por qué
 * sospecharlo.
 */
async function guardadoDeLaHermandad({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')

  // Cada ajuste de la hermandad tiene su columna.
  for (const col of ['modelo_papeleta', 'modelo_recibo', 'asistencia', 'ajustes_cuotas', 'etiquetas', 'campana', 'campos_propios']) {
    caso(`hermandad_settings.${col} existe`, true,
      new RegExp(`alter table hermandad_settings add column if not exists ${col} jsonb`).test(sql))
  }

  // Y la aplicación los manda ahí, no solo al navegador.
  const ajustes = await readFile('src/lib/ajustesCuotas.ts', 'utf8')
  caso('los ajustes de cuotas van a la base', true, /guardarPlantilla\('ajustes_cuotas'/.test(ajustes))
  caso('y se traen al abrir', true, /traerPlantilla<AjustesCuotas>\('ajustes_cuotas'\)/.test(ajustes))

  const etiq = await readFile('src/lib/etiquetas.ts', 'utf8')
  caso('las etiquetas van a la base', true, /guardarPlantilla\('etiquetas'/.test(etiq))
  caso('y se traen al abrir', true, /traerPlantilla<string\[\]>\('etiquetas'\)/.test(etiq))

  /*
   * LA CAMPAÑA DE PAPELETAS, que es la peor de todas las que vivían en un
   * navegador — porque la lee también EL ÁREA DEL HERMANO.
   *
   * La secretaría abría la campaña de 2026 desde Papeletas › Ajustes de
   * campaña y eso se guardaba en su ordenador. El hermano, desde el móvil,
   * leía la de fábrica: otro año, otro plazo y otra fecha de salida. Pedía
   * sitio para una Semana Santa que no tocaba y la pantalla se lo daba por
   * bueno. Y de `campana.anio` salen las papeletas «del año», que son las que
   * ordenan el cortejo, reparten los roles y deciden a quién le llega cada
   * comunicado por tramo.
   */
  const camp = await readFile('src/lib/campana.ts', 'utf8')
  caso('la campaña va a la base', true, /guardarPlantilla\('campana'/.test(camp))
  caso('y se trae al abrir', true, /traerPlantilla<Partial<Campana>>\('campana'\)/.test(camp))

  /*
   * Y LOS CAMPOS PROPIOS DE LA FICHA, donde el valor SÍ viajaba y la
   * definición no: la talla de túnica quedaba guardada dentro de la ficha del
   * hermano —que va a la base— pero desde otro ordenador el campo «talla» no
   * existía, así que el dato estaba escrito y no se veía por ninguna parte.
   */
  const cp = await readFile('src/lib/camposPropios.ts', 'utf8')
  caso('los campos propios van a la base', true, /guardarPlantilla\('campos_propios'/.test(cp))
  caso('y se traen al abrir', true, /traerPlantilla<CampoPropio\[\]>\('campos_propios'\)/.test(cp))

  /*
   * Y LAS PANTALLAS QUE LA PINTAN LA ESCUCHAN.
   *
   * No basta con traerla: `getCampana()` es síncrona y la base tarda lo que
   * tarde la red. Leyéndola una sola vez al montar, la pantalla se queda con
   * la de fábrica para toda la sesión aunque la buena llegue medio segundo
   * después. El área del hermano y el cortejo tienen que usar el hook.
   */
  for (const [pantalla, ruta] of [
    ['el área del hermano', 'src/pages/HermanoPortal.tsx'],
    ['el cortejo', 'src/pages/app/Cortejo.tsx'],
  ]) {
    const texto = await readFile(ruta, 'utf8')
    caso(`${pantalla} escucha la campaña de la base`, true, /useCampana\(\)/.test(texto))
    caso(`${pantalla} ya no la lee una sola vez`, false,
      /const campana = useMemo\(\(\) => getCampana\(\), \[\]\)/.test(texto))
  }

  // El tipo que las gobierna las conoce a todas: si alguien añade una columna
  // y se olvida de aquí, no compila.
  const plant = await readFile('src/lib/plantillasHermandad.ts', 'utf8')
  for (const col of ['modelo_papeleta', 'modelo_recibo', 'asistencia', 'ajustes_cuotas', 'etiquetas', 'campana', 'campos_propios']) {
    caso(`PlantillaGuardable incluye ${col}`, true, plant.includes(`'${col}'`))
  }
}

/**
 * QUE UN GUARDADO QUE FALLA SE VEA.
 *
 * `supabase-js` NO lanza excepción cuando la base rechaza la operación: la
 * columna que no existe, la política que no deja escribir, la restricción
 * incumplida… todo eso vuelve como `{ error }` dentro de la respuesta, no
 * como una excepción. Un `try/catch` alrededor no se entera de nada.
 *
 * Ahí estuvo el fallo de los tramos: llevaban sin guardarse desde siempre y en
 * pantalla salía el visto bueno verde de «Tramos guardados».
 */
async function guardadosQueSeVen({ caso }) {
  const { readFile } = await import('node:fs/promises')

  // Los cuatro sitios que escriben en Supabase por su cuenta, fuera del
  // espejo genérico. Todos tienen que mirar el error y avisar por la banda.
  const sitios = [
    ['src/lib/tramos.ts', 'tramos'],
    ['src/lib/solicitudes.ts', 'solicitudes de alta'],
    ['src/lib/db/catalogos.ts', 'catálogos'],
    ['src/lib/supabaseSync.ts', 'el espejo de las tablas'],
  ]
  for (const [f, que] of sitios) {
    const src = await readFile(f, 'utf8')
    caso(`${que}: se mira el error al escribir`, true, /const \{ error(?::| )/.test(src))
    caso(`${que}: y se avisa a quien está delante`, true, /cabildo-sync-error/.test(src))
  }

  // El visto bueno verde SOLO si de verdad se ha guardado. Un visto bueno que
  // sale pase lo que pase no informa: engaña.
  const conf = await readFile('src/pages/app/Configuracion.tsx', 'utf8')
  caso('el verde de los tramos depende del resultado', true,
    /if \(!r\.ok \|\| !rAjustes\.ok\) \{[\s\S]{0,420}setTramosSaved\(false\)/.test(conf))
  // El precio se edita en la tarjeta de los tramos, así que lo tiene que
  // guardar SU botón. Colgado del botón de otra tarjeta, se perdía.
  caso('y ese botón guarda también el precio', true,
    /const rAjustes = await saveHermandadSettings\(settings\)/.test(conf))
  caso('y el fallo se pinta', true, /tramosError && <span/.test(conf))

  /*
   * Y QUE EL AVISO DIGA POR QUÉ.
   *
   * El aviso rojo decía «no se ha podido guardar (papeletas)» y se quedaba
   * ahí. El mensaje de Postgres —el que dice qué columna falta o qué
   * referencia no existe— se iba a la consola, donde no mira nadie. Costó tres
   * rondas de preguntas averiguar algo que la propia pantalla ya sabía.
   */
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('el aviso recoge el motivo, no solo la tabla', true, /fallos\?: string\[\]/.test(shell))
  caso('y lo guarda para enseñarlo', true, /setDetalleSync/.test(shell))
  caso('y lo pinta donde se pueda copiar', true, /<pre>\{detalleSync\}<\/pre>/.test(shell))
  // Plegado: quien lleva la hermandad no tiene por qué leer un error de
  // Postgres, pero tiene que poder abrirlo y copiarlo si le piden ayuda.
  caso('plegado, no en la cara', true, /<details className="sync-error-detalle">/.test(shell))

  /*
   * LOS QUE BORRAN ANTES DE INSERTAR son los peores de todos: si el alta falla
   * y nadie mira, no es que no se guarde lo nuevo — es que además desaparece
   * lo que había. Y por ahí pasa la LISTA DE PRECIOS de la hermandad: los
   * conceptos de cuota con su importe y los tipos de papeleta con el suyo.
   */
  const cat = await readFile('src/lib/db/catalogos.ts', 'utf8')
  for (const fn of ['reemplazarCatalogo', 'reemplazarTablaCompleta']) {
    const trozo = cat.slice(cat.indexOf(`export async function ${fn}`)).slice(0, 1400)
    caso(`${fn} comprueba el borrado antes de seguir`, true,
      /const \{ error: borrando \}[\s\S]{0,220}return \{ ok: false/.test(trozo))
    caso(`${fn} comprueba el alta`, true, /const \{ error \}[\s\S]{0,220}return \{ ok: false/.test(trozo))
  }

  // Y quien los llama se entera: nada de visto bueno verde por defecto.
  for (const [f, quien] of [
    ['src/lib/conceptosCuota.ts', 'los conceptos de cuota'],
    ['src/lib/opcionesPapeleta.ts', 'los tipos de papeleta'],
    ['src/lib/catalogos.ts', 'los catálogos'],
  ]) {
    const src = await readFile(f, 'utf8')
    caso(`${quien}: se devuelve si ha ido bien`, true, /Promise<\{ ok: boolean; error\?: string \}>/.test(src))
  }
  caso('el verde de los catálogos depende del resultado', true,
    /if \(fallos\.length > 0\) \{[\s\S]{0,200}setCatalogosSaved\(false\)/.test(conf))
  /*
   * Y QUE NO VUELVA LA LISTA DE «PAPELETAS PERSONALIZADAS».
   *
   * Era un tramo pobre: con su propio nombre y su propio precio, así que dos
   * hermanos del mismo sitio podían acabar pagando distinto según por dónde se
   * les hubiera emitido. Lo que camina es un tramo; lo único que no lo es, la
   * papeleta simbólica de quien tiene sitio y ese año no sale.
   */
  caso('no vuelve la lista de papeletas personalizadas', false, /saveOpcionesPapeleta/.test(conf))
  caso('y la simbólica tiene su precio', true, /precioSimbolica/.test(conf))
}

/**
 * EL MODO LOCAL DE RESERVA VIENE APAGADO.
 *
 * Cuando Supabase está configurado pero no responde —proyecto en pausa, corte
 * de red—, la aplicación PUEDE seguir con los datos del navegador. Con una
 * hermandad de verdad detrás eso es un desastre callado: la secretaria entra,
 * ve el censo de ejemplo —doce nombres inventados— y pasa la tarde dando altas
 * y cobrando recibos que no existen en ningún sitio. Desde dentro se ve una
 * aplicación que funciona.
 *
 * Y estaba al revés: era un interruptor que había que ACORDARSE de poner en el
 * despliegue el día de abrir al público. Un seguro que hay que acordarse de
 * activar no es un seguro. Ahora viene puesto y lo que se pide a mano es
 * quitarlo, solo para desarrollar.
 */
async function elModoLocalVieneApagado({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/lib/supabase.ts', 'utf8')
  caso('sin poner nada, la protección está puesta', true,
    /sinModoLocal = import\.meta\.env\.VITE_MODO_LOCAL !== '1'/.test(src))
  caso('y ya no se cuelga de acordarse de una variable', false,
    /sinModoLocal = import\.meta\.env\.VITE_SIN_MODO_LOCAL === '1'/.test(src))

  // Y que el ejemplo de configuración no siga mandando poner la vieja: quien
  // copie ese fichero se llevaría una variable que ya no lee nadie.
  const ejemplo = await readFile('.env.example', 'utf8')
  caso('el .env.example ya no pide la variable vieja', false, /VITE_SIN_MODO_LOCAL=1/.test(ejemplo))
}

/**
 * TODA TABLA QUE SE CREA, ALGUIEN LA USA.
 *
 * De todos los fallos de esta aplicación, el más callado es este: el SQL crea
 * la tabla, le pone sus políticas, y la aplicación no la toca. No hay error,
 * no hay columna que falte, no hay permiso denegado. Simplemente la función no
 * existe, y nadie lo sabe hasta que alguien pregunta por qué está vacío.
 *
 * Ha pasado tres veces, y las tres se descubrieron a la vez barriendo esto:
 *
 *   · `avisos_hermano` — el buzón del hermano. Todos los avisos se escribían
 *     en el localStorage de la secretaría, así que la campana del hermano
 *     estaba vacía para siempre: cuotas, papeletas, la baja, los comunicados.
 *   · `solicitudes_papeleta` — no existía siquiera. Lo que el hermano pedía
 *     desde su área se quedaba en su móvil y la secretaría no lo recibía.
 *   · `suscripciones` — se leía, pero no se escribía. El botón de activar
 *     dejaba el panel bloqueado desde cualquier otro ordenador.
 *
 * Una tabla puede vivir legítimamente sin que la aplicación la nombre: las que
 * solo tocan las funciones del servidor. Esas van en la lista de abajo, CON EL
 * MOTIVO. Escribir el motivo es la parte que importa: obliga a mirar si de
 * verdad es del servidor, que es justo lo que no se miró las tres veces.
 */
async function nadieSeQuedaSinUsar({ caso }) {
  const { readFile, readdir } = await import('node:fs/promises')
  const sql = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  const tablas = [...sql.matchAll(/create table if not exists (?:public\.)?([a-z_]+)\s*\(/g)]
    .map((m) => m[1])

  const SOLO_DEL_SERVIDOR = {
    hermandades: 'se llega por RPC (crear_hermandad, hermandades_publicas), no por su nombre',
    intentos_acceso: 'el freno de fuerza bruta: lo escribe resolver_email_hermano, nunca el navegador',
    recuperaciones_hermano: 'las contraseñas olvidadas: solo la Edge Function con la clave de servicio',
    titulares: 'quién lleva la hermandad: se pregunta por es_titular(), no leyendo la tabla',
    suscripciones: 'por RPC (mi_suscripcion, activar_suscripcion_propia): el pack no lo elige el navegador',
  }

  // Todo lo que la aplicación nombra: el panel, el área del hermano y la
  // función de correo del servidor.
  const fuentes = []
  for (const dir of ['src/lib', 'src/lib/db', 'src/pages', 'src/pages/app', 'src/components', 'src/context']) {
    for (const f of await readdir(dir)) {
      if (/\.tsx?$/.test(f)) fuentes.push(`${dir}/${f}`)
    }
  }
  fuentes.push('supabase/functions/enviar-correo/index.ts')
  let todo = ''
  for (const f of fuentes) todo += await readFile(f, 'utf8')

  caso('hay tablas que comprobar', true, tablas.length >= 20)
  const huerfanas = tablas.filter((t) => !SOLO_DEL_SERVIDOR[t] && !todo.includes(`'${t}'`))
  caso('ninguna tabla se queda sin usar', '', huerfanas.join(', '))

  /*
   * Y al revés: que la lista de excepciones no se llene de tablas que sí se
   * usan, porque entonces deja de proteger nada.
   *
   * Aquí se mira `.from('tabla')`, que es como se nombra una tabla de verdad,
   * y no el nombre suelto. La primera versión miraba el nombre suelto y
   * señalaba `titulares` como excepción sobrante: en `src` aparece
   * `'titulares'` docenas de veces, pero es la SECCIÓN de la web —las imágenes
   * del Señor y la Virgen— y no la tabla de quién lleva la hermandad. La misma
   * palabra para dos cosas distintas.
   */
  const sobran = Object.keys(SOLO_DEL_SERVIDOR).filter((t) => todo.includes(`.from('${t}')`))
  caso('la lista de excepciones no tiene de más', '', sobran.join(', '))
}
