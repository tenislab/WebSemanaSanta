/**
 * EL SQL, EJECUTADO DE VERDAD CONTRA UN POSTGRES.
 *
 * Por qué existe. Todas las demás pruebas leen el SQL como texto: comprueban
 * que la columna aparece escrita en algún sitio. Eso deja pasar una familia
 * entera de fallos, y dos de ellos han costado caro:
 *
 *   · `hora_citacion` no existía en ninguna tabla. Ningún tramo se guardaba,
 *     con el visto bueno verde en pantalla.
 *   · El disparador del registro de actividad usaba `new.nombre`, y ni las
 *     papeletas ni las cuotas ni los movimientos tienen esa columna. El SQL se
 *     instalaba sin una queja —crear el disparador no comprueba nada— y lo que
 *     dejaba de funcionar era emitir papeletas y cobrar cuotas.
 *
 * El segundo NO lo caza mirar el texto. Solo se ve escribiendo una fila.
 *
 * Si no hay un Postgres a mano, esto se salta y lo dice. No se calla: una
 * prueba que se salta en silencio es peor que no tenerla.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const correr = promisify(execFile)

/** El puerto donde esta prueba busca su Postgres. Se puede cambiar por entorno. */
const PUERTO = process.env.GOBERGO_PG_PUERTO ?? '5433'
const USUARIO = process.env.GOBERGO_PG_USUARIO ?? 'postgres'

async function hayPostgres() {
  try {
    await correr('psql', ['-p', PUERTO, '-U', USUARIO, '-tAc', 'select 1'], {
      env: { ...process.env, PGCONNECT_TIMEOUT: '3' },
    })
    return true
  } catch {
    return false
  }
}

async function sql(texto) {
  const dir = await mkdtemp(join(tmpdir(), 'gobergo-sql-'))
  const f = join(dir, 'consulta.sql')
  await writeFile(f, texto)
  const { stdout } = await correr(
    'psql',
    ['-p', PUERTO, '-U', USUARIO, '-v', 'ON_ERROR_STOP=1', '-tA', '-f', f],
    { maxBuffer: 32 * 1024 * 1024 },
  )
  return stdout.trim()
}

export default async function ({ caso }) {
  if (!(await hayPostgres())) {
    /*
     * EN LA MÁQUINA DE CADA UNO se dice en voz alta y se sigue: no todo el
     * mundo tiene un Postgres levantado, y no poder ejecutar las pruebas por
     * eso sería peor.
     *
     * EN CI, NO. Ahí hay un Postgres al lado a propósito, y si no se
     * encuentra es que algo está mal configurado — un puerto, una variable—.
     * Saltarse en verde casi treinta comprobaciones del SQL por un fallo de
     * configuración es exactamente cómo se pierde una red de seguridad: sin
     * que nadie se entere. Por eso allí se pone `GOBERGO_PG_OBLIGATORIO`.
     */
    const obligatorio = process.env.GOBERGO_PG_OBLIGATORIO === '1'
    caso(
      obligatorio
        ? `NO HAY POSTGRES en el puerto ${PUERTO} y aquí es obligatorio: el SQL se ha quedado sin comprobar`
        : 'SIN POSTGRES: esta prueba NO se ha ejecutado (arranca uno en el '
          + `puerto ${PUERTO} para comprobar el SQL de verdad)`,
      true,
      !obligatorio,
    )
    return
  }

  // Base limpia en cada pasada: si se arrastrara lo de antes, un fallo nuevo
  // podría quedar tapado por una tabla que ya estaba bien.
  await sql('drop schema if exists public cascade; create schema public;')
  await montarLoQuePoneSupabase({ sql })

  const todo = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  let instalado = ''
  try {
    await sql(todo)
    instalado = 'ok'
  } catch (e) {
    instalado = String(e.stderr ?? e.message).split('\n').filter((l) => /ERROR/.test(l)).join(' · ')
  }
  caso('TODO-EN-UNO se ejecuta sin un solo error', 'ok', instalado)

  // Y DOS VECES: la hermandad que ya lo ejecutó vuelve a ejecutarlo al
  // actualizar, y no puede romperse por eso.
  let otraVez = ''
  try {
    await sql(todo)
    otraVez = 'ok'
  } catch (e) {
    otraVez = String(e.stderr ?? e.message).split('\n').filter((l) => /ERROR/.test(l)).join(' · ')
  }
  caso('y se puede volver a ejecutar encima', 'ok', otraVez)

  /*
   * ESCRIBIR DE VERDAD EN CADA TABLA.
   *
   * Con las columnas EXACTAS que escribe cada `toRow`. Es lo único que
   * comprueba a la vez que la columna existe, que el tipo cuadra, que las
   * restricciones dejan pasar lo que la aplicación manda y que los
   * disparadores no revientan.
   */
  const H = "'11111111-1111-1111-1111-111111111111'"
  const HNO = "'22222222-2222-2222-2222-222222222222'"
  const T = "'33333333-3333-3333-3333-333333333333'"

  const escrituras = [
    ['la hermandad', `insert into hermandades (id, nombre) values (${H}, 'Hermandad de prueba')`],
    ['un hermano', `insert into hermanos (id, hermandad_id, nombre, dni, numero)
       values (${HNO}, ${H}, 'Jaime Rivas', '00000000T', 1)`],
    // El que tumbó el cortejo entero: `hora_citacion`.
    ['un tramo con su hora de citación', `insert into tramos
       (id, nombre, cuerpo, capacidad, tipo, reparto, precio, hora_citacion, etiqueta, orden, hermandad_id)
       values (${T}, 'Tramo 1', 'Cruz de Guía', 40, 'Cirio', 'numero', 10, '19:30', null, 1, ${H})`],
    // El que dejó sin funcionar TODAS las solicitudes: `tutor_id`.
    ['la solicitud de alta de un hijo', `insert into solicitudes_alta
       (id, nombre, dni, email, telefono, clave_propuesta, fecha, estado, tutor_id, fecha_nacimiento, hermandad_id)
       values (gen_random_uuid(), 'Hijo de prueba', '56728372H', 'padre@ejemplo.com',
               '600000000', '', '2026-08-22', 'Pendiente', ${HNO}, '2023-03-23', ${H})`],
    // Las tres que el disparador roto habría dejado inservibles.
    ['una papeleta', `insert into papeletas
       (id, numero, hermano_id, anio, tramo_id, opcion, importe, estado, fecha_solicitud,
        fecha_entrega, metodo_pago, fecha_pago, motivo_anulacion, pago_metodo, pago_fecha, hermandad_id)
       values (gen_random_uuid(), 1, ${HNO}, 2027, ${T}, null, 10, 'Solicitada',
               '2026-08-22', null, null, null, null, null, null, ${H})`],
    ['una cuota', `insert into cuotas
       (id, numero, hermano_id, concepto, importe, estado, ejercicio, fecha_emision,
        fecha_cobro, domiciliada, hermandad_id)
       values (gen_random_uuid(), 1, ${HNO}, 'Cuota anual', 30, 'Pendiente', 2027,
               '2026-08-22', '', false, ${H})`],
    ['un apunte de tesorería', `insert into movimientos
       (id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, hermandad_id)
       values (gen_random_uuid(), 1, '2026-08-22', 'Donativo', 'Donativos', 'Ingreso',
               50, 'Caja', 'Conciliado', ${H})`],
    // Los dos precios de la hermandad. Vivían en el localStorage de quien los
    // escribía, así que cada persona emitía las papeletas a un precio distinto.
    ['los precios de la papeleta', `update hermandad_settings
       set precio_papeleta = 18, precio_simbolica = 5 where hermandad_id = ${H}`],
  ]

  for (const [que, consulta] of escrituras) {
    let r = 'ok'
    try {
      await sql(consulta)
    } catch (e) {
      r = String(e.stderr ?? e.message).split('\n').find((l) => /ERROR/.test(l)) ?? 'falló'
    }
    caso(`se puede guardar ${que}`, 'ok', r)
  }

  // Modificar y borrar son las otras dos ramas del disparador, y ninguna se
  // recorre insertando.
  for (const [que, consulta] of [
    ['modificar una papeleta', "update papeletas set estado = 'Pagada'"],
    ['modificar una cuota', "update cuotas set estado = 'Pagada'"],
    ['borrar un apunte', 'delete from movimientos'],
  ]) {
    let r = 'ok'
    try {
      await sql(consulta)
    } catch (e) {
      r = String(e.stderr ?? e.message).split('\n').find((l) => /ERROR/.test(l)) ?? 'falló'
    }
    caso(`se puede ${que}`, 'ok', r)
  }

  // El registro tiene que haberse escrito SOLO, sin que nadie lo llame.
  const apuntes = await sql('select count(*) from registro_actividad')
  caso('la base ha apuntado los cambios ella sola', true, Number(apuntes) >= 7)
  const origen = await sql("select count(*) from registro_actividad where origen <> 'base'")
  caso('y todos vienen de la base, no del navegador', '0', origen)
  // Y con el nombre de cada fila, que es lo que hace el registro legible.
  const sinNombre = await sql("select count(*) from registro_actividad where coalesce(sobre_nombre,'') = ''")
  caso('cada apunte dice sobre qué fila es', '0', sinNombre)

  /*
   * LOS ESTADOS QUE VALEN, EN LOS DOS SITIOS.
   *
   * La aplicación tiene una lista («Pagada | Pendiente | Devuelta | En mora»)
   * y la base tiene otra, en un CHECK. Si alguien añade un estado nuevo en el
   * código y no en la base, no falla al compilar ni al instalar: falla el día
   * que alguien pone una cuota en ese estado, y falla la fila entera.
   */
  const UNIONES = [
    ['cuotas_estado_check', 'src/data/cuotas.ts', /export type EstadoCuota = ([^\n]+)/],
    ['papeletas_estado_check', 'src/data/papeletas.ts', /export type EstadoPapeleta = ([^\n]+)/],
  ]
  for (const [restriccion, fichero, patron] of UNIONES) {
    const def = await sql(
      `select coalesce(max(pg_get_constraintdef(oid)), '') from pg_constraint where conname = '${restriccion}'`,
    )
    const enLaBase = [...def.matchAll(/'([^']+)'::text/g)].map((m) => m[1]).sort()
    let enElCodigo = []
    try {
      const src = await readFile(fichero, 'utf8')
      const m = src.match(patron)
      if (m) enElCodigo = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
    } catch {
      // El fichero puede haberse movido; se ve en el resultado de abajo.
    }
    caso(`${restriccion}: la base y el código dicen lo mismo`,
      enElCodigo.join(', '), enLaBase.join(', '))
  }

  /*
   * EL ARREGLO RÁPIDO tiene que dejar la misma función que el fichero grande.
   * Si se quedaran distintos, quien use el atajo se llevaría una versión vieja
   * sin saberlo — y este atajo existe justo para quien tiene prisa.
   */
  const rapido = await readFile('supabase/ARREGLO-RAPIDO-DISPARADOR.sql', 'utf8')
  const grande = await readFile('supabase/seguridad-claves-y-registro.sql', 'utf8')
  const cuerpoDe = (t) => {
    const i = t.indexOf('create or replace function apuntar_cambio()')
    return i < 0 ? '' : t.slice(i, t.indexOf('$$;', i) + 3)
  }
  caso('el arreglo rápido lleva la misma función que el fichero grande',
    cuerpoDe(grande), cuerpoDe(rapido))
  caso('y no está vacío', true, cuerpoDe(rapido).includes('to_jsonb'))

  // Y el diagnóstico, sobre una base recién instalada, no puede encontrar nada.
  const diag = await readFile('supabase/DIAGNOSTICO.sql', 'utf8')
  const faltan = await sql(diag)
  caso('el diagnóstico no ve nada que falte en una base al día', '', faltan)

  /*
   * Y VA EN UNA SOLA CONSULTA.
   *
   * No es manía: el editor de Supabase enseña solo el resultado de la ÚLTIMA
   * consulta que le mandas. Con el diagnóstico partido en dos, la primera —la
   * de las columnas que faltan, que es la que importa— no se veía, y un «No
   * rows returned» podía estar tapando justo lo que se buscaba.
   */
  const puntoYComa = (diag.match(/;/g) ?? []).length
  caso('el diagnóstico es UNA consulta, no dos', 1, puntoYComa)

  // Y encuentra lo que tiene que encontrar. Una prueba que solo comprueba que
  // no da falsos positivos no comprueba nada: un fichero vacío la pasaría.
  await sql('alter table tramos drop column hora_citacion')
  const conFallo = await sql(diag)
  caso('y ve la columna que falta', true, /tramos\|hora_citacion/.test(conFallo))
  await sql("alter table tramos add column hora_citacion text")

  // Los permisos de tabla, que Supabase da de fábrica: van después de crear
  // las tablas, y sin ellos todo falla con «permission denied» antes de que
  // ninguna política llegue a decidir nada.
  await darLosPermisosDeSupabase({ sql })
  await elHermanoCambiaSuFicha({ sql, caso })
  await elCargoMalEscrito({ sql, caso })
  await actualizarUnaBaseQueYaFunciona({ sql, caso })
  await elTesoreroQueEsHermanoNoSeQuedaFuera({ sql, caso })
  await elRegistroNoCrecePorSiempre({ sql, caso })
  await elBarridoDeDniSeCorta({ sql, caso })
  await laSegundaHermandadGuardaSusCatalogos({ sql, caso })
  await elHermanoNoSePagaLaCuota({ sql, caso })
  await laWebLaEditaQuienTieneWeb({ sql, caso })
  await cadaCargoEnLoSuyo({ sql, caso })
  await nadieGuardaContrasenasEnClaro({ sql, caso })
  await losFormulariosPublicosTienenFreno({ sql, caso })
  await hermanoDeDosHermandades({ sql, caso })
  await elWebhookDeStripeActivaLaSuscripcion({ sql, caso })
  await elMandatoSepaLoFirmaElPropioHermano({ sql, caso })
  await elEncargoDeRedesSeReparte({ sql, caso })
  await laTiendaVendeYCuadra({ sql, caso })
  await laTiendaDeLaWebApartaYNoCobra({ sql, caso })
  await laFacturaCuadraConLaBase({ sql, caso })
  await elPrecioRebajadoEsElMismoEnLosDosSitios({ sql, caso })
  await losDatosDeLaTiendaCuadran({ sql, caso })
}

/**
 * EL BARRIDO DE DNI, CORTADO DE VERDAD.
 *
 * `resolver_email_hermano` la puede llamar CUALQUIERA sin sesión: es lo que
 * hace que un hermano entre en su área con su DNI. Y por eso mismo es una
 * puerta para barrer: probando DNI uno detrás de otro se puede averiguar
 * quién es hermano de qué hermandad, y de rebote su correo.
 *
 * Los DNI españoles no son un secreto —van en cualquier formulario— y
 * generarlos válidos es una división entre 23. Sin freno, sacar el censo de
 * una hermandad es cuestión de un rato.
 *
 * El freno está escrito: 25 DNI DISTINTOS por hermandad cada media hora. Pero
 * hasta ahora eso solo se comprobaba leyendo el texto del SQL, y un contador
 * que se lee bien puede contar mal. Aquí se ejecuta: treinta intentos seguidos
 * desde una sesión anónima, como los haría quien lo intentara.
 */
async function elBarridoDeDniSeCorta({ sql, caso }) {
  const hdad = (await sql('select id from hermandades limit 1')).trim()
  if (!hdad) { caso('hay una hermandad contra la que probar', true, false); return }
  await sql('delete from intentos_acceso')

  /*
   * Un envoltorio que se traga el rechazo y devuelve si pasó o no. Hace falta
   * porque la excepción del freno aborta la sentencia entera: sin esto, el
   * intento 26 se lleva por delante la cuenta de los 25 anteriores.
   *
   * NO va como `security definer`: tiene que ejecutarse con los permisos de
   * quien llama, que es justo lo que se está probando.
   */
  await sql(`
    create or replace function _prueba_intento_dni(h uuid, dni text) returns boolean
    language plpgsql as $$
    begin
      perform resolver_email_hermano(h, dni);
      return true;
    exception when others then return false;
    end $$;
  `)

  /** Prueba `cuantos` DNI DISTINTOS seguidos, desde una sesión anónima. */
  const barrer = async (cuantos) => {
    const salida = await sql(`
      begin;
        set local role anon;
        select count(*) filter (where paso) || '/' || count(*) filter (where not paso)
          from (
            select _prueba_intento_dni('${hdad}', lpad(g::text, 8, '0') || 'Z') as paso
              from generate_series(1, ${cuantos}) g
          ) t;
      rollback;
    `)
    /*
     * De toda la salida se busca LA LÍNEA que tiene la forma «25/5». `psql`
     * imprime también los BEGIN, SET y ROLLBACK, y partir la salida entera por
     * la barra daba números que no eran números.
     */
    const linea = salida.split('\n').map((l) => l.trim()).find((l) => /^\d+\/\d+$/.test(l)) ?? ''
    const [admitidos, cortados] = linea.split('/').map(Number)
    return { admitidos, cortados }
  }

  const r = await barrer(30)
  caso('deja pasar los 25 primeros', 25, r.admitidos)
  caso('y corta a partir del 26', 5, r.cortados)

  /*
   * Y CUENTA DNI DISTINTOS, no intentos. Quien se equivoca al teclear el suyo
   * y lo repite veinte veces no es el que preocupa: cerrarle la puerta por eso
   * sería castigar al hermano y no al que barre.
   */
  await sql('delete from intentos_acceso')
  const mismo = await sql(`
    begin;
      set local role anon;
      select count(*) filter (where paso) from (
        select _prueba_intento_dni('${hdad}', '12345678Z') as paso from generate_series(1, 40)
      ) t;
    rollback;
  `)
  const veces = mismo.split('\n').map((l) => l.trim()).find((l) => /^\d+$/.test(l)) ?? ''
  caso('el mismo DNI cuarenta veces no cierra la puerta', 40, Number(veces))

  // Y no se guarda el DNI: solo una huella, y con la hermandad dentro para que
  // la misma no valga en dos sitios.
  const fichero = await readFile('supabase/acceso-hermano.sql', 'utf8').catch(() => '')
  const enUso = fichero || (await readFile('supabase/TODO-EN-UNO.sql', 'utf8'))
  caso('no se guarda el DNI en claro', true, /huella_dni/.test(enUso))
  caso('y la huella lleva dentro la hermandad', true, /md5\(v_dni \|\| ':' \|\| p_hermandad_id/.test(enUso))
}

/**
 * EL REGISTRO DE ACTIVIDAD NO PUEDE CRECER PARA SIEMPRE.
 *
 * `registro_actividad` apunta UNA FILA POR CAMBIO, y lo escribe la propia base
 * con un disparador. Está bien —lo exige el artículo 32 del RGPD y es la razón
 * de que exista— pero nadie lo borraba nunca.
 *
 * No es un detalle: importar un censo de mil doscientos escribe mil doscientas
 * filas; volver a importarlo, otras mil doscientas; emitir la cuota del
 * ejercicio, otras tantas. En un año son decenas de miles en un plan de 500 MB.
 *
 * Y lo que de verdad obliga es el otro artículo, el 5.1.e: los datos
 * personales no se guardan más de lo necesario. Aquí hay nombres y quién tocó
 * la ficha de quién. Un registro de auditoría eterno no es prudencia.
 *
 * La función se saca del FICHERO, no se copia aquí: si allí se cambia el plazo
 * o la columna, esta prueba lo ejecuta tal cual y se entera.
 */
async function elRegistroNoCrecePorSiempre({ sql, caso }) {
  const fichero = await readFile('supabase/tareas-programadas.sql', 'utf8')

  // La tarea programada tiene que estar declarada, aunque aquí no haya pg_cron
  // para ejecutarla.
  caso('hay una tarea que limpia el registro', true, /cron\.schedule\(\s*'gobergo-limpiar-registro'/.test(fichero))
  caso('y no la puede ejecutar cualquiera', true,
    /revoke execute on function limpiar_registro_viejo\(\) from public, anon, authenticated/.test(fichero))

  // La función, tal cual está escrita en el fichero.
  const trozo = fichero.match(/create or replace function limpiar_registro_viejo[\s\S]*?\$\$;/)
  caso('la función está en el fichero', true, Boolean(trozo))
  if (!trozo) return
  await sql(trozo[0])

  /*
   * Y que borre lo viejo Y SOLO LO VIEJO. Una limpieza que se lleva de más es
   * peor que no limpiar: el registro es lo único que dice quién tocó qué.
   */
  const HDAD = 'dddddddd-0000-0000-0000-000000000001'
  await sql(`
    insert into hermandades (id, nombre) values ('${HDAD}', 'Para el registro') on conflict do nothing;
    delete from registro_actividad where hermandad_id = '${HDAD}';
    insert into registro_actividad (hermandad_id, autor_nombre, accion, sobre_tipo, cuando)
    values
      ('${HDAD}', 'Antigua',  'crear', 'hermano', now() - interval '3 years'),
      ('${HDAD}', 'Justo',    'crear', 'hermano', now() - interval '2 years 1 day'),
      ('${HDAD}', 'Reciente', 'crear', 'hermano', now() - interval '1 year'),
      ('${HDAD}', 'De hoy',   'crear', 'hermano', now());
  `)
  caso('se han apuntado los cuatro', 4,
    Number(await sql(`select count(*) from registro_actividad where hermandad_id = '${HDAD}'`)))

  await sql('select limpiar_registro_viejo()')
  const quedan = (await sql(
    `select string_agg(autor_nombre, ', ' order by cuando) from registro_actividad where hermandad_id = '${HDAD}'`,
  )).trim()
  caso('se van los de más de dos años y se quedan los demás', 'Reciente, De hoy', quedan)
}

/**
 * «ACTUALIZAR.SQL» SOBRE UNA BASE QUE YA TIENE DATOS.
 *
 * Es el fichero que se le manda a una hermandad que ya está funcionando, y el
 * que más miedo da: se pega en el editor de Supabase, encima de su censo, sus
 * cuotas y su tesorería. Comprobarlo leyéndolo no vale de nada — un fichero de
 * setecientas líneas se lee bien y falla en la cuatrocientas.
 *
 * Aquí se deja la base COMO LA DE ESA HERMANDAD —sin las piezas nuevas, con
 * hermandades y permisos ya sembrados— y se ejecuta de verdad.
 */
async function actualizarUnaBaseQueYaFunciona({ sql, caso }) {
  const HDAD = 'aaaaaaaa-0000-0000-0000-000000000001'

  // Se le quita lo que trae el fichero, para que tenga algo que hacer.
  await sql(`
    drop table if exists visitas_web cascade;
    drop table if exists suscriptores_web cascade;
    alter table hermandad_settings drop column if exists ajustes_cuotas;
    alter table hermandad_settings drop column if exists etiquetas;
    delete from storage.buckets where id in ('imagenes', 'copias');
    insert into hermandades (id, nombre) values ('${HDAD}', 'Hermandad de antes') on conflict do nothing;
    select sembrar_permisos_de_fabrica('${HDAD}');
    -- Y los dos módulos que nunca se sembraron, que es lo que viene a rellenar.
    delete from permisos_cargo where modulo_id in ('eventos', 'web');
  `)
  const antes = Number(await sql(`select count(*) from permisos_cargo where modulo_id in ('eventos','web')`))
  caso('la base de partida no tiene los dos módulos', 0, antes)

  const actualizar = await readFile('supabase/ACTUALIZAR.sql', 'utf8')
  let informe = ''
  try {
    informe = await sql(actualizar)
  } catch (e) {
    caso('ACTUALIZAR.sql se ejecuta sin un solo error', 'ok', String(e?.stderr ?? e).split('\n')[0])
    return
  }
  caso('ACTUALIZAR.sql se ejecuta sin un solo error', 'ok', 'ok')

  /*
   * EL INFORME DEL FINAL tiene que decir que sí a todo, menos a `pg_cron` —que
   * se enciende a mano desde el panel de Supabase y por eso no va dentro—.
   * Es lo único que ve quien lo ejecuta: si mintiera, se daría por instalado
   * lo que no está.
   */
  const filas = informe.split('\n').filter((l) => l.includes('|'))
  const enFalso = filas.filter((l) => l.endsWith('|f')).map((l) => l.split('|')[0])
  /*
   * Lo único que queda en «no» es `pg_cron`, que se enciende a mano.
   *
   * Y «ninguna hermandad se ha quedado sin permisos» también sale en «no»
   * aquí, y está bien que salga: los bloques anteriores de esta misma prueba
   * insertan hermandades a mano, sin sembrarles nada. Es justo el caso que esa
   * línea existe para delatar.
   */
  const esperadosEnFalso = [
    'Limpieza automática (pg_cron, se activa a mano)',
    'Ninguna hermandad se ha quedado sin permisos',
  ]
  caso('el informe solo deja pendiente lo que toca', '',
    enFalso.filter((x) => !esperadosEnFalso.includes(x)).join(', '))
  // Y los dos módulos SÍ están puestos donde había permisos que rellenar.
  caso('los dos módulos ya no salen pendientes', false,
    enFalso.some((x) => /eventos|«web»/.test(x)))
  caso('y comprueba veintiuna cosas', 21, filas.length)
  caso('la tienda sale en el inventario', true, filas.some((f) => /La tienda/.test(f)))
  // Lo último que se ha añadido, por su nombre: el recuento de arriba avisa
  // si el inventario pierde una línea, pero no de CUÁL, y quien ejecuta esto
  // en Supabase se guía por lo que lee.
  caso('los encargos de redes salen en el inventario', true,
    filas.some((f) => /Encargos de redes/.test(f)))

  // Y que haya hecho lo suyo de verdad, no solo decirlo.
  caso('ha rellenado los dos módulos que faltaban', true,
    Number(await sql(`select count(*) from permisos_cargo where modulo_id in ('eventos','web')`)) > 0)
  caso('ha creado el contador de visitas', true,
    /^(t|true)$/.test((await sql(`select (to_regclass('public.visitas_web') is not null)::text`)).trim()))
  caso('y los suscriptores', true,
    /^(t|true)$/.test((await sql(`select (to_regclass('public.suscriptores_web') is not null)::text`)).trim()))
  caso('y los dos cubos de ficheros', 2,
    Number(await sql(`select count(*) from storage.buckets where id in ('imagenes','copias')`)))

  // Volver a ejecutarlo encima no puede romper nada: la cabecera lo promete.
  await sql(actualizar)
  caso('se puede ejecutar dos veces', 2,
    Number(await sql(`select count(*) from storage.buckets where id in ('imagenes','copias')`)))
  // Y sin duplicar permisos, que es lo que pasaría con un insert sin guardia.
  const repetidos = await sql(`
    select coalesce(string_agg(cargo || '/' || modulo_id, ', '), '') from (
      select cargo, modulo_id from permisos_cargo where hermandad_id = '${HDAD}'
      group by cargo, modulo_id having count(*) > 1
    ) x`)
  caso('y sin duplicar ningún permiso', '', repetidos.trim())
}

/**
 * EL TESORERO QUE TAMBIÉN ES HERMANO NO SE QUEDABA FUERA POR CASUALIDAD:
 * SE QUEDABA POR NO HABER EJECUTADO «HERMANO-CON-CARGO.SQL».
 *
 * Reportado por dos vías el mismo día: «las notificaciones me siguen sin
 * llegar» —se le asigna una tarea a un hermano y en su cuenta no aparece
 * nada pendiente— y «el tesorero no ve bien la base de datos». Las dos son
 * la misma causa: una hermandad que montó su base ANTES de que existiera
 * «una persona, una ficha» y desde entonces solo ha ido pegando
 * `ACTUALIZAR.sql` en el editor se queda con la versión VIEJA de
 * `auth_es_hermano()`, que no sabe que un hermano puede llevar cargo en su
 * propia ficha. Y esa función decide, entre otras cosas, quién puede
 * escribirle un aviso a otro hermano: la política exige «esta cuenta no es
 * de hermano», y quien reparte tareas suele ser precisamente eso.
 *
 * Aquí se deja la base con esa versión vieja puesta a mano —para no
 * depender de si `hermano-con-cargo.sql` ya se había ejecutado antes en
 * esta misma base de pruebas—, se comprueba que el fallo reportado se
 * reproduce de verdad (no con el superusuario: con la sesión RLS del
 * propio secretario), y que `ACTUALIZAR.sql` lo arregla.
 */
async function elTesoreroQueEsHermanoNoSeQuedaFuera({ sql, caso }) {
  const HD = "'d0000000-0000-0000-0000-0000000000d1'"
  const CUENTA = "'e0000000-0000-0000-0000-0000000000e1'"
  const SECRETARIO = "'f0000000-0000-0000-0000-0000000000f1'"
  const DESTINO = "'f0000000-0000-0000-0000-0000000000f2'"

  await sql(`
    insert into hermandades (id, nombre) values (${HD}, 'Hdad. del secretario hermano')
      on conflict (id) do nothing;
    select sembrar_permisos_de_fabrica(${HD});
    insert into auth.users (id, email) values (${CUENTA}, 'secretario-hermano@ejemplo.com')
      on conflict (id) do nothing;
    delete from avisos_hermano where hermano_id in (${SECRETARIO}, ${DESTINO});
    delete from hermanos where id in (${SECRETARIO}, ${DESTINO});
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, cargo, email, auth_user_id) values
      (${SECRETARIO}, ${HD}, 'El Secretario', '11111111H', 90, 'Activo', 'Secretario/a', 'secretario-hermano@ejemplo.com', ${CUENTA}),
      (${DESTINO}, ${HD}, 'Quien Recibe', '22222222J', 91, 'Activo', null, 'quien-recibe@ejemplo.com', null);
  `)

  // La versión VIEJA de antes de «una persona, una ficha»: no excluye a
  // quien lleva cargo en su propia ficha de hermano.
  await sql(`
    create or replace function auth_es_hermano() returns boolean
      language sql stable security definer set search_path = public as $func$
        select
          exists (select 1 from hermanos where auth_user_id = auth.uid())
          and not exists (select 1 from titulares where auth_user_id = auth.uid())
          and not exists (select 1 from personal where auth_user_id = auth.uid() and activo)
      $func$;
  `)

  const comoElSecretario = (consulta) => sql(`
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = ${CUENTA};
    ${consulta}
    rollback;
  `)

  let antesDelArreglo = ''
  try {
    await comoElSecretario(`
      insert into avisos_hermano (hermandad_id, hermano_id, texto, tipo, titulo)
        values (${HD}, ${DESTINO}, 'PRUEBA tarea asignada', 'ficha', 'Nueva tarea');
    `)
    antesDelArreglo = 'lo ha dejado (mal)'
  } catch {
    antesDelArreglo = 'no le deja'
  }
  caso('con la función vieja, el secretario no puede avisar a un hermano',
    'no le deja', antesDelArreglo)

  const actualizar = await readFile('supabase/ACTUALIZAR.sql', 'utf8')
  await sql(actualizar)

  let despuesDelArreglo = ''
  try {
    await comoElSecretario(`
      insert into avisos_hermano (hermandad_id, hermano_id, texto, tipo, titulo)
        values (${HD}, ${DESTINO}, 'PRUEBA tarea asignada', 'ficha', 'Nueva tarea');
    `)
    despuesDelArreglo = 'lo ha dejado'
  } catch (e) {
    despuesDelArreglo = String(e?.stderr ?? e).split('\n')[0]
  }
  caso('con ACTUALIZAR.sql puesto, el aviso le llega al hermano',
    'lo ha dejado', despuesDelArreglo)

  await sql(`delete from avisos_hermano where hermano_id in (${SECRETARIO}, ${DESTINO});`)
}

/**
 * UN CARGO MAL ESCRITO DEJA LA CUENTA SIN NADA, Y HAY QUE DECIRLO.
 *
 * `permisos_cargo` empareja por el TEXTO del cargo, letra por letra. La
 * aplicación escribe «Tesorero/a», con la barra; si en la ficha pone
 * «Tesorero» a secas —o en minúsculas, o con un espacio de más— no casa con
 * ninguna fila y esa cuenta se queda SIN UN SOLO PERMISO.
 *
 * Por fuera se ve igual que un permiso que falta: la persona entra, el panel
 * está vacío y no puede hacer nada, sin ningún mensaje. Es de las averías que
 * más tiempo se llevan, porque la ficha «está bien puesta».
 *
 * Y el diagnóstico, que es lo que se ejecuta cuando eso pasa, mandaba a «dale
 * a «Tesorero» el módulo hermanos»: un consejo imposible, porque ese cargo no
 * existe. Ahora lo dice y enseña los que sí hay.
 */
async function elCargoMalEscrito({ sql, caso }) {
  const UID = '77777777-7777-7777-7777-777777777777'
  const hdad = (await sql(`select id from hermandades limit 1`)).trim()
  if (!hdad) { caso('hay una hermandad para probar el cargo', true, false); return }

  await sql(`
    insert into auth.users (id, email) values ('${UID}', 'malcargo@ejemplo.es') on conflict do nothing;
    -- Los permisos de fábrica de esa hermandad. Hacen falta: la hermandad de
    -- esta prueba se inserta a mano, y en la vida real los siembra
    -- «crear_hermandad» al crearla. Sin ellos no habría NINGÚN cargo con el
    -- que comparar y el diagnóstico diría «no existe» hasta del bien escrito.
    select sembrar_permisos_de_fabrica('${hdad}');
    insert into personal (nombre, email, cargo, clave, activo, auth_user_id, hermandad_id)
      values ('Con Cargo Raro', 'malcargo@ejemplo.es', 'Tesorero', 'x', true, '${UID}', '${hdad}')
      on conflict do nothing;
  `)

  const diagnostico = await readFile('supabase/POR-QUE-NO-PUEDO.sql', 'utf8')
  const salida = await sql(diagnostico)
  const suFila = salida.split('\n').find((l) => l.includes('malcargo@ejemplo.es')) ?? ''

  caso('el diagnóstico encuentra la cuenta', true, suFila.length > 0)
  // Y no dice «su cargo no incluye ese módulo», que manda a arreglar lo que no
  // se puede arreglar: dice que el cargo no existe.
  caso('dice que el cargo no existe', true, /no existe en esta hermandad/.test(suFila))
  caso('y no manda a darle un módulo a un cargo que no hay', false,
    /su cargo no incluye el módulo/.test(suFila))
  // Enseña los que SÍ hay, que es lo único que permite corregirlo.
  caso('enseña los cargos que sí existen', true, /Tesorero\/a/.test(suFila))
  caso('y avisa de que se escriben tal cual', true, /EXACTAMENTE/.test(suFila))

  /*
   * Y que el cargo BIEN escrito siga saliendo bien: una prueba que solo mira
   * el caso malo pasaría igual si el diagnóstico dijera «no existe» siempre.
   */
  await sql(`update personal set cargo = 'Tesorero/a' where email = 'malcargo@ejemplo.es';`)
  const bien = (await sql(diagnostico)).split('\n').find((l) => l.includes('malcargo@ejemplo.es')) ?? ''
  caso('con el cargo bien escrito ya no lo dice', false, /no existe en esta hermandad/.test(bien))
  caso('y le salen los módulos de su cargo', true, /cuotas/.test(bien) && /tesoreria/.test(bien))
}

/**
 * LO QUE PONE SUPABASE Y UN POSTGRES A SECAS NO TIENE.
 *
 * Esta prueba existe para ejecutar el SQL de verdad, y el SQL de verdad está
 * escrito contra Supabase: usa `auth.uid()` en cuarenta y nueve políticas,
 * `auth.users` en cinco claves ajenas, y `storage.objects` para los adjuntos.
 * Nada de eso viene con Postgres.
 *
 * Sin este andamiaje la prueba se saltaba SIEMPRE —«sin Postgres», decía— o
 * fallaba en la línea 158 con «schema auth does not exist», que es lo mismo
 * que no tenerla. Y es la única prueba del proyecto que comprueba que el SQL
 * se instala: las demás lo leen como texto.
 *
 * Se monta lo MÍNIMO y con la misma forma que Supabase, ni más ni menos:
 *
 *   · `auth.uid()` devuelve lo que haya en `request.jwt.claim.sub`, que es de
 *     donde lo saca Supabase. Así una prueba puede hacerse pasar por una
 *     cuenta con `set local`.
 *   · `auth.users` con las dos columnas que usa el SQL: `id` y `email`.
 *   · `storage.foldername(name)` parte la ruta por barras, igual que allí: de
 *     ahí sale la carpeta con la que las políticas separan una hermandad de
 *     otra.
 *
 * NO se copia el resto de Supabase. Esto no comprueba que Supabase funcione;
 * comprueba que NUESTRO SQL se instale y aguante, que es lo que se rompe.
 */
async function montarLoQuePoneSupabase({ sql }) {
  await sql(`
    create schema if not exists auth;
    create schema if not exists storage;

    /*
     * PGCRYPTO VA EN «extensions», COMO EN SUPABASE. No es un detalle.
     *
     * Aquí no se instalaba, así que el «create extension if not exists
     * pgcrypto» de nuestro SQL la instalaba en «public» y todo funcionaba. En
     * Supabase viene ya instalada de fábrica EN EL ESQUEMA «extensions», así
     * que ese mismo «if not exists» no hace nada — y una función declarada con
     * «set search_path = public» no la ve.
     *
     * Resultado: «function gen_random_bytes(integer) does not exist» en la
     * hermandad piloto, con la recuperación de contraseña del hermano rota, y
     * las pruebas en verde. Montándolo como está allí, se cae aquí primero.
     */
    create schema if not exists extensions;
    create extension if not exists pgcrypto with schema extensions;

    -- Las columnas que usa NUESTRO SQL, con el mismo nombre que allí.
    -- «last_sign_in_at» la lee el diagnóstico para ordenar las cuentas por la
    -- última que entró, que casi siempre es la que dio el error.
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      last_sign_in_at timestamptz
    );
    alter table auth.users add column if not exists last_sign_in_at timestamptz;

    -- La cuenta que está haciendo la consulta. En Supabase sale del token; aquí,
    -- de un ajuste de sesión, para que una prueba pueda hacerse pasar por alguien.
    -- Mira los dos sitios: «request.jwt.claim.sub» es de donde lo saca
    -- Supabase, y «test.uid» es el que usa «supabase/PRUEBA-AISLAMIENTO.sql»,
    -- que se escribió antes y se ejecuta a mano contra esta misma base.
    create or replace function auth.uid() returns uuid
      language sql stable as $$
        select coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('test.uid', true), '')
        )::uuid
      $$;

    create or replace function auth.jwt() returns jsonb
      language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
      $$;

    create table if not exists storage.buckets (
      id text primary key,
      name text,
      public boolean default false
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text,
      owner uuid
    );
    alter table storage.objects enable row level security;

    -- «hermandad/2026/escaneo.pdf» → {hermandad, 2026}. La última parte es el
    -- fichero y no cuenta: las políticas miran la PRIMERA, que es la carpeta
    -- de la hermandad.
    create or replace function storage.foldername(name text) returns text[]
      language sql immutable as $$
        select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
      $$;

    -- Roles de Supabase: las concesiones del SQL los nombran.
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
    end $$;
    grant usage on schema public to anon, authenticated, service_role;
    grant usage on schema storage to anon, authenticated, service_role;
    -- Y sobre «auth», que Supabase también lo concede: sin esto, cualquier
    -- función que llame a auth.uid() sin ser SECURITY DEFINER falla aquí y no
    -- allí, que es la peor manera de que se rompa una prueba.
    grant usage on schema auth to anon, authenticated, service_role;
  `)
}

/**
 * Y los PERMISOS DE TABLA, que van después de crearlas.
 *
 * Supabase se los da de fábrica a `anon` y `authenticated` sobre todo lo que
 * hay en `public`; las políticas de seguridad son lo que acota después QUÉ
 * filas ve cada uno. Sin este paso, todo falla con «permission denied», que no
 * es lo que se quiere comprobar: se quiere comprobar qué dicen las políticas,
 * no si hay permiso de tabla.
 */
async function darLosPermisosDeSupabase({ sql }) {
  await sql(`
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    grant all on all tables in schema storage to anon, authenticated, service_role;
  `)
}

/**
 * QUE EL HERMANO PUEDA CAMBIAR SU FICHA, Y SOLO DE UNA MANERA.
 *
 * Esta prueba nace de un arreglo mío que estaba mal. Para no hacer una
 * petición por fila al reimportar un censo, cambié las modificaciones a
 * `upsert`, que hace lo mismo que `update` cuando la fila ya existe.
 *
 * Y no lo hace. PostgREST manda `upsert` como `insert … on conflict do
 * update`, y Postgres comprueba la política de INSERCIÓN aunque acabe
 * actualizando. El hermano tiene `hermanos_propio_update` y no tiene ninguna
 * política de inserción —ni debe tenerla, un hermano no crea hermanos—, así
 * que habría dejado de poder cambiar su correo o su contraseña desde su área.
 *
 * Eso se razona, pero razonarlo no basta: es justo el tipo de cosa que se cree
 * al revés con toda la confianza del mundo. Aquí se ejecuta contra un Postgres
 * de verdad, con la política puesta y la sesión haciéndose pasar por la
 * hermana.
 */
async function elHermanoCambiaSuFicha({ sql, caso }) {
  const UID = '11111111-1111-1111-1111-111111111111'
  const HDAD = '22222222-2222-2222-2222-222222222222'
  const FICHA = '33333333-3333-3333-3333-333333333333'
  await sql(`
    insert into auth.users (id, email) values ('${UID}', 'hermana@ejemplo.es') on conflict do nothing;
    insert into hermandades (id, nombre) values ('${HDAD}', 'Hermandad de prueba') on conflict do nothing;
    insert into hermanos (id, numero, nombre, dni, estado, hermandad_id, auth_user_id)
      values ('${FICHA}', 901, 'Hermana de Prueba', '12345678Z', 'Activo', '${HDAD}', '${UID}')
      on conflict (id) do nothing;
  `)

  /**
   * Ejecuta algo HACIÉNDOSE PASAR por la hermana, y dice si la base lo dejó.
   *
   * Se deja fallar a propósito, sin `exception when others`: dentro de un
   * bloque `do` el error se captura y `raise notice` sale por la salida de
   * ERRORES, que `sql()` no lee. O sea que el rechazo no llegaba y la prueba
   * daba por bueno justo lo que venía a cazar — pasaba en verde.
   *
   * Fallando de verdad, `psql` termina con error y la promesa se rompe: eso sí
   * se ve. Y se devuelve el motivo, para poder comprobar que es el que se
   * espera y no un fallo de sintaxis disfrazado de permiso denegado.
   */
  const comoLaHermana = async (sentencia) => {
    try {
      await sql(`
        begin;
          set local role authenticated;
          set local "request.jwt.claim.sub" = '${UID}';
          ${sentencia}
        rollback;
      `)
      return { deja: 'sí', motivo: '' }
    } catch (e) {
      return { deja: 'no', motivo: String(e?.stderr ?? e) }
    }
  }

  // Primero, que la base la reconozca como hermana: si no, estaría probando
  // las políticas del personal y saldría todo que sí.
  const esHermana = await sql(`
    begin;
      set local role authenticated;
      set local "request.jwt.claim.sub" = '${UID}';
      select auth_es_hermano()::text;
    rollback;
  `)
  caso('la base la ve como hermana', true, /true/.test(esHermana))

  // 1. Cambiar SU ficha: es lo que hace su área. Tiene que poder.
  caso('la hermana puede cambiar su propia ficha', 'sí', (await comoLaHermana(
    `update hermanos set email = 'nuevo@ejemplo.es' where id = '${FICHA}';`)).deja)

  /*
   * 2. Y por `upsert`, NO. Es la comprobación que existe esta prueba: si algún
   * día vuelve a parecer buena idea cambiar las modificaciones a `upsert`, esto
   * lo para antes de que llegue al área del hermano.
   */
  const porUpsert = await comoLaHermana(
    `insert into hermanos (id, numero, nombre, dni, estado, hermandad_id, auth_user_id, email)
       values ('${FICHA}', 901, 'Hermana de Prueba', '12345678Z', 'Activo', '${HDAD}', '${UID}', 'x@ejemplo.es')
       on conflict (id) do update set email = excluded.email;`)
  caso('pero NO por upsert, que exige permiso de inserción', 'no', porUpsert.deja)
  // Y que lo rechace POR ESO, no por otra cosa: si un día falla por sintaxis,
  // la prueba seguiría en verde sin comprobar nada.
  caso('y lo rechaza la política de seguridad', true, /row-level security policy for table "hermanos"/.test(porUpsert.motivo))

  // 3. Y desde luego no puede crear un hermano nuevo, que es de lo que protege
  //    esa política ausente.
  caso('ni puede dar de alta a nadie', 'no', (await comoLaHermana(
    `insert into hermanos (numero, nombre, dni, estado, hermandad_id)
       values (902, 'Colado', '87654321X', 'Activo', '${HDAD}');`)).deja)

  // Y que la aplicación NO use upsert donde escribe el hermano.
  const sync = await readFile('src/lib/supabaseSync.ts', 'utf8')
  caso('y el código no manda ningún upsert', false, /\.upsert\(/.test(sync))
}

/**
 * QUE LA SEGUNDA HERMANDAD PUEDA GUARDAR SUS CATÁLOGOS.
 *
 * `catalogos` se quedó con la clave primaria en (clave, valor), SIN la
 * hermandad. Se convirtieron el DNI del hermano, el número de hermano, los
 * ajustes, la web y las redes sociales; esta se pasó por alto.
 *
 * Y es la peor en la que pasarla por alto, porque ahí viven las listas MENOS
 * distintivas que hay: las categorías de ingreso y de gasto, las cuentas de
 * tesorería, los tipos de incidencia, las categorías del inventario. «Cera»,
 * «Flores», «Limosnas», «Caja», «Bueno». Las escribe igual todo el mundo.
 *
 * Así que la segunda hermandad que entrara no podía guardar prácticamente
 * ninguna de las suyas: la fila ya existía, de otra gente, y el guardado se
 * estrellaba contra una clave duplicada. No es un caso raro que salga con el
 * tiempo — sale con la hermandad número dos y con el primer valor obvio.
 *
 * Y ENCIMA NO SE VE VENIR: por la frontera de seguridad, la fila que estorba
 * es de otra hermandad y por tanto invisible. En pantalla no hay nada
 * repetido, y aun así no se puede guardar.
 *
 * Esto se ejecuta de verdad porque es lo único que lo demuestra: la clave es
 * cosa de la base de datos, y leer el SQL como texto no dice si la migración
 * llegó a aplicarse sobre una base que ya existía.
 */
async function laSegundaHermandadGuardaSusCatalogos({ sql, caso }) {
  const clave = (await sql(
    "select pg_get_constraintdef(oid) from pg_constraint "
    + "where conrelid = 'catalogos'::regclass and contype = 'p'",
  )).trim()
  caso('la clave de los catálogos lleva la hermandad delante',
    'PRIMARY KEY (hermandad_id, clave, valor)', clave)

  const A = "'a0000000-0000-0000-0000-00000000000a'"
  const B = "'b0000000-0000-0000-0000-00000000000b'"
  await sql(`insert into hermandades (id, nombre) values (${A}, 'Hdad. A'), (${B}, 'Hdad. B')
             on conflict (id) do nothing`)
  await sql("delete from catalogos where valor = 'Cera'")

  // Las dos escriben «Cera», que es lo que escribe cualquiera.
  let dosVeces = ''
  try {
    await sql(`insert into catalogos (hermandad_id, clave, valor, orden)
               values (${A}, 'cabildo-catalogo-gastos', 'Cera', 1)`)
    await sql(`insert into catalogos (hermandad_id, clave, valor, orden)
               values (${B}, 'cabildo-catalogo-gastos', 'Cera', 1)`)
    dosVeces = 'ok'
  } catch (e) {
    dosVeces = String(e.stderr ?? e.message).split('\n').filter((l) => /ERROR/.test(l)).join(' · ')
  }
  caso('las dos hermandades guardan su «Cera»', 'ok', dosVeces)
  caso('y quedan las dos filas', '2',
    (await sql("select count(*) from catalogos where valor = 'Cera'")).trim())

  /*
   * Y DENTRO DE UNA MISMA HERMANDAD SIGUE SIN PODER REPETIRSE. Es la mitad que
   * no se puede perder al arreglar la otra: una categoría repetida sale dos
   * veces en cada desplegable de tesorería y no hay forma de quitarla.
   */
  let repetida = ''
  try {
    await sql(`insert into catalogos (hermandad_id, clave, valor, orden)
               values (${A}, 'cabildo-catalogo-gastos', 'Cera', 2)`)
    repetida = 'la ha dejado repetir (mal)'
  } catch {
    repetida = 'no deja'
  }
  caso('la misma hermandad no puede repetir un valor', 'no deja', repetida)

  // Y una fila sin hermandad ya no entra: antes se creaba y no la veía nadie,
  // que es como se llenó la tabla de filas huérfanas que bloqueaban la clave.
  let huerfana = ''
  try {
    await sql("insert into catalogos (clave, valor) values ('cabildo-catalogo-gastos', 'Sin dueño')")
    huerfana = 'la ha dejado entrar (mal)'
  } catch {
    huerfana = 'no deja'
  }
  caso('una fila sin hermandad no entra', 'no deja', huerfana)
}

/**
 * EL HERMANO NO SE PONE LA CUOTA COMO PAGADA.
 *
 * El hermano necesita poder escribir en SU recibo: es como avisa de que ha
 * pagado por Bizum. Para eso hay una política de UPDATE sobre `cuotas`, y se
 * dejó SIN ACOTAR POR COLUMNAS con este razonamiento, escrito en el SQL:
 *
 *     «No hace falta acotar más por columnas: lo único que la aplicación le
 *      deja tocar ahí es el aviso de pago.»
 *
 * Y ahí está el fallo. Lo que le deje tocar la aplicación no protege nada: él
 * tiene una sesión de verdad y desde la consola del navegador habla con la base
 * directamente, sin pasar por ninguna pantalla:
 *
 *     supabase.from('cuotas').update({ estado: 'Pagada', importe: 0 })...
 *
 * En ese momento su recibo queda pagado y a cero, sale al corriente, se lleva
 * su papeleta de sitio, y las cuentas de la hermandad dicen que ese dinero
 * entró. La tesorería no tiene forma de notarlo.
 *
 * Es el mismo agujero que ya se cerró en la ficha del hermano —donde bastaba
 * con ponerse `estado: 'Activo'` para recuperar un cargo destituido— y se
 * cierra igual: lista blanca.
 *
 * ESTO SE EJECUTA DE VERDAD, con la sesión del hermano puesta, porque es lo
 * único que lo demuestra: leer la política como texto no dice qué columnas deja
 * pasar, precisamente porque RLS no sabe de columnas.
 */
async function elHermanoNoSePagaLaCuota({ sql, caso }) {
  const HD = "'d0000000-0000-0000-0000-00000000000d'"
  const CUENTA = "'e0000000-0000-0000-0000-00000000000e'"
  const HNO = "'f0000000-0000-0000-0000-00000000000f'"

  await sql(`
    insert into hermandades (id, nombre) values (${HD}, 'Hdad. del hermano listo')
      on conflict (id) do nothing;
    insert into auth.users (id, email, raw_user_meta_data)
      values (${CUENTA}, 'manuel@ejemplo.com', '{"tipo":"hermano"}') on conflict (id) do nothing;
    delete from cuotas where hermano_id = ${HNO};
    delete from hermanos where id = ${HNO};
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id)
      values (${HNO}, ${HD}, 'Manuel', '99999999Z', 1, 'Activo', ${CUENTA});
    insert into cuotas (id, hermandad_id, hermano_id, numero, concepto, importe, estado, ejercicio)
      values (gen_random_uuid(), ${HD}, ${HNO}, 9001, 'Cuota anual', 60, 'Pendiente', 2026);
  `)

  /** Una consulta con la sesión de ese hermano puesta, como la haría su navegador. */
  const comoElHermano = (consulta) => sql(`
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = ${CUENTA};
    set local request.jwt.claims = '{"user_metadata":{"tipo":"hermano"}}';
    ${consulta}
    rollback;
  `)

  const intento = await comoElHermano(`
    update cuotas set estado = 'Pagada', importe = 0 where numero = 9001;
    select estado || ' · ' || importe::text from cuotas where numero = 9001;
  `)
  const comoQueda = intento.split('\n').map((l) => l.trim()).find((l) => /·/.test(l))
  caso('el hermano no puede ponerse el recibo como pagado', 'Pendiente · 60.00', comoQueda)

  // Y lo que SÍ tiene que poder: avisar de que ha pagado. Sin esto el arreglo
  // rompería lo que venía a proteger — su recibo se quedaría sin poder avisar.
  const aviso = await comoElHermano(`
    update cuotas set pago_comunicado = '{"metodo":"Bizum","fecha":"2026-08-23"}'::jsonb
      where numero = 9001;
    select coalesce(pago_comunicado ->> 'metodo', '(nada)') from cuotas where numero = 9001;
  `)
  caso('pero sí puede avisar de que ha pagado', true, /Bizum/.test(aviso))

  // Ni crearse recibos de la nada.
  let creando = ''
  try {
    await comoElHermano(`
      insert into cuotas (id, hermandad_id, hermano_id, numero, concepto, importe, estado, ejercicio)
        values (gen_random_uuid(), ${HD}, ${HNO}, 9002, 'Regalo', 0, 'Pagada', 2026);
    `)
    creando = 'lo ha dejado (mal)'
  } catch {
    creando = 'no le deja'
  }
  caso('ni crearse un recibo pagado', 'no le deja', creando)

  /*
   * Y EN LA PAPELETA: renovar y renunciar sí; ponerse «Pagada» o «Entregada»,
   * no. Es lo mismo por otro camino — con la papeleta entregada sale en el
   * cortejo sin haberla pagado.
   */
  await sql(`
    delete from papeletas where numero = 9001;
    insert into papeletas (id, hermandad_id, hermano_id, numero, anio, importe, estado)
      values (gen_random_uuid(), ${HD}, ${HNO}, 9001, 2026, 30, 'Asignada');
  `)
  const papeleta = await comoElHermano(`
    update papeletas set estado = 'Pagada', fecha_entrega = '2026-03-01' where numero = 9001;
    select estado || ' · ' || coalesce(fecha_entrega::text, 'sin entregar') from papeletas where numero = 9001;
  `)
  const quedaLaPapeleta = papeleta.split('\n').map((l) => l.trim()).find((l) => /·/.test(l))
  caso('no puede darse la papeleta por pagada ni entregada',
    'Asignada · sin entregar', quedaLaPapeleta)

  const renuncia = await comoElHermano(`
    update papeletas set estado = 'Renuncia' where numero = 9001;
    select estado from papeletas where numero = 9001;
  `)
  caso('pero sí puede renunciar a su sitio', true, /Renuncia/.test(renuncia))

  /*
   * Y LO QUE PIDE DESDE SU ÁREA TIENE QUE LLEGAR A LA HERMANDAD.
   *
   * Esto es lo que no pasaba, y no era un permiso mal puesto: era que no
   * había tabla. La solicitud de papeleta de sitio se guardaba en el
   * `localStorage` del móvil del hermano y en ningún otro sitio. Él la veía
   * enviada; la secretaría, desde el ordenador de la casa de hermandad, no
   * veía ninguna. Los dos lados de la misma función leyendo cajones
   * distintos, sin un solo aviso.
   *
   * Se comprueba lo único que importa: que la escriba él y la lea ella.
   */
  await sql(`delete from solicitudes_papeleta where anio = 2099;`)
  await sql(`
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = ${CUENTA};
    set local request.jwt.claims = '{"user_metadata":{"tipo":"hermano"}}';
    insert into solicitudes_papeleta (hermano_id, anio, modalidad, tramo_solicitado, fecha)
      values (${HNO}, 2099, 'Nazareno', 'Cirio 1', '2026-08-23');
    commit;
  `)
  const laVeLaSecretaria = await sql(`
    select hermano_nombre || ' pide ' || tramo_solicitado || ' (' || estado || ')'
      from solicitudes_papeleta where anio = 2099;
  `)
  caso('la solicitud del hermano llega a la hermandad',
    'Manuel pide Cirio 1 (Pendiente)', laVeLaSecretaria.trim())

  /*
   * Y NO SE LA ACEPTA ÉL SOLO, que es lo que la convierte en papeleta.
   *
   * Se mira CUÁNTAS FILAS toca, no si da error. La política de modificación no
   * incluye a los hermanos, así que su UPDATE no revienta: no encuentra la
   * fila y se va con cero. Esperar una excepción aquí era esperar el rechazo
   * equivocado — y una prueba que espera el rechazo equivocado se pone verde
   * el día que el permiso se abre de par en par.
   */
  const cuantasToca = await comoElHermano(`
    with tocadas as (
      update solicitudes_papeleta set estado = 'Aceptada' where anio = 2099 returning 1
    ) select count(*) from tocadas;
  `)
  caso('pero no se la acepta él', true, /(^|\s)0(\s|$)/m.test(cuantasToca))
  caso('y sigue pendiente', 'Pendiente',
    (await sql(`select estado from solicitudes_papeleta where anio = 2099;`)).trim())
  await sql(`delete from solicitudes_papeleta where anio = 2099;`)

  /*
   * EL BUZÓN DEL HERMANO ESTABA EN EL ORDENADOR DE LA SECRETARÍA.
   *
   * La tabla `avisos_hermano` existe desde el principio, con sus políticas
   * puestas. Lo que faltaba era que alguien la usara: todos los avisos se
   * guardaban en `localStorage` y en ningún otro sitio. La secretaria daba un
   * recibo por pagado desde su ordenador, el aviso se escribía en SU
   * navegador, y el hermano abría su área en el móvil y no tenía nada. La
   * campana, el buzón, los avisos de cuota y de papeleta, el de la baja: todo
   * vacío para siempre, sin un error por medio.
   */
  await sql(`delete from avisos_hermano where texto like 'PRUEBA %';`)
  // Lo escribe la hermandad (aquí, el montaje de la prueba). Lo que se
  // comprueba es que LE LLEGUE, que es lo que no pasaba.
  await sql(`
    insert into avisos_hermano (hermandad_id, hermano_id, texto, tipo, titulo)
      values (${HD}, ${HNO}, 'PRUEBA tu recibo queda pagado', 'cuota', 'Cuota pagada');
  `)
  const loQueVeElHermano = await comoElHermano(`
    select titulo || ' · ' || texto from avisos_hermano where texto like 'PRUEBA %';
  `)
  caso('el aviso que escribe la hermandad le llega al hermano', true,
    /Cuota pagada · PRUEBA tu recibo queda pagado/.test(loQueVeElHermano))

  // Y lo puede dar por leído: es lo único que toca de él.
  const marcando = await comoElHermano(`
    with tocadas as (
      update avisos_hermano set leido = true where texto like 'PRUEBA %' returning 1
    ) select count(*) from tocadas;
  `)
  caso('y puede darlo por leído', true, /(^|\s)1(\s|$)/m.test(marcando))

  /*
   * PERO NO BORRARLO. Un aviso es la constancia de que se le comunicó algo, y
   * la baja o el cambio de cuenta bancaria son cosas que a la hermandad le
   * interesa poder demostrar que dijo. En la pantalla, «borrar» lo quita de la
   * vista dándolo por leído.
   */
  const borrando = await comoElHermano(`
    with borradas as (delete from avisos_hermano where texto like 'PRUEBA %' returning 1)
    select count(*) from borradas;
  `)
  caso('pero no borrarlo', true, /(^|\s)0(\s|$)/m.test(borrando))

  // Ni escribirse uno a nombre de otro: la política de escritura es solo del
  // personal de la hermandad.
  let inventando = ''
  try {
    await comoElHermano(`
      insert into avisos_hermano (hermandad_id, hermano_id, texto, tipo)
        values (${HD}, ${HNO}, 'PRUEBA inventado', 'ficha');
    `)
    inventando = 'lo ha dejado (mal)'
  } catch {
    inventando = 'no le deja'
  }
  caso('ni escribirse avisos él mismo', 'no le deja', inventando)
  await sql(`delete from avisos_hermano where texto like 'PRUEBA %';`)

  /*
   * DOS RECIBOS CON EL MISMO NÚMERO.
   *
   * El número de recibo va impreso en el justificante del hermano y es por lo
   * que pregunta la tesorería al cuadrar el extracto: «el 412 no me aparece».
   * Que haya dos 412 no es un detalle de listado: es que esa conversación deja
   * de tener respuesta.
   *
   * `hermanos` y `papeletas` tenían su número protegido; `cuotas` se quedó sin
   * nada. Y no hace falta mala suerte: el número lo calcula la aplicación con
   * «el mayor que veo, más uno», y lo que ve es su lista cargada. Dos personas
   * emitiendo desde dos ordenadores el día del cabildo bastan.
   */
  await sql(`delete from cuotas where numero in (9101, 9102);`)
  await sql(`
    insert into cuotas (hermandad_id, hermano_id, numero, concepto, importe, estado, ejercicio)
      values (${HD}, ${HNO}, 9101, 'Cuota anual', 60, 'Pendiente', 2099);
  `)
  let repetido = ''
  try {
    await sql(`
      insert into cuotas (hermandad_id, hermano_id, numero, concepto, importe, estado, ejercicio)
        values (${HD}, ${HNO}, 9101, 'Cuota anual', 60, 'Pendiente', 2099);
    `)
    repetido = 'lo ha dejado (mal)'
  } catch {
    repetido = 'no le deja'
  }
  caso('no puede haber dos recibos con el mismo número', 'no le deja', repetido)

  // Y en OTRO ejercicio tampoco: la aplicación numera seguido, sin reiniciar
  // cada año, así que dos «412» en años distintos son igual de indistinguibles
  // cuando la tesorería busca el 412 en el extracto.
  let otroAnio = ''
  try {
    await sql(`
      insert into cuotas (hermandad_id, hermano_id, numero, concepto, importe, estado, ejercicio)
        values (${HD}, ${HNO}, 9101, 'Cuota anual', 60, 'Pendiente', 2098);
    `)
    otroAnio = 'lo ha dejado (mal)'
  } catch {
    otroAnio = 'no le deja'
  }
  caso('ni en otro ejercicio', 'no le deja', otroAnio)

  // Pero el siguiente número sí entra, claro.
  await sql(`
    insert into cuotas (hermandad_id, hermano_id, numero, concepto, importe, estado, ejercicio)
      values (${HD}, ${HNO}, 9102, 'Cuota anual', 60, 'Pendiente', 2099);
  `)
  caso('y el siguiente número sí', '2',
    (await sql(`select count(*) from cuotas where numero in (9101, 9102);`)).trim())
  await sql(`delete from cuotas where numero in (9101, 9102);`)
}

/**
 * LA WEB PÚBLICA LA EDITA QUIEN TIENE EL MÓDULO «WEB», Y NO CUALQUIERA.
 *
 * El módulo existía y la pantalla lo respetaba —quien no lo tiene no ve la
 * sección de la web—, pero la base de datos no lo pedía. Su política decía solo
 * «no es un hermano»:
 *
 *     using (not auth_es_hermano()) with check (not auth_es_hermano())
 *
 * Así que cualquiera del personal, con el cargo que fuera, podía reescribir la
 * web pública desde la consola del navegador sin pasar por ninguna pantalla: el
 * diputado de tramo, el fiscal, el mayordomo. Es el mismo error de siempre —lo
 * que esconde la pantalla no protege nada— y aquí duele más, porque la web
 * pública la ve el barrio entero.
 */
async function laWebLaEditaQuienTieneWeb({ sql, caso }) {
  const HD = "'d0000000-0000-0000-0000-00000000000d'"
  const DIPU = "'b0000000-1111-0000-0000-00000000000b'"
  const SECRE = "'a0000000-1111-0000-0000-00000000000a'"

  await sql(`
    select sembrar_permisos_de_fabrica(${HD});
    insert into auth.users (id, email) values
      (${DIPU}, 'diputada@ejemplo.com'), (${SECRE}, 'secre@ejemplo.com')
      on conflict (id) do nothing;
    delete from personal where email in ('diputada@ejemplo.com', 'secre@ejemplo.com');
    insert into personal (id, hermandad_id, nombre, email, cargo, activo, auth_user_id) values
      (gen_random_uuid(), ${HD}, 'Marta', 'diputada@ejemplo.com', 'Diputado/a Mayor de Gobierno', true, ${DIPU}),
      (gen_random_uuid(), ${HD}, 'Pilar', 'secre@ejemplo.com', 'Secretario/a', true, ${SECRE});
    delete from web_publica where hermandad_id = ${HD};
    insert into web_publica (hermandad_id, slug, publicada, datos)
      values (${HD}, 'hdad-de-prueba', true, '{"titulo":"La de siempre"}');
  `)

  const como = (quien, consulta) => sql(`
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = ${quien};
    ${consulta}
    rollback;
  `)

  // Primero: que el módulo esté sembrado donde toca. Si no, lo de abajo pasaría
  // por el motivo equivocado —nadie podría editar la web— y saldría en verde.
  const conWeb = await sql(`
    select string_agg(cargo, ', ' order by cargo) from permisos_cargo
     where hermandad_id = ${HD} and modulo_id = 'web'
  `)
  caso('el módulo «web» está sembrado en los cargos que lo llevan',
    'Hermano Mayor, Secretario/a', conWeb.trim())

  const dipu = await como(DIPU, `
    update web_publica set datos = '{"titulo":"Reescrita"}' where slug = 'hdad-de-prueba';
    select datos ->> 'titulo' from web_publica where slug = 'hdad-de-prueba';
  `)
  caso('quien no tiene «web» no puede tocarla', true, /La de siempre/.test(dipu))

  const secre = await como(SECRE, `
    update web_publica set datos = '{"titulo":"Cultos de septiembre"}' where slug = 'hdad-de-prueba';
    select datos ->> 'titulo' from web_publica where slug = 'hdad-de-prueba';
  `)
  caso('y quien sí lo tiene, sigue pudiendo', true, /Cultos de septiembre/.test(secre))
}

/**
 * LA CONTRASEÑA DE QUIEN PIDE EL ALTA NO SE GUARDA EN NINGUNA PARTE.
 *
 * `solicitudes_alta.clave_propuesta` guardaba EN CLARO la contraseña que
 * tecleaba quien pedía el alta desde la web pública. La ve cualquiera del
 * personal con el módulo «hermanos» —Hermano Mayor, Secretaría, Diputado
 * Mayor—, en la propia fila de la solicitud, y se quedaba ahí mientras la
 * solicitud estuviera pendiente: en una hermandad, semanas.
 *
 * La gente repite contraseñas. La que veía la secretaria es, con mucha
 * probabilidad, la del correo de esa persona. Y quien pide el alta no se la
 * está dando a una empresa con un equipo de seguridad: se la está dando a un
 * vecino que lleva la secretaría los martes.
 *
 * Y NO HACÍA FALTA NINGUNA: el camino de «se genera una clave de un solo uso al
 * aprobar y se manda por correo» ya existía —se usaba en el alta de un menor—
 * y ahora se usa siempre.
 */
async function nadieGuardaContrasenasEnClaro({ sql, caso }) {
  const HD = "'90000000-0000-0000-0000-000000000009'"
  await sql(`
    insert into hermandades (id, nombre) values (${HD}, 'Hdad. de las solicitudes')
      on conflict (id) do nothing;
    delete from solicitudes_alta where dni in ('11111111H', '22222222J');
  `)

  /*
   * UNA COMO LAS QUE MANDA UNA VERSIÓN ANTERIOR DE LA APLICACIÓN. Esto no es
   * rebuscado: la hermandad puede tener el navegador abierto desde ayer con el
   * formulario viejo, y ese sí manda la contraseña. Por eso el arreglo no es
   * solo quitar el campo del formulario.
   */
  await sql(`
    insert into solicitudes_alta (id, hermandad_id, nombre, dni, email, clave_propuesta, fecha, estado)
      values (gen_random_uuid(), ${HD}, 'Ana', '11111111H', 'ana@ejemplo.com',
              'miclavedelcorreo', '23 ago 2026', 'Pendiente');
  `)
  const guardada = (await sql("select coalesce(clave_propuesta, '(nulo)') from solicitudes_alta where dni = '11111111H'")).trim()
  caso('la contraseña no llega a guardarse', '', guardada)

  // Y la solicitud SÍ se guarda: quien la pide no puede quedarse fuera porque
  // su navegador tenga la versión de ayer.
  caso('pero la solicitud entra igual', '1',
    (await sql("select count(*) from solicitudes_alta where dni = '11111111H'")).trim())

  // Ni al modificarla después.
  await sql("update solicitudes_alta set clave_propuesta = 'otra' where dni = '11111111H'")
  caso('ni se cuela al modificarla', '', (await sql(
    "select coalesce(clave_propuesta, '') from solicitudes_alta where dni = '11111111H'")).trim())

  caso('no queda ninguna contraseña guardada', '0',
    (await sql("select count(*) from solicitudes_alta where coalesce(clave_propuesta, '') <> ''")).trim())

  await elFormularioYaNoLaPide({ caso })
}

/** Y los dos formularios que la pedían dejan de pedirla. */
async function elFormularioYaNoLaPide({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const web = await readFile('src/components/FormulariosWeb.tsx', 'utf8')
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  const hermanos = await readFile('src/pages/app/Hermanos.tsx', 'utf8')

  caso('el formulario de la web no pide contraseña', false, /autoComplete="new-password"/.test(web))
  caso('y manda la solicitud sin ninguna', true, /clavePropuesta: '',/.test(web))
  caso('el del área del hermano tampoco', false, /name="clavePropuesta"/.test(portal))

  /*
   * Y LO QUE HABRÍA ROTO EL ARREGLO SI SE HUBIERA HECHO A MEDIAS:
   *
   * `esMenorACargo` se decidía con «tiene tutor O no trae contraseña». En
   * cuanto ninguna solicitud trae contraseña, esa condición hace que TODO EL
   * MUNDO pase por menor: se aprueba el alta y no se le crea cuenta a nadie,
   * sin un solo aviso. Menor es quien tiene tutor, y solo eso.
   */
  caso('menor es quien tiene tutor, y solo eso', true,
    /const esMenorACargo = Boolean\(sol\.tutorId\)\n/.test(hermanos))
  caso('la clave se genera siempre', true, /const claveProvisional = claveDeUnSoloUso\(\)/.test(hermanos))
  caso('y se le manda por correo', true, /claveProvisional: acceso\.id \? claveProvisional : null/.test(hermanos))
}

/**
 * LAS TRES PUERTAS QUE EMPUJA CUALQUIERA DESDE FUERA, CON FRENO.
 *
 * El buzón de la web, las solicitudes de alta y el contador de visitas se abren
 * a quien no ha iniciado sesión, a propósito: es la web pública y el visitante
 * no tiene cuenta ni la va a tener. Lo que faltaba era el tope.
 *
 * Lo que hay en el navegador no cuenta. Los formularios llevan un campo trampa
 * para robots y está bien, pero solo lo pisa quien pasa por el formulario;
 * quien habla con la base directamente, no.
 *
 * Y sin tope pasan dos cosas distintas:
 *
 *   · SE AHOGA EL BUZÓN. Diez mil mensajes de relleno y los tres de verdad —un
 *     donativo, alguien que quiere hacerse hermano— no hay quien los encuentre.
 *     No hace falta tirar nada abajo para hacer daño.
 *   · SE LLENA LA BASE. En el plan gratuito de Supabase el espacio está
 *     contado, y ahí no se cae solo el buzón: se cae la hermandad entera, con
 *     su censo y sus cuotas dentro.
 *
 * Se ejecuta de verdad, empujando las tres, porque un contador que se lee bien
 * puede contar mal.
 */
async function losFormulariosPublicosTienenFreno({ sql, caso }) {
  const HD = "'70000000-0000-0000-0000-000000000007'"
  await sql(`
    insert into hermandades (id, nombre) values (${HD}, 'Hdad. del formulario')
      on conflict (id) do nothing;
    delete from mensajes_web where hermandad_id = ${HD};
    delete from solicitudes_alta where hermandad_id = ${HD};
    delete from visitas_web where hermandad_id = ${HD};
  `)

  // --- El buzón: sesenta por hora, y el texto con medida.
  await sql(`
    do $$ begin
      for i in 1..80 loop
        begin
          insert into mensajes_web (hermandad_id, tipo, nombre, email, mensaje, fecha)
            values (${HD}, 'contacto', 'Robot ' || i, 'r@x.es', repeat('x', 50000), '23 ago 2026');
        exception when sqlstate 'P0001' then exit;
        end;
      end loop;
    end $$;
  `)
  caso('el buzón se para en sesenta por hora', '60',
    (await sql(`select count(*) from mensajes_web where hermandad_id = ${HD}`)).trim())
  /*
   * Y EL TEXTO SE RECORTA. Sin esto, un solo mensaje puede traer megas: sesenta
   * mensajes de cincuenta mil caracteres son tres megas de una tacada, y el
   * tope por hora no lo impide.
   */
  caso('y un mensaje no puede traer megas', '4000',
    (await sql(`select length(mensaje) from mensajes_web where hermandad_id = ${HD} limit 1`)).trim())

  // --- Las solicitudes: trescientas pendientes a la vez.
  await sql(`
    do $$ begin
      for i in 1..320 loop
        begin
          insert into solicitudes_alta (hermandad_id, nombre, dni, email, fecha, estado)
            values (${HD}, 'Robot ' || i, lpad(i::text, 8, '0') || 'A', 'r' || i || '@x.es',
                    '23 ago 2026', 'Pendiente');
        exception when sqlstate 'P0001' then exit;
        end;
      end loop;
    end $$;
  `)
  caso('las solicitudes se paran en trescientas pendientes', '300',
    (await sql(`select count(*) from solicitudes_alta where hermandad_id = ${HD}`)).trim())

  /*
   * Y LA HERMANDAD NO SE FRENA A SÍ MISMA. Es la mitad que no se puede perder:
   * la secretaría tiene que poder meter un alta a mano justo el día que alguien
   * les ha llenado el panel, que es cuando más falta hace.
   */
  const aMano = await sql(`
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = '${'a0000000-1111-0000-0000-00000000000a'}';
    insert into solicitudes_alta (hermandad_id, nombre, dni, email, fecha, estado)
      values (${HD}, 'Alta a mano', '99887766B', 'x@x.es', '23 ago 2026', 'Pendiente');
    select count(*) from solicitudes_alta where dni = '99887766B';
    rollback;
  `)
  caso('pero la secretaría sí puede meter una a mano', true, /(^|\s)1(\s|$)/m.test(aMano))

  /*
   * --- EL CONTADOR DE VISITAS ---
   *
   * Es la más fácil de empujar de las tres, porque ni siquiera hay que rellenar
   * nada: basta con pedir direcciones. Cada ruta distinta creaba una fila, sin
   * ningún límite. Pasadas trescientas en un día se cuentan juntas en «/otras»:
   * la visita se sigue contando y lo que no crece es la tabla.
   */
  await sql(`
    do $$ begin
      for i in 1..500 loop perform contar_visita(${HD}, '/a' || i); end loop;
    end $$;
  `)
  caso('quinientas rutas distintas no crean quinientas filas', '301',
    (await sql(`select count(*) from visitas_web where hermandad_id = ${HD}`)).trim())
  caso('las de más se cuentan juntas', '200',
    (await sql(`select visitas from visitas_web where hermandad_id = ${HD} and ruta = '/otras'`)).trim())

  // Y una ruta que ya existía sigue contando aparte: el tope no puede hacer que
  // la hermandad deje de ver las visitas de sus propias páginas.
  await sql(`select contar_visita(${HD}, '/a1')`)
  caso('y una ruta de verdad sigue contando sola', '2',
    (await sql(`select visitas from visitas_web where hermandad_id = ${HD} and ruta = '/a1'`)).trim())

  await yElFrenoNoSePuedeEsquivar({ sql, caso, HD })
}

/**
 * Y EL FRENO NO SE PUEDE ESQUIVAR DESDE FUERA.
 *
 * Un tope que se salta con un campo más no es un tope. Los dos se saltaban:
 *
 *   · EL DEL BUZÓN cuenta los de la última hora por `creado_en`. Esa columna
 *     tiene `default now()`, pero un valor por defecto solo se usa cuando no
 *     mandas nada: poniéndola tres días atrás, el contador no veía ninguno.
 *     Comprobado antes del arreglo: entraban los doscientos.
 *   · EL DE LAS SOLICITUDES cuenta las PENDIENTES, así que mandándolas con
 *     `estado: 'Aprobada'` tampoco contaban. Y eso es peor que saltarse el
 *     tope: una solicitud que llega ya aprobada desde fuera aparece en el panel
 *     de la secretaría como si la hubiera aprobado alguien de la casa.
 *
 * Ahora la hora y el estado los pone la base, y de paso `leido` y `atendido`
 * también: si no, se puede dejar un mensaje ya marcado como leído y atendido —o
 * sea, invisible en el buzón—.
 */
async function yElFrenoNoSePuedeEsquivar({ sql, caso, HD }) {
  await sql(`delete from mensajes_web where hermandad_id = ${HD}`)
  await sql(`
    do $$ begin
      for i in 1..200 loop
        begin
          insert into mensajes_web (hermandad_id, tipo, nombre, mensaje, fecha, creado_en, leido, atendido)
            values (${HD}, 'contacto', 'R' || i, 'x', '23 ago 2026',
                    now() - interval '3 days', true, true);
        exception when sqlstate 'P0001' then exit;
        end;
      end loop;
    end $$;
  `)
  caso('con la fecha falseada, el freno sigue parando en sesenta', '60',
    (await sql(`select count(*) from mensajes_web where hermandad_id = ${HD}`)).trim())
  caso('y ninguno entra ya marcado como leído', '0',
    (await sql(`select count(*) from mensajes_web where hermandad_id = ${HD} and leido`)).trim())

  await sql(`delete from solicitudes_alta where hermandad_id = ${HD}`)
  await sql(`
    do $$ begin
      for i in 1..400 loop
        begin
          insert into solicitudes_alta (hermandad_id, nombre, dni, email, fecha, estado)
            values (${HD}, 'R' || i, lpad(i::text, 8, '0') || 'A', 'r' || i || '@x.es',
                    '23 ago 2026', 'Aprobada');
        exception when sqlstate 'P0001' then exit;
        end;
      end loop;
    end $$;
  `)
  caso('mandarlas «ya aprobadas» tampoco se salta el tope', '300',
    (await sql(`select count(*) from solicitudes_alta where hermandad_id = ${HD}`)).trim())
  caso('y ninguna entra aprobada', '0',
    (await sql(`select count(*) from solicitudes_alta where hermandad_id = ${HD} and estado = 'Aprobada'`)).trim())
}

/**
 * SER HERMANO DE DOS HERMANDADES A LA VEZ.
 *
 * En Andalucía es lo normal, y hasta ahora esa persona solo podía entrar en el
 * área de UNA. El censo ya lo contemplaba —el DNI se hizo único POR hermandad
 * en su día, con el comentario «la misma persona puede ser hermana de dos»—;
 * lo que faltaba era la cuenta.
 *
 * Un hermano entra eligiendo hermandad, con su DNI y su contraseña: el correo
 * NO LO TECLEA NUNCA, la aplicación lo busca a partir del DNI. Pero las cuentas
 * de Supabase se identifican por correo, y el correo es único en todo el
 * sistema — así que la segunda hermandad se estrellaba con «ese correo ya lo
 * usa otra cuenta» y esa persona quedaba en el censo sin poder entrar.
 *
 * Se separan dos cosas que estaban pegadas sin necesidad: `email`, que es su
 * correo y sirve para los avisos —el MISMO en las dos hermandades—, y
 * `correo_acceso`, que es cómo se llama su cuenta por dentro, una por
 * hermandad, y que no ve ni teclea nadie.
 */
async function hermanoDeDosHermandades({ sql, caso }) {
  const A = "'a1a1a1a1-0000-0000-0000-0000000000a1'"
  const B = "'b2b2b2b2-0000-0000-0000-0000000000b2'"

  await sql(`
    insert into hermandades (id, nombre) values
      (${A}, 'Hdad. de la Vera-Cruz'), (${B}, 'Hdad. de la Amargura')
      on conflict (id) do nothing;
    delete from hermanos where dni in ('11223344C', '55667788D');
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, email, correo_acceso) values
      (gen_random_uuid(), ${A}, 'Manuel Ruiz', '11223344C', 45, 'Activo', 'manuel@gmail.com',
       correo_de_acceso(${A}, '11223344C')),
      (gen_random_uuid(), ${B}, 'Manuel Ruiz', '11223344C', 312, 'Activo', 'manuel@gmail.com',
       correo_de_acceso(${B}, '11223344C'));
  `)

  caso('la misma persona está en las dos, con el mismo correo de avisos', '2',
    (await sql("select count(*) from hermanos where dni = '11223344C' and email = 'manuel@gmail.com'")).trim())
  caso('y cada hermandad le da una cuenta distinta', '2',
    (await sql("select count(distinct correo_acceso) from hermanos where dni = '11223344C'")).trim())

  /*
   * Y AL ENTRAR, CADA HERMANDAD LE DEVUELVE LA SUYA. Con el DNI escrito como le
   * salga —con puntos, con guion, en minúscula—, que es como lo escribe medio
   * mundo y como está en la mitad de los censos importados.
   */
  const enA = (await sql(`select resolver_email_hermano(${A}, '11.223.344-C')`)).trim()
  const enB = (await sql(`select resolver_email_hermano(${B}, '11223344c')`)).trim()
  caso('entrando por la Vera-Cruz le toca una cuenta', true, /^11223344C\./.test(enA))
  caso('y por la Amargura, otra', true, enB !== '' && enB !== enA)

  /*
   * --- LO QUE NO SE PUEDE ROMPER ARREGLANDO ESTO ---
   *
   * Quien YA tiene cuenta no se entera de nada. Su `correo_acceso` está a null
   * y entonces se devuelve el correo de siempre: entra igual que ayer. Si esto
   * fallara, el día de la actualización se quedarían fuera TODOS los hermanos
   * que ya estaban dentro, que es lo peor que podría pasar aquí.
   */
  await sql(`
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, email)
      values (gen_random_uuid(), ${A}, 'Ana de Siempre', '55667788D', 12, 'Activo', 'ana@gmail.com');
  `)
  caso('quien ya tenía cuenta entra con su correo de siempre', 'ana@gmail.com',
    (await sql(`select resolver_email_hermano(${A}, '55667788D')`)).trim())

  // Y un hermano de baja sigue sin poder entrar por ninguna de las dos vías.
  await sql("update hermanos set estado = 'Baja' where dni = '55667788D'")
  caso('y un hermano de baja no entra', '',
    (await sql(`select coalesce(resolver_email_hermano(${A}, '55667788D'), '')`)).trim())

  await laRecuperacionDeContrasena({ sql, caso, A })
}

/**
 * Y LA RECUPERACIÓN DE CONTRASEÑA, QUE ES LO QUE OBLIGABA A HACERLO ENTERO.
 *
 * «He olvidado mi contraseña» lo hacía Supabase, mandando el correo a la
 * dirección de la cuenta. Con la cuenta llamándose por hermandad + DNI, esa
 * dirección NO RECIBE NADA: si se hubiera hecho el cambio sin esto, cada
 * hermano nuevo se habría quedado sin poder recuperar su acceso. Eso es meter
 * un fallo, no quitarlo.
 *
 * Ahora el enlace lo manda la función `enviar-correo` al correo DE VERDAD de su
 * ficha. Ni el token ni la dirección pasan por el navegador de nadie.
 */
async function laRecuperacionDeContrasena({ sql, caso, A }) {
  const CUENTA = "'c1c1c1c1-0000-0000-0000-0000000000c1'"
  await sql(`
    insert into auth.users (id, email) values (${CUENTA}, 'da igual') on conflict (id) do nothing;
    update hermanos set auth_user_id = ${CUENTA} where dni = '11223344C' and hermandad_id = ${A};
    delete from recuperaciones_hermano;
  `)

  // Se pide, y sale el correo DE SU FICHA, no el nombre interno de la cuenta.
  caso('la recuperación va al correo de su ficha', 'manuel@gmail.com',
    (await sql(`select pedir_recuperacion_hermano(${A}, '11.223.344-C') ->> 'email'`)).trim())

  // Y el token vale, una vez.
  await sql('delete from recuperaciones_hermano')
  const canje = await sql(`
    with p as (select pedir_recuperacion_hermano(${A}, '11223344C') as j)
    select coalesce(canjear_recuperacion_hermano(j ->> 'token')::text, 'NADA') from p
  `)
  caso('el token abre la cuenta que toca', true, /c1c1c1c1/.test(canje))

  /*
   * --- Y LO QUE NO PUEDE PASAR ---
   *
   * El token es lo único que hace falta para ponerle otra contraseña a esa
   * cuenta. Así que tiene que valer UNA VEZ, caducar, y no poder pedirlo nadie
   * desde fuera.
   */
  await sql('delete from recuperaciones_hermano')
  const dosVeces = await sql(`
    with p as (select pedir_recuperacion_hermano(${A}, '11223344C') as j)
    select coalesce(canjear_recuperacion_hermano(j ->> 'token')::text, 'nada')
        || ' | ' || coalesce(canjear_recuperacion_hermano(j ->> 'token')::text, 'NADA') from p
  `)
  caso('y solo una vez', true, /\| NADA/.test(dosVeces))

  /*
   * CADUCADO. Se guarda el token, se envejece la fila y se intenta canjear: es
   * la única forma de comprobarlo, porque la tabla guarda la HUELLA del token y
   * no el token — a propósito, para que quien pudiera leerla no tuviera con eso
   * la llave de la cuenta de nadie.
   */
  await sql('delete from recuperaciones_hermano')
  const viejo = (await sql(
    `select pedir_recuperacion_hermano(${A}, '11223344C') ->> 'token'`)).trim()
  await sql("update recuperaciones_hermano set caduca_en = now() - interval '1 minute'")
  caso('uno caducado no abre nada', '',
    (await sql(`select coalesce(canjear_recuperacion_hermano('${viejo}')::text, '')`)).trim())
  caso('y uno inventado tampoco', '',
    (await sql("select coalesce(canjear_recuperacion_hermano('deadbeef')::text, '')")).trim())

  // Un freno, para que pedirla mil veces con el DNI de otro no le llene la
  // bandeja a esa persona, y encima firmado por la hermandad.
  await sql('delete from recuperaciones_hermano')
  await sql(`select pedir_recuperacion_hermano(${A}, '11223344C')`)
  caso('no se puede pedir dos veces seguidas', '',
    (await sql(`select coalesce(pedir_recuperacion_hermano(${A}, '11223344C')::text, '')`)).trim())

  // Y ni pedirla ni canjearla se le dan a quien entra sin identificarse: sería
  // regalar la llave de la cuenta de cualquiera con solo saber su DNI.
  caso('anon no puede pedir una recuperación', 'f',
    (await sql("select has_function_privilege('anon', 'pedir_recuperacion_hermano(uuid,text)', 'execute')")).trim())
  caso('ni canjearla', 'f',
    (await sql("select has_function_privilege('anon', 'canjear_recuperacion_hermano(text)', 'execute')")).trim())
}

/**
 * CADA CARGO ESCRIBE EN LO SUYO, Y EN NADA MÁS. EJECUTADO.
 *
 * La tabla `permisos_cargo` dice qué módulos lleva cada cargo. Que eso se
 * cumpla de verdad depende de que cada política de cada tabla pregunte por el
 * módulo correcto, y son muchas políticas repartidas por muchos ficheros. Ya
 * falló una vez sin que nadie lo notara: la web pública decía «no es un
 * hermano» y se olvidaba de pedir el módulo, así que el diputado de tramo podía
 * reescribir la portada que ve el barrio entero.
 *
 * Esto no lee las políticas: monta la junta completa, se hace pasar por cada
 * cargo y escribe. Un `no` donde debería haber un `sí` es la secretaria viendo
 * el visto bueno verde mientras la base rechaza; un `sí` donde debería haber un
 * `no` es alguien tocando lo que no le toca.
 *
 * Se prueba una tabla por módulo, la que de verdad guarda el trabajo de ese
 * módulo — no todas: con una por módulo, si la política se despega se ve igual.
 */
async function cadaCargoEnLoSuyo({ sql, caso }) {
  const HD = "'e0000000-0000-0000-0000-00000000000e'"
  /*
   * Tabla → los módulos que dan derecho a escribir en ella.
   *
   * Casi todas son de un módulo, pero `papeletas` NO, y es a propósito: la
   * papeleta la emite Papeletas y también la toca Cortejo, porque asignar a
   * alguien un tramo es escribir su papeleta. Su política dice
   * «modulo_permitido('papeletas') OR modulo_permitido('cortejo')».
   *
   * Está escrito como lista y no como un módulo suelto justamente por esto:
   * con un módulo por tabla, esta prueba daba en rojo al Mayordomo —que lleva
   * el cortejo y no las papeletas— por hacer exactamente lo que tiene que
   * hacer. El que estaba mal era el modelo de la prueba, no el permiso.
   */
  const DONDE_ESCRIBE = {
    hermanos: ['hermanos'],
    cuotas: ['cuotas'],
    papeletas: ['papeletas', 'cortejo'],
    movimientos: ['tesoreria'],
    enseres: ['inventario'],
    documentos: ['archivo'],
    eventos: ['eventos'],
    comunicados: ['comunicados'],
  }
  const CARGOS = [
    'Hermano Mayor', 'Secretario/a', 'Tesorero/a',
    'Mayordomo/Prioste', 'Diputado/a Mayor de Gobierno', 'Fiscal', 'Vocal',
  ]

  // Una hermandad aparte, con su junta y una fila en cada tabla: sin fila que
  // tocar, un UPDATE devuelve cero pase lo que pase, y la prueba diría que no
  // tiene permiso quien sí lo tiene.
  await sql(`
    delete from hermandades where id = ${HD};
    insert into hermandades (id, nombre) values (${HD}, 'Hermandad de los cargos');
    select sembrar_permisos_de_fabrica(${HD});
    insert into hermanos (id, hermandad_id, nombre, dni, numero)
      values (gen_random_uuid(), ${HD}, 'Un hermano', '10000001A', 1);
    insert into cuotas (hermandad_id, hermano_id, numero, concepto, importe, estado, ejercicio)
      select ${HD}, id, 9501, 'Cuota anual', 60, 'Pendiente', 2097 from hermanos where hermandad_id = ${HD};
    insert into papeletas (hermandad_id, hermano_id, numero, anio, importe, estado)
      select ${HD}, id, 9501, 2097, 18, 'Asignada' from hermanos where hermandad_id = ${HD};
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado)
      values (${HD}, 9501, '01 ene 2097', 'Donativo', 'Donativos', 'Ingreso', 100, 'Caja', 'Pendiente');
    insert into enseres (hermandad_id, numero, nombre, categoria, ubicacion)
      values (${HD}, 9501, 'Candelabro', 'Orfebrería', 'Almacén');
    insert into documentos (hermandad_id, numero, nombre, categoria)
      values (${HD}, 9501, 'Acta de cabildo', 'Acta');
    insert into eventos (hermandad_id, titulo, fecha, tipo)
      values (${HD}, 'Cabildo general', '2097-03-01', 'Cabildo');
    insert into comunicados (hermandad_id, numero, titulo, cuerpo, destinatarios, estado)
      values (${HD}, 9501, 'Convocatoria', 'Texto', 'Todos', 'Borrador');
  `)

  for (const [i, cargo] of CARGOS.entries()) {
    const cuenta = `'f000000${i}-0000-0000-0000-00000000000f'`
    await sql(`
      delete from personal where auth_user_id = ${cuenta};
      delete from auth.users where id = ${cuenta};
      insert into auth.users (id, email) values (${cuenta}, 'cargo${i}@prueba.es');
      insert into personal (id, nombre, email, cargo, activo, auth_user_id, hermandad_id)
        values (gen_random_uuid(), 'Cargo ${i}', 'cargo${i}@prueba.es', '${cargo}', true, ${cuenta}, ${HD});
    `)
    const modulos = (await sql(`
      select string_agg(modulo_id, ',' order by modulo_id)
        from permisos_cargo where hermandad_id = ${HD} and cargo = '${cargo}';
    `)).trim().split(',')

    for (const [tabla, suyos] of Object.entries(DONDE_ESCRIBE)) {
      const deberia = suyos.some((m) => modulos.includes(m))
      const salida = await sql(`
        begin;
        set local role authenticated;
        set local request.jwt.claim.sub = ${cuenta};
        with tocadas as (
          update ${tabla} set hermandad_id = hermandad_id where hermandad_id = ${HD} returning 1
        ) select count(*) from tocadas;
        rollback;
      `)
      const escribe = !/(^|\s)0(\s|$)/m.test(salida)
      caso(`${cargo} ${deberia ? 'escribe' : 'NO escribe'} en ${tabla}`, deberia, escribe)
    }
  }
  /*
   * Y LA HERMANDAD SE PUEDE BORRAR, que no se podía.
   *
   * `delete from hermandades` fallaba entero: la cascada va bajando su censo,
   * sus cuotas y sus papeletas, cada baja dispara el registro de «quién hizo
   * qué», y ese disparador intentaba escribir una fila CON EL ID DE LA
   * HERMANDAD que acababa de desaparecer. La clave ajena lo rechazaba y el
   * borrado se caía con un error de clave ajena que no explicaba nada.
   *
   * Muerde justo donde más molesta: `BORRAR-PRUEBAS.sql` es el archivo que se
   * ejecuta para quitar las hermandades de prueba cuando entra la primera de
   * verdad. Se lanzaba, daba error, y las de prueba seguían ahí.
   *
   * Se comprueba aquí, al final, porque este bloque termina borrando su propia
   * hermandad: la limpieza ES la prueba.
   */
  /*
   * EL DOCUMENTO «RESTRINGIDO» LO ENTREGABA LA BASE A CUALQUIERA.
   *
   * El Archivo deja marcar un documento como restringido y elegir a qué
   * cargos: «Expediente disciplinario — visible solo para Hermano Mayor y
   * Fiscal». La pantalla lo respetaba; la política de lectura de la base solo
   * pedía el módulo de archivo, así que cualquiera de los tres cargos que lo
   * llevan se descargaba TODOS los documentos con su nombre y su descripción.
   *
   * Y no hacía falta abrir la consola: el panel carga la tabla entera para
   * pintarla, así que los restringidos ya estaban en la página y en la copia
   * del navegador.
   *
   * Lo que esconde la pantalla no protege nada. Otra vez.
   */
  await sql(`
    insert into documentos (hermandad_id, numero, nombre, categoria, cargos_con_acceso) values
      (${HD}, 9701, 'Expediente reservado', 'Expediente', array['Hermano Mayor', 'Fiscal']),
      (${HD}, 9702, 'Informe solo del Hermano Mayor', 'Expediente', array['Hermano Mayor']),
      (${HD}, 9703, 'Reglas de la hermandad', 'Regla', null);
  `)
  const comoCargo = (i, consulta) => sql(`
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = 'f000000${i}-0000-0000-0000-00000000000f';
    ${consulta}
    rollback;
  `)
  // 0 = Hermano Mayor, 1 = Secretario/a, 5 = Fiscal (el orden de CARGOS arriba).
  // La cifra sola: `sql()` devuelve también los BEGIN/SET/ROLLBACK de psql, y
  // comparar contra todo eso es comparar contra el ruido.
  const cuantosVe = async (i) => {
    const salida = await comoCargo(i,
      `select count(*) from documentos where hermandad_id = ${HD} and numero in (9701, 9702, 9703);`)
    return salida.split('\n').map((l) => l.trim()).filter((l) => /^\d+$/.test(l)).pop() ?? ''
  }
  caso('el Hermano Mayor ve los tres', '3', await cuantosVe(0))
  caso('el Fiscal ve el suyo y el institucional', '2', await cuantosVe(5))
  caso('y la Secretaria, que no está en ninguna lista, solo el institucional', '1', await cuantosVe(1))

  /*
   * Y no basta con no verlo: quien no lo ve tampoco puede BORRARLO ni quitarle
   * la restricción para leerlo después. Sin esto la restricción es de mentira.
   */
  const borraElRestringido = await comoCargo(1, `
    with x as (delete from documentos where numero = 9701 returning 1) select count(*) from x;
  `)
  caso('la Secretaria no puede borrar el restringido', true, /(^|\s)0(\s|$)/m.test(borraElRestringido))
  const loLibera = await comoCargo(1, `
    with x as (update documentos set cargos_con_acceso = null where numero = 9701 returning 1) select count(*) from x;
  `)
  caso('ni quitarle la restricción', true, /(^|\s)0(\s|$)/m.test(loLibera))

  /*
   * Y EL PDF, QUE ES LO QUE DE VERDAD NO PUEDE SALIR.
   *
   * Todo lo de arriba tapa LA FICHA. El expediente no es la ficha: es el PDF
   * escaneado que cuelga de ella, y ese vivía en el almacén con otra política
   * que solo separaba una hermandad de otra. Dentro de la hermandad no
   * distinguía: la Secretaria no veía la fila del expediente y aun así se
   * descargaba su PDF.
   *
   * Y era fácil, no había que adivinar nada: el fichero se llama como el id
   * del documento, así que listando la carpeta —la misma llamada que hace
   * `lib/filestore.ts`— salía la lista entera y se bajaba uno por uno.
   *
   * Se comprueba con el almacén de verdad, porque es donde estaba el agujero:
   * mirar solo la tabla `documentos` es justo lo que dejó pasar esto.
   */
  const idDe = async (numero) => (await sql(
    `select id from documentos where hermandad_id = ${HD} and numero = ${numero}`,
  )).split('\n').map((l) => l.trim()).find((l) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(l)) ?? ''
  const idReservado = await idDe(9702)   // solo Hermano Mayor
  const idInstitucional = await idDe(9703) // sin restringir
  await sql(`
    insert into storage.objects (bucket_id, name) values
      ('documentos', ${HD} || '/' || '${idReservado}'),
      ('documentos', ${HD} || '/' || '${idInstitucional}');
  `)
  const alcanza = async (i, id) => (await comoCargo(i,
    `select count(*) from storage.objects where name like '%${id}';`,
  )).split('\n').map((l) => l.trim()).filter((l) => /^\d+$/.test(l)).pop() ?? ''

  caso('el Hermano Mayor sí se descarga el PDF de su informe reservado', '1',
    await alcanza(0, idReservado))
  caso('pero la Secretaria NO se descarga ese PDF', '0', await alcanza(1, idReservado))
  // Y no se ha cerrado de más: el documento institucional lo sigue abriendo.
  caso('y el PDF institucional lo abre igual', '1', await alcanza(1, idInstitucional))
  // Listar la carpeta es de donde salían los identificadores.
  const alListar = async (i) => (await comoCargo(i,
    `select count(*) from storage.objects where bucket_id = 'documentos';`,
  )).split('\n').map((l) => l.trim()).filter((l) => /^\d+$/.test(l)).pop() ?? ''
  caso('al listar la carpeta, el Hermano Mayor ve los dos ficheros', '2', await alListar(0))
  caso('y la Secretaria solo el que puede abrir', '1', await alListar(1))

  /*
   * Y SUBIR UN ADJUNTO TIENE QUE SEGUIR FUNCIONANDO. El fichero se sube ANTES
   * de crear la ficha (así lo hace `Archivo.tsx`), así que en ese momento no
   * hay ficha que consultar: si la comprobación se hubiera puesto también al
   * escribir, no se podría adjuntar nada. Esta es la mitad que un arreglo
   * apresurado rompe sin enterarse.
   */
  const sube = async (i, carpeta) => {
    try {
      await comoCargo(i,
        `insert into storage.objects (bucket_id, name) values ('documentos', '${carpeta}' || '/' || gen_random_uuid()::text);`)
      return 'sí'
    } catch { return 'no' }
  }
  caso('la Secretaria puede subir un adjunto nuevo', 'sí', await sube(1, HD.slice(1, -1)))
  caso('y no puede colarlo en la carpeta de otra hermandad', 'no',
    await sube(1, '99999999-9999-9999-9999-999999999999'))
  await sql(`delete from storage.objects where bucket_id = 'documentos';`)

  let borrada = ''
  try {
    await sql(`delete from hermandades where id = ${HD};`)
    borrada = 'se borra'
  } catch (e) {
    borrada = `NO se borra: ${String(e.stderr ?? e.message).split('\n').find((l) => /ERROR/.test(l)) ?? ''}`
  }
  caso('una hermandad se puede borrar', 'se borra', borrada)
  caso('y no deja nada detrás', '0|0|0',
    (await sql(`
      select (select count(*) from hermandades where id = ${HD})
        || '|' || (select count(*) from hermanos where hermandad_id = ${HD})
        || '|' || (select count(*) from registro_actividad where hermandad_id = ${HD});
    `)).trim())
}

/**
 * EL WEBHOOK DE STRIPE, DE VERDAD: solo `service_role` activa, y con la
 * hermandad correcta.
 *
 * `activar_suscripcion_por_usuario` es la función que llamaría el webhook
 * cuando Stripe avisa de un cobro confirmado. Estaba revocada de todo el
 * mundo —ni siquiera `service_role`, que es con la que habla el servidor,
 * podía llamarla— y aquí se comprueba lo contrario de lo que se venía a
 * arreglar: que YA NO lo esté, que siga sin poder llamarla nadie más, y que
 * resuelva la hermandad correcta a partir de quién pagó.
 */
async function elWebhookDeStripeActivaLaSuscripcion({ sql, caso }) {
  const H = "'d0000000-0000-0000-0000-00000000000d'"
  const TITULAR = "'d1111111-1111-1111-1111-111111111111'"
  const HUERFANO = "'d2222222-2222-2222-2222-222222222222'"

  await sql(`
    insert into hermandades (id, nombre) values (${H}, 'Hdad. del Webhook') on conflict (id) do nothing;
    insert into auth.users (id, email) values (${TITULAR}, 'titular@ejemplo.es') on conflict (id) do nothing;
    insert into titulares (auth_user_id, hermandad_id) values (${TITULAR}, ${H})
      on conflict (auth_user_id) do update set hermandad_id = excluded.hermandad_id;
  `)

  // 1. `service_role` llama con el usuario que pagó, y activa SU hermandad.
  await sql(`
    begin;
      set local role service_role;
      select activar_suscripcion_por_usuario(${TITULAR}, 'todo', 'mensual', 'cus_123', 'sub_123');
    commit;
  `)
  const primeraActivacion = (await sql(
    `select activa || '|' || pack || '|' || stripe_customer_id || '|' || stripe_subscription_id
       from suscripciones where hermandad_id = ${H}`,
  )).trim()
  caso('Stripe activa la suscripción de la hermandad que pagó', 'true|todo|cus_123|sub_123', primeraActivacion)

  /*
   * 2. Un alta a mano desde el editor SQL (`activar_suscripcion` de cuatro
   * parámetros, sin referencia de Stripe) NO BORRA la referencia que ya
   * había. Es justo lo que arregla el `coalesce` del fichero: sin él, cada
   * alta manual habría dejado la suscripción sin saber a qué cliente de
   * Stripe pertenece.
   */
  await sql(`
    begin;
      set local role service_role;
      select activar_suscripcion(${H}, 'basico', 'anual', '2027-06-01'::date);
    commit;
  `)
  const trasAltaManual = (await sql(
    `select pack || '|' || periodo || '|' || stripe_customer_id || '|' || stripe_subscription_id
       from suscripciones where hermandad_id = ${H}`,
  )).trim()
  caso('y el alta a mano no borra la referencia de Stripe que ya había',
    'basico|anual|cus_123|sub_123', trasAltaManual)

  // 3. Nadie más puede llamarla: ni una sesión de hermano, ni una anónima.
  const comoAlgoQueNoEsServiceRole = async (rol, sentencia) => {
    try {
      await sql(`
        begin;
          set local role ${rol};
          ${sentencia}
        rollback;
      `)
      return { deja: 'sí', motivo: '' }
    } catch (e) {
      return { deja: 'no', motivo: String(e?.stderr ?? e) }
    }
  }
  const porAuthenticated = await comoAlgoQueNoEsServiceRole(
    'authenticated',
    `select activar_suscripcion_por_usuario(${TITULAR}, 'todo', 'mensual', 'x', 'y');`,
  )
  caso('una sesión autenticada no puede activar suscripciones', 'no', porAuthenticated.deja)
  caso('y falla por permiso, no por otra cosa', true,
    /permission denied for function activar_suscripcion_por_usuario/.test(porAuthenticated.motivo))
  caso('tampoco una sesión anónima', 'no',
    (await comoAlgoQueNoEsServiceRole(
      'anon', `select activar_suscripcion_por_usuario(${TITULAR}, 'todo', 'mensual', 'x', 'y');`,
    )).deja)

  // 4. Si Stripe confirma un cobro de alguien sin hermandad, no se calla.
  const sinHermandad = await comoAlgoQueNoEsServiceRole(
    'service_role',
    `select activar_suscripcion_por_usuario(${HUERFANO}, 'todo', 'mensual', 'x', 'y');`,
  )
  caso('un usuario sin hermandad no activa nada en silencio', 'no', sinHermandad.deja)
  caso('y el aviso dice que no se ha encontrado la hermandad', true,
    /No se ha encontrado ninguna hermandad/.test(sinHermandad.motivo))

  // 5. Y cuando Stripe avisa de una baja, se desactiva por el id de Stripe.
  await sql(`
    begin;
      set local role service_role;
      select cancelar_suscripcion_por_stripe('sub_123');
    commit;
  `)
  caso('y una baja de Stripe desactiva la suscripción', 'f',
    (await sql(`select activa from suscripciones where hermandad_id = ${H}`)).trim())
  caso('ni el propio hermano puede cancelar una suscripción', 'no',
    (await comoAlgoQueNoEsServiceRole('authenticated', `select cancelar_suscripcion_por_stripe('sub_123');`)).deja)
}

/**
 * EL MANDATO SEPA, FIRMADO DE VERDAD Y SOLO POR QUIEN TOCA.
 *
 * Aquí se comprueba lo que dice el propio fichero en sus comentarios: que
 * solo el titular de la cuenta firma la suya, que tesorería puede revocar
 * pero no fabricar ni reescribir una firma, y que sin IBAN en la ficha no hay
 * mandato que firmar.
 */
async function elMandatoSepaLoFirmaElPropioHermano({ sql, caso }) {
  const H = "'c0000000-0000-0000-0000-00000000000c'"
  const HNO1 = "'c1111111-1111-1111-1111-111111111111'" // con IBAN
  const HNO2 = "'c2222222-2222-2222-2222-222222222222'" // sin IBAN
  const UID1 = "'c3333333-3333-3333-3333-333333333333'"
  const UID2 = "'c4444444-4444-4444-4444-444444444444'"
  const STAFF = "'c5555555-5555-5555-5555-555555555555'"
  const IBAN = 'ES1234567890123456789012'

  await sql(`
    insert into hermandades (id, nombre) values (${H}, 'Hdad. del Mandato') on conflict (id) do nothing;
    insert into auth.users (id, email) values
      (${UID1}, 'hno1@ejemplo.es'), (${UID2}, 'hno2@ejemplo.es'), (${STAFF}, 'staff@ejemplo.es')
      on conflict (id) do nothing;
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id, iban) values
      (${HNO1}, ${H}, 'Con Iban', '90000001A', 601, 'Activo', ${UID1}, '${IBAN}'),
      (${HNO2}, ${H}, 'Sin Iban', '90000002B', 602, 'Activo', ${UID2}, null)
      on conflict (id) do nothing;
    -- Titular: es la vía más corta para dar acceso de tesorería en la prueba,
    -- y es justo el mismo camino que usa «modulo_permitido()» de verdad.
    insert into titulares (auth_user_id, hermandad_id) values (${STAFF}, ${H})
      on conflict (auth_user_id) do update set hermandad_id = excluded.hermandad_id;
  `)

  const como = async (uid, sentencia) => {
    try {
      await sql(`
        begin;
          set local role authenticated;
          set local "request.jwt.claim.sub" = '${uid}';
          ${sentencia}
        commit;
      `)
      return { deja: 'sí', motivo: '' }
    } catch (e) {
      return { deja: 'no', motivo: String(e?.stderr ?? e) }
    }
  }
  // Igual que `como`, pero deshace: para probar sin dejar la fila escrita.
  const comoSinGuardar = async (uid, sentencia) => {
    try {
      await sql(`
        begin;
          set local role authenticated;
          set local "request.jwt.claim.sub" = '${uid}';
          ${sentencia}
        rollback;
      `)
      return { deja: 'sí', motivo: '' }
    } catch (e) {
      return { deja: 'no', motivo: String(e?.stderr ?? e) }
    }
  }

  // 1. El hermano firma la suya, y la base rellena TODO lo demás.
  const firma = await como(UID1.slice(1, -1),
    `insert into mandatos_sepa (hermano_id, iban, referencia) values (${HNO1}, 'lo que sea', 'lo que sea');`)
  caso('el hermano firma su propia domiciliación', 'sí', firma.deja)
  const fila = (await sql(
    // La referencia sale del propio id de la fila (ver comentario del disparador
    // en «mandatos-sepa.sql»), no del hermano: se comprueba contra ESE id, no
    // contra uno inventado a mano.
    `select iban || '|' || (referencia = 'MND' || replace(id::text, '-', '')) || '|' || (revocado_en is null)
       from mandatos_sepa where hermano_id = ${HNO1}`,
  )).trim()
  caso('con SU IBAN, una referencia que sale de su propio id y sin revocar', `${IBAN}|true|true`, fila)

  // 2. No puede firmar la de otro.
  const firmaAjena = await comoSinGuardar(UID1.slice(1, -1),
    `insert into mandatos_sepa (hermano_id, iban, referencia) values (${HNO2}, 'x', 'x');`)
  caso('no puede firmar la domiciliación de otro hermano', 'no', firmaAjena.deja)

  // 3. Sin IBAN en la ficha, no hay nada que firmar.
  const sinIban = await comoSinGuardar(UID2.slice(1, -1),
    `insert into mandatos_sepa (hermano_id, iban, referencia) values (${HNO2}, 'x', 'x');`)
  caso('sin IBAN en la ficha no se puede firmar', 'no', sinIban.deja)
  caso('y lo dice, no se calla', true,
    /no tiene ninguna cuenta bancaria/.test(sinIban.motivo))

  // 4. Tesorería no puede fabricar una firma a nombre de nadie.
  const staffFirma = await comoSinGuardar(STAFF.slice(1, -1),
    `insert into mandatos_sepa (hermano_id, iban, referencia) values (${HNO1}, 'x', 'x');`)
  caso('tesorería no puede fabricar una firma', 'no', staffFirma.deja)

  // 5. Tesorería SÍ puede revocar.
  const revoca = await como(STAFF.slice(1, -1),
    `update mandatos_sepa set revocado_en = now() where hermano_id = ${HNO1};`)
  caso('tesorería puede revocar el mandato', 'sí', revoca.deja)
  caso('y queda revocado', 'f',
    (await sql(`select (revocado_en is null) from mandatos_sepa where hermano_id = ${HNO1}`)).trim())

  // 6. Pero no puede «desrevocarlo» después.
  await como(STAFF.slice(1, -1), `update mandatos_sepa set revocado_en = null where hermano_id = ${HNO1};`)
  caso('un mandato revocado no se puede reactivar', 'f',
    (await sql(`select (revocado_en is null) from mandatos_sepa where hermano_id = ${HNO1}`)).trim())

  // 7. Ni cambiarle el IBAN o el texto a lo firmado.
  await como(STAFF.slice(1, -1),
    `update mandatos_sepa set iban = 'ES000000000000000000', texto_aceptado = 'otra cosa'
       where hermano_id = ${HNO1};`)
  caso('ni el IBAN ni el texto de una firma se pueden reescribir', `${IBAN}|Autorizo`,
    (await sql(
      `select iban || '|' || left(texto_aceptado, 8) from mandatos_sepa where hermano_id = ${HNO1}`,
    )).trim())

  /*
   * 8. Y el propio hermano no puede revocarse ni tocarse su mandato: solo
   * tesorería. Aquí NO se puede mirar si lanza una excepción: sin una
   * política de UPDATE que le cumpla, Postgres no da error — simplemente
   * actualiza CERO filas y contesta que ha ido bien, igual que pasaba con el
   * `upsert` de `elHermanoCambiaSuFicha`. Hay que mirar cuántas filas tocó.
   */
  const filasQueToca = await sql(`
    begin;
      set local role authenticated;
      set local "request.jwt.claim.sub" = '${UID1.slice(1, -1)}';
      with x as (update mandatos_sepa set revocado_en = now() where hermano_id = ${HNO1} returning 1)
        select count(*) from x;
    rollback;
  `)
  const numero = (l) => l.split('\n').map((s) => s.trim()).filter((s) => /^\d+$/.test(s)).pop() ?? ''
  caso('el hermano no puede tocar su propio mandato una vez firmado', '0', numero(filasQueToca))

  // 9. Ahora se le apunta un IBAN al segundo hermano y firma el suyo también,
  // para comprobar el aislamiento con DOS mandatos firmados en la hermandad.
  await sql(`update hermanos set iban = 'ES9876543210987654321098' where id = ${HNO2};`)
  const firmaHno2 = await como(UID2.slice(1, -1),
    `insert into mandatos_sepa (hermano_id, iban, referencia) values (${HNO2}, 'x', 'x');`)
  caso('con el IBAN ya puesto, el segundo hermano sí puede firmar el suyo', 'sí', firmaHno2.deja)

  const loQueVeHno1 = await sql(`
    begin;
      set local role authenticated;
      set local "request.jwt.claim.sub" = '${UID1.slice(1, -1)}';
      select count(*) from mandatos_sepa;
    rollback;
  `)
  caso('cada hermano solo ve su propio mandato', '1', numero(loQueVeHno1))

  const loQueVeStaff = await sql(`
    begin;
      set local role authenticated;
      set local "request.jwt.claim.sub" = '${STAFF.slice(1, -1)}';
      select count(*) from mandatos_sepa where hermandad_id = ${H};
    rollback;
  `)
  caso('tesorería ve los dos mandatos de su hermandad', '2', numero(loQueVeStaff))

  /*
   * 10. UN HERMANO CON CARGO TAMBIÉN FIRMA LA SUYA.
   *
   * Este es el que se coló al escribir el disparador: comprobaba
   * `auth_es_hermano()`, que da FALSO en cuanto el hermano lleva cualquier
   * cargo —Fiscal, Vocal, diputado de tramo, no hace falta ser Tesorero/a—,
   * porque esa función contesta «¿esta cuenta gestiona?», no «¿de quién es
   * esta ficha?». Con eso puesto, un fiscal no podía firmar su propia
   * domiciliación: la base le decía «Solo el propio hermano puede firmar su
   * domiciliación», siendo él mismo el propio hermano.
   */
  const HNO3 = "'c6666666-6666-6666-6666-666666666666'"
  const UID3 = "'c7777777-7777-7777-7777-777777777777'"
  await sql(`
    insert into auth.users (id, email) values (${UID3}, 'fiscal@ejemplo.es') on conflict (id) do nothing;
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id, iban, cargo, email) values
      (${HNO3}, ${H}, 'Con Cargo', '90000003C', 603, 'Activo', ${UID3}, '${IBAN}', 'Fiscal', 'fiscal@ejemplo.es')
      on conflict (id) do nothing;
  `)
  const firmaConCargo = await como(UID3.slice(1, -1),
    `insert into mandatos_sepa (hermano_id, iban, referencia) values (${HNO3}, 'x', 'x');`)
  caso('un hermano con cargo (Fiscal) también firma la suya', 'sí', firmaConCargo.deja)
}

/**
 * ENCARGAR UN POST: QUIÉN REPARTE Y QUIÉN PUEDE DECIR «HECHO».
 *
 * Lo que hay que sujetar aquí es el desnivel entre los dos permisos: quien
 * lleva redes reparte y corrige; el responsable SOLO puede dar la suya por
 * hecha. Si eso se afloja, cualquiera de la junta puede quitarse un encargo de
 * encima pasándoselo a otro, o cambiarle el texto al post después de que se
 * haya publicado.
 */
async function elEncargoDeRedesSeReparte({ sql, caso }) {
  const H = "'e0000000-0000-0000-0000-00000000000e'"
  const JEFE = "'e1111111-1111-1111-1111-111111111111'"   // lleva comunicados
  const VOCAL = "'e2222222-2222-2222-2222-222222222222'"  // hermano con cargo, responsable
  const OTRO = "'e3333333-3333-3333-3333-333333333333'"   // otro hermano cualquiera
  const UJEFE = "'e4444444-4444-4444-4444-444444444444'"
  const UVOCAL = "'e5555555-5555-5555-5555-555555555555'"
  const UOTRO = "'e6666666-6666-6666-6666-666666666666'"

  await sql(`
    insert into hermandades (id, nombre) values (${H}, 'Hdad. de las Redes') on conflict (id) do nothing;
    insert into auth.users (id, email) values
      (${UJEFE}, 'jefe@e.es'), (${UVOCAL}, 'vocal@e.es'), (${UOTRO}, 'otro@e.es')
      on conflict (id) do nothing;
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id, email, cargo) values
      (${JEFE}, ${H}, 'Quien lleva redes', '80000001A', 701, 'Activo', ${UJEFE}, 'jefe@e.es', 'Hermano Mayor'),
      (${VOCAL}, ${H}, 'Vocal de juventud', '80000002B', 702, 'Activo', ${UVOCAL}, 'vocal@e.es', 'Fiscal'),
      (${OTRO}, ${H}, 'Hermano de a pie', '80000003C', 703, 'Activo', ${UOTRO}, 'otro@e.es', null)
      on conflict (id) do nothing;
    select sembrar_permisos_de_fabrica(${H});
  `)
  const como = async (uid, sentencia) => {
    try {
      await sql(`begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sentencia} commit;`)
      return { deja: 'sí', motivo: '' }
    } catch (e) { return { deja: 'no', motivo: String(e?.stderr ?? e) } }
  }
  const numero = (t) => t.split('\n').map((s) => s.trim()).filter((s) => /^\d+$/.test(s)).pop() ?? ''

  // 1. Quien lleva redes encarga y reparte.
  const ENCARGO = "'e7777777-7777-7777-7777-777777777777'"
  const TAREA = "'e8888888-8888-8888-8888-888888888888'"
  const encarga = await como(UJEFE.slice(1, -1), `
    insert into tareas_redes (id, encargo_id, titulo, texto, que, red, hermano_id)
      values (${TAREA}, ${ENCARGO}, 'Besamanos', 'Este sábado', 'publicar', 'Instagram', ${VOCAL});
  `)
  caso('quien lleva redes puede encargar un post', 'sí', encarga.deja)

  /*
   * 2. Y UN HERMANO DE A PIE NO. No es que no le salga el botón: es que la
   * base no le deja, que es lo único que cuenta.
   */
  const colado = await como(UOTRO.slice(1, -1), `
    insert into tareas_redes (encargo_id, titulo, que, red, hermano_id)
      values (gen_random_uuid(), 'Colado', 'publicar', 'Instagram', ${OTRO});
  `)
  caso('un hermano de a pie no puede repartirse trabajo', 'no', colado.deja)

  // 3. El responsable la ve, aunque no lleve redes.
  caso('el responsable ve la suya', '1', numero(await sql(`
    begin; set local role authenticated; set local "request.jwt.claim.sub" = '${UVOCAL.slice(1, -1)}';
    select count(*) from tareas_redes where id = ${TAREA}; rollback;`)))
  // Y quien no tiene nada que ver, no.
  caso('y quien no tiene nada que ver, no la ve', '0', numero(await sql(`
    begin; set local role authenticated; set local "request.jwt.claim.sub" = '${UOTRO.slice(1, -1)}';
    select count(*) from tareas_redes where id = ${TAREA}; rollback;`)))

  // 4. El responsable la da por hecha, y la fecha la pone la base.
  const cierra = await como(UVOCAL.slice(1, -1), `update tareas_redes set estado = 'hecha' where id = ${TAREA};`)
  caso('el responsable puede darla por hecha', 'sí', cierra.deja)
  caso('y la base apunta cuándo, sin que nadie se la invente', '1',
    numero(await sql(`select count(*) from tareas_redes where id = ${TAREA} and hecha_en is not null`)))
  caso('y quién la hizo', '1',
    numero(await sql(`select count(*) from tareas_redes where id = ${TAREA} and hecha_por = ${VOCAL}`)))

  /*
   * 5. PERO NADA MÁS. Ni pasársela a otro para quitársela de encima, ni
   * cambiarle el texto al post después de publicado. Se intenta y se comprueba
   * que la fila NO se ha movido — porque estas dos las deja pasar el disparador
   * en silencio (devuelve la fila como estaba) en vez de dar un error, que es
   * lo correcto: no hay nada que avisar, simplemente no es suyo.
   */
  await como(UVOCAL.slice(1, -1), `update tareas_redes set hermano_id = ${OTRO} where id = ${TAREA};`)
  caso('el responsable NO puede pasársela a otro', '1',
    numero(await sql(`select count(*) from tareas_redes where id = ${TAREA} and hermano_id = ${VOCAL}`)))
  await como(UVOCAL.slice(1, -1), `update tareas_redes set titulo = 'Otra cosa', texto = 'Cambiado' where id = ${TAREA};`)
  caso('ni cambiarle el texto al post', '1',
    numero(await sql(`select count(*) from tareas_redes where id = ${TAREA} and titulo = 'Besamanos'`)))

  // 6. Quien lleva redes sí puede reasignarla: para eso la reparte él.
  await como(UJEFE.slice(1, -1), `update tareas_redes set hermano_id = ${OTRO} where id = ${TAREA};`)
  caso('quien lleva redes sí puede reasignarla', '1',
    numero(await sql(`select count(*) from tareas_redes where id = ${TAREA} and hermano_id = ${OTRO}`)))

  /*
   * 7. Y NO SE BORRA: un encargo hecho es lo que demuestra que se hizo.
   *
   * Se mira si la FILA SIGUE AHÍ, y no si dio error. Sin política de borrado,
   * Postgres no protesta: borra cero filas y contesta que todo ha ido bien
   * —es el mismo caso que el `upsert` de `elHermanoCambiaSuFicha`— así que
   * esperar una excepción daría por buena una prueba que no comprueba nada.
   */
  await como(UJEFE.slice(1, -1), `delete from tareas_redes where id = ${TAREA};`)
  caso('un encargo no se borra, ni siquiera quien lo repartió', '1',
    numero(await sql(`select count(*) from tareas_redes where id = ${TAREA}`)))

  /*
   * 8. UNA TAREA DE PUBLICAR TIENE QUE DECIR EN QUÉ RED. Sin esto se cuelan
   * tareas que no dicen qué hacer, y el responsable ve «Subilo a undefined».
   */
  const sinRed = await como(UJEFE.slice(1, -1), `
    insert into tareas_redes (encargo_id, titulo, que, hermano_id)
      values (gen_random_uuid(), 'Sin red', 'publicar', ${VOCAL});`)
  caso('una tarea de publicar sin red no entra', 'no', sinRed.deja)

  /*
   * 9. EL GUARDIÁN NO PUEDE ESTORBAR A LA PROPIA BASE.
   *
   * `hermano_id` es `on delete set null` y `hermandad_id` es `on delete
   * cascade`. Las dos cosas hacen que Postgres toque ESTA tabla cuando se
   * borra en OTRA — y esos toques pasaban por el guardián, con el permiso de
   * quien estuviera borrando. Dos fallos, los dos silenciosos hasta que
   * alguien lo intenta:
   *
   *   · Dar de baja a un hermano con un encargo abierto se caía con «Esta
   *     tarea no es tuya», que además manda a mirar al sitio equivocado. Le
   *     pasa a quien lleva el módulo «hermanos» pero no redes: el Diputado
   *     Mayor de Gobierno, sin ir más lejos.
   *   · Y borrar una hermandad con un solo encargo se caía con «Un encargo no
   *     se borra». Eso muerde en `BORRAR-PRUEBAS.sql`, que es el archivo que
   *     se ejecuta para quitar las de prueba cuando entra la primera de
   *     verdad. Es el mismo tropiezo que ya cuenta `borrar-una-hermandad.sql`,
   *     con otra tabla.
   */
  const DIP = "'ea000000-0000-0000-0000-0000000000aa'"
  const UDIP = "'e9999999-9999-9999-9999-999999999999'"
  const SEVA = "'ec000000-0000-0000-0000-0000000000cc'"
  const USEVA = "'eb000000-0000-0000-0000-0000000000bb'"
  await sql(`
    insert into auth.users (id, email) values (${UDIP}, 'dip@e.es'), (${USEVA}, 'seva@e.es')
      on conflict (id) do nothing;
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id, email, cargo) values
      (${DIP}, ${H}, 'Diputado Mayor', '80000009Z', 709, 'Activo', ${UDIP}, 'dip@e.es',
       'Diputado/a Mayor de Gobierno'),
      (${SEVA}, ${H}, 'Se va', '80000010Y', 710, 'Activo', ${USEVA}, 'seva@e.es', null)
      on conflict (id) do nothing;
  `)
  // El Diputado lleva «hermanos» pero NO redes: es el caso exacto.
  // `psql` cuela sus propias líneas (BEGIN, SET, ROLLBACK) en la salida: se
  // coge solo la que es un sí o un no.
  const siNo = (t) => t.split('\n').map((x) => x.trim()).filter((x) => x === 'true' || x === 'false').pop() ?? ''
  const comoDip = (q) => sql(`
    begin; set local role authenticated; set local "request.jwt.claim.sub" = ${UDIP};
      ${q} rollback;`).then(siNo)
  caso('el diputado lleva hermanos', 'true', await comoDip(`select modulo_permitido('hermanos')::text;`))
  caso('y no lleva redes', 'false',
    await comoDip(`select (modulo_permitido('comunicados') or modulo_permitido('web'))::text;`))

  await como(UJEFE.slice(1, -1), `
    insert into tareas_redes (encargo_id, titulo, que, red, hermano_id)
      values (gen_random_uuid(), 'El post del que se va', 'publicar', 'Instagram', ${SEVA});`)
  const baja = await como(UDIP.slice(1, -1), `delete from hermanos where id = ${SEVA};`)
  caso('se puede dar de baja a un hermano con un encargo abierto', 'sí', baja.deja)
  caso('y el hermano se ha ido de verdad', '0',
    numero(await sql(`select count(*) from hermanos where id = ${SEVA}`)))
  // La tarea NO se borra: se queda sin dueño, para que quien lleva redes la
  // vea huérfana y se la dé a otro en vez de que desaparezca sin más.
  caso('su encargo se queda sin repartir, no se pierde', '1',
    numero(await sql(`select count(*) from tareas_redes
      where titulo = 'El post del que se va' and hermano_id is null`)))

  /*
   * Y la hermandad entera. Se hace en una transacción que se deshace: si no,
   * se llevaría por delante el resto de comprobaciones de este archivo.
   */
  const fuera = await sql(`
    begin;
      delete from hermandades where id = ${H};
      select count(*) from tareas_redes where hermandad_id = ${H};
    rollback;`).then(() => 'sí').catch(() => 'no')
  caso('se puede borrar una hermandad que tiene encargos', 'sí', fuera)

  // Pero un encargo suelto sigue sin poder borrarse, que es la regla de fondo.
  await como(UJEFE.slice(1, -1), `delete from tareas_redes where titulo = 'El post del que se va';`)
  caso('y un encargo suelto sigue sin borrarse', '1',
    numero(await sql(`select count(*) from tareas_redes where titulo = 'El post del que se va'`)))
}


/**
 * LA TIENDA: VENDER, DESCONTAR Y CUADRAR.
 *
 * Lo que se prueba aquí es exactamente lo que NO se puede probar sin una base
 * de datos de verdad, porque solo falla cuando hay dos personas cobrando a la
 * vez o cuando alguien tiene la consola del navegador abierta:
 *
 *   · que el número de factura sea correlativo y sin huecos,
 *   · que no se pueda vender lo que no hay,
 *   · que un descuento de costaleros no se lo aplique quien no lo es,
 *   · que una venta deje SIEMPRE sus dos asientos en el libro,
 *   · que el aviso de «queda poco» salte al cruzar el mínimo y no en cada venta,
 *   · y que anular devuelva el género sin borrar la factura.
 */
async function laTiendaVendeYCuadra({ sql, caso }) {
  const H = "'c0000000-0000-0000-0000-0000000000c9'"
  const UJEFE = "'c1000000-0000-0000-0000-0000000000c9'"
  const JEFE = "'c2000000-0000-0000-0000-0000000000c9'"
  const UCOST = "'c4000000-0000-0000-0000-0000000000c9'"
  const COST = "'c5000000-0000-0000-0000-0000000000c9'"
  const PROD = "'c3000000-0000-0000-0000-0000000000c9'"
  const DESC = "'c6000000-0000-0000-0000-0000000000c9'"

  /*
   * El fixture se comprueba, no se da por hecho. Ya me pasó una vez: el
   * hermano no llegaba a insertarse por un choque de DNI, la cuenta era
   * TITULAR —que lo puede todo— y las comprobaciones pasaban por el motivo
   * equivocado. Una prueba que pasa por el motivo equivocado es peor que una
   * que falla.
   */
  await sql(`
    delete from hermandades where id = ${H};
    insert into hermandades (id, nombre) values (${H}, 'Hdad. de la Tienda');
    insert into auth.users (id, email) values
      (${UJEFE}, 'tienda-jefe@c9.es'), (${UCOST}, 'tienda-cost@c9.es') on conflict (id) do nothing;
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id, email, cargo) values
      (${JEFE}, ${H}, 'El mayordomo', '75000001A', 1, 'Activo', ${UJEFE}, 'tienda-jefe@c9.es', 'Mayordomo/Prioste');
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id, email, etiquetas) values
      (${COST}, ${H}, 'Un costalero', '75000002B', 2, 'Activo', ${UCOST}, 'tienda-cost@c9.es', array['Costalero']);
    select sembrar_permisos_de_fabrica(${H});
  `)
  const solo = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean).pop() ?? ''
  const como = async (uid, sentencia) => {
    try {
      await sql(`begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sentencia} commit;`)
      return { deja: 'sí', motivo: '' }
    } catch (e) { return { deja: 'no', motivo: String(e?.stderr ?? e) } }
  }
  const numero = (t) => t.split('\n').map((x) => x.trim()).filter((x) => /^-?\d+$/.test(x)).pop() ?? ''

  // `psql` cuela sus BEGIN/SET/ROLLBACK en la salida: se coge solo el sí o el no.
  const siNo = (t) => t.split('\n').map((x) => x.trim()).filter((x) => x === 'true' || x === 'false').pop() ?? ''
  caso('el mayordomo lleva inventario por su cargo', 'true', siNo(await sql(`
    begin; set local role authenticated; set local "request.jwt.claim.sub" = ${UJEFE};
      select modulo_permitido('inventario')::text; rollback;`)))
  // Y NO es titular, que es lo que invalidaría toda la prueba.
  caso('y no es titular (si no, esto no probaría nada)', '0',
    numero(await sql(`select count(*) from titulares where auth_user_id = ${UJEFE}`)))

  await como(UJEFE.slice(1, -1), `
    insert into productos (id, codigo, nombre, precio, coste, iva, stock, stock_minimo)
      values (${PROD}, 'CAM-01', 'Camiseta', 15.00, 6.00, 21, 10, 3);
    insert into descuentos (id, nombre, porcentaje, etiqueta)
      values (${DESC}, 'Costaleros', 50, 'Costalero');`)

  // 1. Una venta normal: importes, stock y los dos asientos.
  const venta1 = await como(UJEFE.slice(1, -1),
    `select registrar_venta('[{"producto_id":${PROD.slice(1, -1)},"cantidad":2}]'::jsonb);`
      .replace(`${PROD.slice(1, -1)}`, `"${PROD.slice(1, -1)}"`))
  caso('quien lleva inventario puede vender', 'sí', venta1.deja)
  caso('el stock baja', '8', numero(await sql(`select stock from productos where id = ${PROD}`)))
  /*
   * EL IVA VA EN SU PROPIA LÍNEA. De los 30 € cobrados, 24,79 € son de la
   * hermandad y 5,21 € se le cobran a quien compra para Hacienda. Sumados en
   * una sola línea, el libro diría que la tienda ingresa un 21 % más de lo que
   * ingresa, y el modelo 303 habría que sacarlo recorriendo las facturas.
   */
  caso('deja un ingreso por la base', '24.79', solo(await sql(
    `select importe::text from movimientos where origen like 'venta:%' and tipo = 'Ingreso'`)))
  caso('y el IVA en su propia partida', '5.21', solo(await sql(
    `select importe::text from movimientos where origen like 'iva-venta:%'`)))
  caso('con su nombre, para el 303', 'IVA repercutido', solo(await sql(
    `select categoria from movimientos where origen like 'iva-venta:%'`)))
  // Y las dos juntas suman EXACTAMENTE lo cobrado: es la misma cantidad de
  // dinero contada por separado, así que la caja sigue cuadrando.
  caso('y las dos suman lo que entró en la caja', '30.00', solo(await sql(
    `select sum(importe)::text from movimientos
      where (origen like 'venta:%' or origen like 'iva-venta:%') and tipo = 'Ingreso'`)))
  caso('y un gasto por lo que costó', '12.00', solo(await sql(
    `select importe::text from movimientos where origen like 'coste-venta:%' and tipo = 'Gasto'`)))

  /*
   * 2. UN HERMANO DE A PIE NO VENDE. No es que no le salga el botón: es que la
   * base no le deja, que es lo único que cuenta.
   */
  const colado = await como(UCOST.slice(1, -1),
    `select registrar_venta('[{"producto_id":"${PROD.slice(1, -1)}","cantidad":1}]'::jsonb);`)
  caso('un hermano de a pie no puede registrar ventas', 'no', colado.deja)

  // 3. No se vende lo que no hay.
  const sinGenero = await como(UJEFE.slice(1, -1),
    `select registrar_venta('[{"producto_id":"${PROD.slice(1, -1)}","cantidad":999}]'::jsonb);`)
  caso('no se puede vender lo que no hay', 'no', sinGenero.deja)
  caso('y el stock no se ha tocado', '8', numero(await sql(`select stock from productos where id = ${PROD}`)))

  /*
   * 4. EL DESCUENTO SE COMPRUEBA EN LA BASE, no se acepta el que mande el
   * navegador. Si no, cualquiera con la consola abierta se aplica el 50 % de
   * costaleros sin serlo.
   */
  const falso = await como(UJEFE.slice(1, -1),
    `select registrar_venta('[{"producto_id":"${PROD.slice(1, -1)}","cantidad":1}]'::jsonb,
       'fisica','Efectivo',${JEFE},${DESC});`)
  caso('el descuento de costaleros no vale para quien no lo es', 'no', falso.deja)

  const bueno = await como(UJEFE.slice(1, -1),
    `select registrar_venta('[{"producto_id":"${PROD.slice(1, -1)}","cantidad":2}]'::jsonb,
       'fisica','Efectivo',${COST},${DESC});`)
  caso('y sí para el costalero', 'sí', bueno.deja)
  caso('que paga la mitad', '15.00', solo(await sql(
    `select total::text from ventas where hermandad_id = ${H} and descuento_pct = 50`)))

  // 5. La numeración, correlativa y sin huecos.
  caso('las facturas van correlativas', '1,2', solo(await sql(
    `select string_agg(numero::text, ',' order by numero) from ventas where hermandad_id = ${H}`)))

  /*
   * 6. EL AVISO DE «QUEDA POCO», al CRUZAR el mínimo y una sola vez. Con
   * treinta ventas en un besamanos, avisar en cada una son treinta avisos
   * iguales y a partir del tercero nadie los lee.
   */
  const avisos = async () => numero(await sql(
    `select count(*) from avisos_hermano where hermandad_id = ${H} and tipo = 'existencias'`))
  caso('por encima del mínimo no avisa', '0', await avisos())
  await como(UJEFE.slice(1, -1),
    `select registrar_venta('[{"producto_id":"${PROD.slice(1, -1)}","cantidad":4}]'::jsonb);`)
  caso('al cruzar el mínimo, avisa una vez', '1', await avisos())
  caso('y le llega a quien lleva el inventario', '1', numero(await sql(
    `select count(*) from avisos_hermano where hermandad_id = ${H} and tipo = 'existencias' and hermano_id = ${JEFE}`)))
  await como(UJEFE.slice(1, -1),
    `select registrar_venta('[{"producto_id":"${PROD.slice(1, -1)}","cantidad":1}]'::jsonb);`)
  caso('otra venta por debajo no repite el aviso', '1', await avisos())

  // 7. Romper género resta, y el stock nunca queda en negativo.
  const rota = await como(UJEFE.slice(1, -1), `select mover_stock(${PROD}, 'rotura', 1, 'Se cayó la caja');`)
  caso('se puede dar de baja lo que se rompe', 'sí', rota.deja)
  const imposible = await como(UJEFE.slice(1, -1), `select mover_stock(${PROD}, 'rotura', 99, 'imposible');`)
  caso('pero el stock no puede quedar en negativo', 'no', imposible.deja)

  /*
   * 8. ANULAR: el género vuelve, la factura NO se borra.
   *
   * Una factura emitida no se hace desaparecer: se anula y su número se queda
   * ocupado. Borrarla dejaría un hueco en la numeración, que es justo lo que
   * no puede pasar.
   */
  const antes = numero(await sql(`select stock from productos where id = ${PROD}`))
  const cuantas = numero(await sql(`select count(*) from ventas where hermandad_id = ${H}`))
  await como(UJEFE.slice(1, -1),
    `select anular_venta((select id from ventas where hermandad_id = ${H} order by numero desc limit 1), 'prueba');`)
  caso('al anular vuelve el género', String(Number(antes) + 1),
    numero(await sql(`select stock from productos where id = ${PROD}`)))
  caso('la factura sigue existiendo', cuantas,
    numero(await sql(`select count(*) from ventas where hermandad_id = ${H}`)))
  caso('marcada como anulada', 'Anulada', solo(await sql(
    `select estado from ventas where hermandad_id = ${H} order by numero desc limit 1`)))
  caso('y con sus asientos contrarios', '1', numero(await sql(
    `select count(*) from movimientos where hermandad_id = ${H} and origen like 'anula-venta:%'`)))
  // Y el del IVA aparte, como se apuntó: si se contra-apuntara todo junto, el
  // 303 saldría con el IVA repercutido de una venta que ya no existe.
  caso('el IVA también se contra-apunta', '1', numero(await sql(
    `select count(*) from movimientos where hermandad_id = ${H} and origen like 'anula-iva-venta:%'`)))
  caso('y en su partida', 'IVA repercutido', solo(await sql(
    `select categoria from movimientos where hermandad_id = ${H} and origen like 'anula-iva-venta:%'`)))
  // Anular dos veces no devuelve el género dos veces. Y LO DICE: contesta
  // `false`, para que la pantalla no anuncie que ha vuelto el género cuando no
  // ha vuelto nada.
  const yaEstaba = numero(await sql(`select stock from productos where id = ${PROD}`))
  const segundaVez = await sql(`begin; set local role authenticated;
    set local "request.jwt.claim.sub" = ${UJEFE};
      select anular_venta((select id from ventas where hermandad_id = ${H}
        order by numero desc limit 1), 'otra vez')::text; rollback;`)
  caso('anular dos veces contesta que no ha hecho nada', 'false', siNo(segundaVez))
  await como(UJEFE.slice(1, -1),
    `select anular_venta((select id from ventas where hermandad_id = ${H} order by numero desc limit 1), 'otra vez');`)
  caso('anular dos veces no lo devuelve dos veces', yaEstaba,
    numero(await sql(`select stock from productos where id = ${PROD}`)))
}

/**
 * LA TIENDA EN LA WEB: SE APARTA, Y SE PAGA AL RECOGER.
 *
 * Esta es la parte de la tienda que toca gente de fuera: alguien que entra en
 * la web de la hermandad, sin cuenta ninguna, y aparta una camiseta. Todo lo
 * que puede hacer pasa por `crear_reserva_web`, y por eso esa función es la
 * superficie más expuesta de todo el módulo: la llama cualquiera con la llave
 * pública que viaja en el JavaScript de la página.
 *
 * De las siete comprobaciones de aquí, cinco son de las que no se ven mirando
 * la pantalla —el precio lo pone la base, el género de otra hermandad no se
 * toca, un artículo despublicado tampoco, quien reserva no puede leer las
 * reservas de nadie— y dos son de contabilidad: que reservar NO baja el stock
 * y NO deja asiento, y que los dos nacen al recoger.
 */
async function laTiendaDeLaWebApartaYNoCobra({ sql, caso }) {
  const H = "'ca000000-0000-0000-0000-0000000000ca'"
  const OTRA = "'cb000000-0000-0000-0000-0000000000cb'"
  const UJEFE = "'cc000000-0000-0000-0000-0000000000cc'"
  const JEFE = "'cd000000-0000-0000-0000-0000000000cd'"
  const PROD = "'ce000000-0000-0000-0000-0000000000ce'"

  /*
   * El fixture se comprueba, como en la prueba de la caja. Un `insert` que no
   * llega a entrar deja una prueba que pasa por el motivo equivocado, y eso es
   * peor que una que falla.
   */
  await sql(`
    delete from hermandades where id in (${H}, ${OTRA});
    insert into hermandades (id, nombre) values (${H}, 'Hdad. de la Web'), (${OTRA}, 'La de al lado');
    insert into auth.users (id, email) values (${UJEFE}, 'tienda-web@ca.es') on conflict (id) do nothing;
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id, email, cargo) values
      (${JEFE}, ${H}, 'La mayordoma', '76000001A', 1, 'Activo', ${UJEFE}, 'tienda-web@ca.es', 'Mayordomo/Prioste');
    insert into web_publica (hermandad_id, slug, publicada) values (${H}, 'hdad-de-la-web', true);
    insert into productos (id, hermandad_id, codigo, nombre, precio, coste, iva, stock, stock_minimo, activo, visible_en_web)
      values (${PROD}, ${H}, 'MED-01', 'Medalla', 40.00, 12.00, 21, 10, 2, true, true);
    select sembrar_permisos_de_fabrica(${H});
  `)
  const numero = (t) => t.split('\n').map((x) => x.trim()).filter((x) => /^-?\d+$/.test(x)).pop() ?? ''
  const solo = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean).pop() ?? ''

  caso('el fixture existe (si no, esto no probaría nada)', '1',
    numero(await sql(`select count(*) from productos where id = ${PROD}`)))

  /** Lo mismo que hace el navegador de un visitante: sin sesión de ninguna clase. */
  const comoVisitante = async (sentencia) => {
    try {
      return { deja: 'sí', salida: await sql(`begin; set local role anon; ${sentencia} rollback;`) }
    } catch (e) { return { deja: 'no', salida: String(e?.stderr ?? e) } }
  }
  const comoJefa = async (sentencia) => {
    try {
      await sql(`begin; set local role authenticated;
        set local "request.jwt.claim.sub" = ${UJEFE}; ${sentencia} commit;`)
      return { deja: 'sí', motivo: '' }
    } catch (e) { return { deja: 'no', motivo: String(e?.stderr ?? e) } }
  }
  const linea = (l) => `'[{"producto_id":"${PROD.slice(1, -1)}","cantidad":${l}}]'::jsonb`

  /*
   * 1. EL CATÁLOGO SE VE SIN ENTRAR EN NINGÚN SITIO. Es la mitad de la
   * función: una tienda que solo ven los que ya tienen cuenta no es una tienda
   * en la web. Y se ve SIN EL COSTE — que la hermandad compre la medalla a 12
   * y la venda a 40 no es asunto de quien pasa por la página.
   */
  const cat = await comoVisitante(`select nombre || '|' || precio::text || '|' || disponible::text
    from catalogo_web('hdad-de-la-web');`)
  caso('un visitante ve el catálogo sin cuenta', 'Medalla|40.00|10',
    cat.salida.split('\n').map((x) => x.trim()).find((x) => x.startsWith('Medalla')) ?? cat.salida)
  const conCoste = await comoVisitante(`select coste from catalogo_web('hdad-de-la-web');`)
  caso('y no ve lo que le cuesta a la hermandad', 'no', conCoste.deja)

  // Y solo si la web está publicada: la que se está preparando no enseña nada.
  await sql(`update web_publica set publicada = false where hermandad_id = ${H}`)
  const enBorrador = await comoVisitante(`select count(*) from catalogo_web('hdad-de-la-web');`)
  caso('una web sin publicar no enseña su género', '0', numero(enBorrador.salida))
  /*
   * …pero la gente de esa hermandad SÍ, que es lo que hace que la vista previa
   * del panel sirva para algo antes de publicar. Y no se lo cree por decirlo:
   * no hay ningún parámetro de «soy de la casa», se mira la sesión.
   */
  const enPrevia = await sql(`begin; set local role authenticated;
    set local "request.jwt.claim.sub" = ${UJEFE};
      select count(*) from catalogo_web('hdad-de-la-web'); rollback;`)
  caso('pero la propia hermandad sí, para la vista previa', '1', numero(enPrevia))
  await sql(`update web_publica set publicada = true where hermandad_id = ${H}`)

  // 2. Y APARTA. Sin sesión, como cualquiera que entre desde el móvil.
  await sql(`begin; set local role anon;
    select crear_reserva_web(${H}, ${linea(3)}, 'María del Carmen', 'mc@ejemplo.es', '600111222');
    commit;`)
  caso('el visitante aparta tres', '3', numero(await sql(
    `select sum(cantidad) from lineas_reserva where hermandad_id = ${H}`)))
  caso('a su precio de tarifa', '40.00', solo(await sql(
    `select precio_unitario::text from lineas_reserva where hermandad_id = ${H}`)))
  caso('con su referencia del año', 'R-' + new Date().getFullYear() + '-1', solo(await sql(
    `select referencia from reservas_tienda where hermandad_id = ${H}`)))

  /*
   * 3. RESERVAR NO ES VENDER. El stock no se toca —la medalla sigue en el
   * cajón— y lo que baja es lo DISPONIBLE. Descontar del stock al reservar
   * haría que el recuento del almacén no cuadrara nunca con la estantería.
   */
  caso('el almacén no se ha tocado', '10', numero(await sql(`select stock from productos where id = ${PROD}`)))
  caso('pero ya solo se pueden prometer siete', '7',
    numero((await comoVisitante(`select disponible from catalogo_web('hdad-de-la-web');`)).salida))
  caso('y no hay ni factura ni asiento', '0', numero(await sql(
    `select count(*) from ventas where hermandad_id = ${H}`)))

  /*
   * 4. EL PRECIO LO PONE LA BASE. Si viniera del navegador, cualquiera con la
   * consola abierta aparta la medalla de cuarenta euros por cero.
   */
  await sql(`begin; set local role anon;
    select crear_reserva_web(${H},
      '[{"producto_id":"${PROD.slice(1, -1)}","cantidad":1,"precio_unitario":0}]'::jsonb, 'El listo');
    commit;`)
  caso('el precio que manda el navegador se ignora', '40.00', solo(await sql(
    `select l.precio_unitario::text from lineas_reserva l
       join reservas_tienda r on r.id = l.reserva_id where r.nombre = 'El listo'`)))

  // 5. No se aparta más de lo que se puede prometer, ni género ajeno, ni retirado.
  const ansioso = await comoVisitante(`select crear_reserva_web(${H}, ${linea(99)}, 'El ansioso');`)
  caso('no se aparta más de lo disponible', 'no', ansioso.deja)
  const ajeno = await comoVisitante(`select crear_reserva_web(${OTRA}, ${linea(1)}, 'El confundido');`)
  caso('ni el género de otra hermandad', 'no', ajeno.deja)
  await sql(`update productos set visible_en_web = false where id = ${PROD}`)
  const retirado = await comoVisitante(`select crear_reserva_web(${H}, ${linea(1)}, 'El tardón');`)
  caso('ni lo que se ha quitado de la web', 'no', retirado.deja)
  await sql(`update productos set visible_en_web = true where id = ${PROD}`)

  /*
   * 6. QUIEN RESERVA NO LEE LAS RESERVAS. Ni las suyas. Con una lectura
   * abierta, cualquiera se baja los nombres, correos y teléfonos de todo el
   * que ha apartado algo — que es justo el dato que más duele perder.
   */
  /*
   * Y OJO CON CÓMO SE COMPRUEBA. Postgres NO da error cuando una política le
   * cierra la puerta a un `select`: devuelve cero filas y dice que todo ha
   * ido bien. Escrita como «esto tiene que fallar», esta comprobación pasaría
   * en verde aunque las reservas se vieran enteras, porque `psql` tampoco se
   * quejaría. Así que se cuentan FILAS, que es lo único que distingue una
   * política que cierra de una que no está.
   */
  const fisgon = await comoVisitante(`select count(*) from reservas_tienda;`)
  caso('quien reserva no ve ni una reserva', '0', numero(fisgon.salida))
  const fisgonLineas = await comoVisitante(`select count(*) from lineas_reserva;`)
  caso('ni una sola línea de reserva', '0', numero(fisgonLineas.salida))
  // Y hay filas de verdad que ver: si no, esto pasaría por estar vacío.
  caso('y eso que hay reservas puestas', '2',
    numero(await sql(`select count(*) from reservas_tienda where hermandad_id = ${H}`)))
  // Escribir tampoco: ahí la política sí levanta la voz.
  const colado = await comoVisitante(
    `insert into reservas_tienda (hermandad_id, referencia, nombre) values (${H}, 'R-0-0', 'A mano');`)
  caso('ni se inventa una reserva a mano', 'no', colado.deja)

  // Y le llega el aviso a quien lleva el inventario: una reserva que nadie
  // mira es alguien plantado en la casa hermandad a por algo que no le han
  // apartado.
  caso('avisa a quien lleva el inventario', '2', numero(await sql(
    `select count(*) from avisos_hermano where hermandad_id = ${H} and hermano_id = ${JEFE}
      and tipo = 'existencias'`)))

  /*
   * 7. Y AL RECOGER: ahí sí nace la factura, ahí sí bajan las tres medallas
   * del almacén y ahí sí entran los dos asientos.
   */
  const entrega = await comoJefa(
    `select entregar_reserva((select id from reservas_tienda where nombre = 'María del Carmen'), 'Efectivo');`)
  caso('quien lleva inventario entrega la reserva', 'sí', entrega.deja)
  caso('ahora sí baja el almacén', '7', numero(await sql(`select stock from productos where id = ${PROD}`)))
  caso('y nace la factura, con el canal de internet', 'online', solo(await sql(
    `select canal from ventas where hermandad_id = ${H}`)))
  caso('por los ciento veinte euros', '120.00', solo(await sql(
    `select total::text from ventas where hermandad_id = ${H}`)))
  caso('con su ingreso en tesorería', '120.00', solo(await sql(
    `select sum(importe)::text from movimientos where hermandad_id = ${H}
      and (origen like 'venta:%' or origen like 'iva-venta:%') and tipo = 'Ingreso'`)))
  caso('y el gasto de lo que costó', '36.00', solo(await sql(
    `select importe::text from movimientos where hermandad_id = ${H} and origen like 'coste-venta:%'`)))
  caso('la reserva queda entregada', 'entregada', solo(await sql(
    `select r.estado from reservas_tienda r where r.nombre = 'María del Carmen'`)))

  // Entregarla dos veces no vende dos veces.
  const otraVez = await comoJefa(
    `select entregar_reserva((select id from reservas_tienda where nombre = 'María del Carmen'), 'Efectivo');`)
  caso('entregar dos veces no vende dos veces', 'no', otraVez.deja)

  /*
   * 8. SOLTAR UNA RESERVA no la borra: la marca. Una reserva borrada es una
   * llamada de teléfono que nadie puede explicar. Y el género vuelve a estar
   * disponible en cuanto deja de estar pendiente.
   */
  const antes = numero((await comoVisitante(`select disponible from catalogo_web('hdad-de-la-web');`)).salida)
  await comoJefa(`select soltar_reserva((select id from reservas_tienda where nombre = 'El listo'),
    'No vino a por ella', 'caducada');`)
  caso('al soltarla, el género vuelve a estar disponible', String(Number(antes) + 1),
    numero((await comoVisitante(`select disponible from catalogo_web('hdad-de-la-web');`)).salida))
  caso('y la reserva sigue ahí, marcada', 'caducada', solo(await sql(
    `select r.estado from reservas_tienda r where r.nombre = 'El listo'`)))

  /*
   * Y SOLTAR ALGO QUE YA NO ESTÁ PENDIENTE DICE QUE NO HA HECHO NADA.
   *
   * Un `update` que no encuentra fila no es un error en Postgres: afecta a
   * cero filas y contesta que todo ha ido bien. Con la función devolviendo
   * `void`, la pantalla anunciaba «anulada, el género vuelve a estar
   * disponible» sobre una reserva que otro acababa de entregar desde el
   * ordenador de al lado.
   */
  const yaSoltada = await sql(`begin; set local role authenticated;
    set local "request.jwt.claim.sub" = ${UJEFE};
      select soltar_reserva((select id from reservas_tienda where nombre = 'El listo'),
        'otra vez', 'anulada')::text; rollback;`)
  caso('soltar una que ya no está pendiente contesta que no', 'false',
    yaSoltada.split('\n').map((x) => x.trim()).filter((x) => x === 'true' || x === 'false').pop() ?? '')
  const laDeVerdad = await sql(`begin; set local role anon;
      select crear_reserva_web(${H}, ${linea(1)}, 'La que se suelta');
    commit;
    begin; set local role authenticated; set local "request.jwt.claim.sub" = ${UJEFE};
      select soltar_reserva((select id from reservas_tienda where nombre = 'La que se suelta'),
        'no vino', 'caducada')::text; commit;`)
  caso('y una que sí lo estaba contesta que sí', 'true',
    laDeVerdad.split('\n').map((x) => x.trim()).filter((x) => x === 'true' || x === 'false').pop() ?? '')

  /*
   * 9. EL RESGUARDO POR CORREO, con sus tres cierres.
   *
   * `resguardo_de_reserva` es lo que lee `enviar-correo` con la clave de
   * servicio para mandarle a quien apartó algo lo que apartó. Es la única
   * pieza de todo esto que devuelve un correo y un nombre, así que lo que
   * importa aquí no es que funcione sino QUÉ SE NIEGA A CONTESTAR.
   */
  await sql(`begin; set local role anon;
    select crear_reserva_web(${H}, ${linea(1)}, 'La del resguardo', 'resguardo@ejemplo.es');
    commit;`)
  const pedirResguardo = async (ref) => solo(await sql(
    `select coalesce(resguardo_de_reserva(${H}, '${ref}') ->> 'email', 'nada')`))
  const suRef = solo(await sql(
    `select referencia from reservas_tienda where nombre = 'La del resguardo'`))

  caso('la primera vez sale el correo de quien reservó', 'resguardo@ejemplo.es', await pedirResguardo(suRef))
  // Y SOLO UNA VEZ: si no, probando referencias se le llena el buzón a la gente.
  caso('la segunda vez ya no', 'nada', await pedirResguardo(suRef))
  caso('una referencia inventada no dice ni que no existe', 'nada', await pedirResguardo('R-1999-99'))
  // Ni una vieja: pasada la media hora, ir probando referencias no sirve.
  await sql(`update reservas_tienda set resguardo_enviado_en = null,
    creado_en = now() - interval '2 hours' where nombre = 'La del resguardo'`)
  caso('ni una de hace dos horas', 'nada', await pedirResguardo(suRef))

  /*
   * Y NO LA PUEDE LLAMAR EL NAVEGADOR. Es la comprobación que de verdad
   * importa: devuelve el correo y el nombre de quien reservó, así que si `anon`
   * pudiera ejecutarla, todo el cuidado de arriba —no dar una política de
   * lectura sobre `reservas_tienda`— no habría servido de nada.
   */
  const porLaPuertaDeAtras = await comoVisitante(`select resguardo_de_reserva(${H}, '${suRef}');`)
  caso('y no la puede llamar quien entra en la web', 'no', porLaPuertaDeAtras.deja)
  const porLaOtraPuerta = await comoJefa(`select resguardo_de_reserva(${H}, '${suRef}');`)
  caso('ni siquiera quien lleva el inventario: eso lo lee el servidor', 'no', porLaOtraPuerta.deja)
}


/**
 * LA FACTURA CUADRA CON LO QUE CALCULÓ LA BASE DE DATOS.
 *
 * Esta prueba existe porque la misma cuenta está escrita DOS VECES, en dos
 * lenguajes: `registrar_venta()` calcula la base y la cuota al vender y las
 * guarda en la fila; `desgloseIvaPorTipo()` las vuelve a calcular desde las
 * líneas para imprimir la factura, y además las separa por tipo de IVA.
 *
 * Las dos tienen que dar EXACTAMENTE lo mismo, hasta el céntimo. Y no es
 * evidente que lo hagan: la base se saca dividiendo por (1 + iva/100) y
 * redondeando, y el redondeo depende de dónde se agrupe. Basta con que una de
 * las dos agrupe antes de dividir para que una factura de tres artículos
 * baratos diga un céntimo menos que la venta que la originó.
 *
 * Las pruebas de `tienda.prueba.mjs` comprueban esa aritmética en JavaScript
 * contra una imitación de lo que hace el SQL. Esta la comprueba contra el SQL
 * DE VERDAD, ejecutado por Postgres, que es lo único que cierra el círculo.
 *
 * Los precios están elegidos para que el redondeo caiga mal a propósito: 0,07
 * al 21 % da 0,0578…, y tres de ellos separan las dos formas de calcularlo.
 */
async function laFacturaCuadraConLaBase({ sql, caso }) {
  const H = "'cf000000-0000-0000-0000-0000000000cf'"
  const U = "'d0000000-0000-0000-0000-0000000000d0'"
  const JEFE = "'d1000000-0000-0000-0000-0000000000d1'"

  await sql(`
    delete from hermandades where id = ${H};
    insert into hermandades (id, nombre) values (${H}, 'Hdad. de la Factura');
    insert into auth.users (id, email) values (${U}, 'factura@cf.es') on conflict (id) do nothing;
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id, email, cargo) values
      (${JEFE}, ${H}, 'El mayordomo', '77000001A', 1, 'Activo', ${U}, 'factura@cf.es', 'Mayordomo/Prioste');
    select sembrar_permisos_de_fabrica(${H});
    -- Cuatro artículos con TRES tipos de IVA distintos y precios que redondean mal.
    insert into productos (id, hermandad_id, codigo, nombre, precio, coste, iva, stock, stock_minimo) values
      ('d2000000-0000-0000-0000-0000000000d2', ${H}, 'A', 'Chapa',   0.07, 0.02, 21, 100, 0),
      ('d3000000-0000-0000-0000-0000000000d3', ${H}, 'B', 'Estampa', 1.13, 0.40, 21, 100, 0),
      ('d4000000-0000-0000-0000-0000000000d4', ${H}, 'C', 'Vela',    9.99, 4.00, 10, 100, 0),
      ('d5000000-0000-0000-0000-0000000000d5', ${H}, 'D', 'Libro',   2.35, 1.00,  4, 100, 0);
  `)
  const numero = (t) => t.split('\n').map((x) => x.trim()).filter((x) => /^-?\d+$/.test(x)).pop() ?? ''
  const solo = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean).pop() ?? ''
  caso('el fixture existe (si no, esto no probaría nada)', '4',
    numero(await sql(`select count(*) from productos where hermandad_id = ${H}`)))

  await sql(`begin; set local role authenticated; set local "request.jwt.claim.sub" = ${U};
    select registrar_venta('[
      {"producto_id":"d2000000-0000-0000-0000-0000000000d2","cantidad":3},
      {"producto_id":"d3000000-0000-0000-0000-0000000000d3","cantidad":7},
      {"producto_id":"d4000000-0000-0000-0000-0000000000d4","cantidad":1},
      {"producto_id":"d5000000-0000-0000-0000-0000000000d5","cantidad":5}
    ]'::jsonb);
    commit;`)

  // Lo que guardó la base, y las líneas tal como las leería la factura.
  const cabecera = solo(await sql(
    `select base::text || '|' || iva_total::text || '|' || total::text from ventas where hermandad_id = ${H}`))
  const filas = (await sql(
    `select cantidad || '|' || precio_unitario || '|' || iva from lineas_venta where hermandad_id = ${H}`))
    .split('\n').map((x) => x.trim()).filter((x) => x.includes('|'))
  caso('la venta tiene sus cuatro líneas', 4, filas.length)

  // Y ahora la MISMA cuenta que hace la factura, con la función de verdad.
  // Se importa el módulo DE VERDAD, el mismo que usa la factura en pantalla.
  // Sin red de seguridad a propósito: si un día no se pudiera cargar, esta
  // prueba tiene que romperse en vez de comprobar otra cosa.
  const { desgloseIvaPorTipo, sumaDelDesglose } = await import('../src/data/tienda.ts')
  const lineas = filas.map((f, i) => {
    const [cantidad, precioUnitario, iva] = f.split('|').map(Number)
    return {
      id: String(i), ventaId: 'v', codigo: '', nombre: '',
      cantidad, precioUnitario, precioTarifa: precioUnitario, costeUnitario: 0, iva,
    }
  })
  const s = sumaDelDesglose(desgloseIvaPorTipo(lineas))
  const [base, iva, total] = cabecera.split('|').map(Number)

  caso('la base de la factura es la que guardó la venta', base, s.base)
  caso('y la cuota de IVA también', iva, s.cuota)
  caso('y el total', total, s.total)

  // Y hay de verdad tres tipos distintos: si no, esto probaría un solo tramo.
  caso('con tres tipos de IVA en la misma factura', 3, desgloseIvaPorTipo(lineas).length)
}


/**
 * EL PRECIO CON DESCUENTO, IDÉNTICO EN LA PANTALLA Y EN LA BASE.
 *
 * La caja enseña «Cobrar 4,81 €» y la base cobra lo que ella calcula. Son dos
 * cuentas distintas escritas en dos lenguajes, y tienen que dar exactamente lo
 * mismo o se le dice un precio a alguien y se le cobra otro.
 *
 * NO ES TEÓRICO: la primera versión hacía en JavaScript
 * `Math.round(precio * (1 - pct/100) * 100) / 100`, que redondea un número
 * binario de coma flotante, mientras Postgres hace `round(numeric, 2)` sobre
 * un decimal exacto. En los empates a medio céntimo se iban a lados distintos:
 * 1,15 € al 50 % daba 0,57 € en pantalla y 0,58 € en la base.
 *
 * Aquí se comparan MILES de combinaciones, no dos o tres elegidas a mano —que
 * es justo lo que dejó pasar el fallo: la prueba que había usaba 15 € al 50 %,
 * un caso que no puede fallar—. Los precios van de 1,00 € a 60,00 € y los
 * descuentos son los que de verdad se ponen.
 */
async function elPrecioRebajadoEsElMismoEnLosDosSitios({ sql, caso }) {
  const { precioDeLineaCent } = await import('../src/data/tienda.ts')

  const PCTS = [5, 10, 15, 20, 25, 50, 12.5, 33.33]
  const filas = []
  for (let c = 100; c <= 6000; c += 1) {
    for (const pct of PCTS) filas.push(`(${c / 100},${pct})`)
  }

  /*
   * Se calcula EN POSTGRES con la misma expresión que usa `registrar_venta`,
   * copiada tal cual de `supabase/tienda.sql`. Si allí se cambia la fórmula,
   * esta prueba deja de reflejarla y hay que venir a tocarla: es el precio de
   * comparar dos cuentas que viven en sitios distintos.
   */
  const salida = await sql(`
    create temp table _precios(precio numeric(10,2), pct numeric(5,2));
    insert into _precios values ${filas.join(',')};
    select precio::text || '|' || pct::text || '|' || round(precio * (1 - pct / 100), 2)::text
      from _precios;
  `)
  const lineas = salida.split('\n').map((x) => x.trim()).filter((x) => x.split('|').length === 3)
  caso('hay miles de combinaciones que comparar', true, lineas.length > 40000)

  const malas = []
  for (const l of lineas) {
    const [precio, pct, dePostgres] = l.split('|').map(Number)
    const deLaPantalla = precioDeLineaCent({ precio }, pct)
    if (deLaPantalla !== Math.round(dePostgres * 100)) {
      malas.push(`${precio} € al ${pct} %: pantalla ${deLaPantalla / 100} · base ${dePostgres}`)
    }
  }
  caso('ni un solo precio discrepa entre la caja y la base', [], malas.slice(0, 5))

  /*
   * Y la comprobación que evita que esto pase por el motivo equivocado: la
   * cuenta INGENUA —la que estaba escrita— tiene que fallar de verdad sobre
   * estos mismos datos. Si no fallara, esta prueba no estaría probando nada.
   */
  const ingenuas = lineas.filter((l) => {
    const [precio, pct, dePostgres] = l.split('|').map(Number)
    return Math.round(precio * (1 - pct / 100) * 100) !== Math.round(dePostgres * 100)
  })
  caso('y la cuenta ingenua sí falla (si no, esto no probaría nada)', true, ingenuas.length > 100)
}


/**
 * LOS DATOS DE LA TIENDA, SUMADOS EN LA BASE.
 *
 * `datos_tienda()` es lo que alimenta las gráficas. Se prueba aquí y no
 * leyendo el SQL porque lo que puede fallar son cosas que solo se ven
 * ejecutándolo: que una venta anulada no cuente, que los dos canales se
 * separen bien, que el año se corte donde tiene que cortarse, y que quien no
 * lleva ni el inventario ni la tesorería no pueda mirarlo.
 *
 * EL CORTE DE AÑO ES EL CASO QUE MÁS IMPORTA. La venta de Nochevieja a las
 * 23:30 en España está guardada como las 22:30 UTC del 31 de diciembre; la de
 * las 00:30 del 1 de enero, como las 23:30 UTC del 31. Cortando el año en UTC
 * —que es lo que haría `extract(year from fecha)` en Supabase— la segunda
 * caería en el ejercicio que ya está cerrado.
 */
async function losDatosDeLaTiendaCuadran({ sql, caso }) {
  const H = "'e0000000-0000-0000-0000-0000000000e0'"
  const U = "'e1000000-0000-0000-0000-0000000000e1'"
  const JEFE = "'e2000000-0000-0000-0000-0000000000e2'"
  const UPEON = "'e3000000-0000-0000-0000-0000000000e3'"
  const PEON = "'e4000000-0000-0000-0000-0000000000e4'"
  const CAM = "'e5000000-0000-0000-0000-0000000000e5'"
  const LIB = "'e6000000-0000-0000-0000-0000000000e6'"

  await sql(`
    delete from hermandades where id = ${H};
    insert into hermandades (id, nombre) values (${H}, 'Hdad. de los Datos');
    insert into auth.users (id, email) values
      (${U}, 'datos-jefe@e0.es'), (${UPEON}, 'datos-peon@e0.es') on conflict (id) do nothing;
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id, email, cargo) values
      (${JEFE}, ${H}, 'El mayordomo', '78000001A', 1, 'Activo', ${U}, 'datos-jefe@e0.es', 'Mayordomo/Prioste');
    insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, auth_user_id, email) values
      (${PEON}, ${H}, 'Un hermano', '78000002B', 2, 'Activo', ${UPEON}, 'datos-peon@e0.es');
    select sembrar_permisos_de_fabrica(${H});
    insert into productos (id, hermandad_id, codigo, nombre, precio, coste, iva, stock, stock_minimo) values
      (${CAM}, ${H}, 'CAM', 'Camiseta', 15.00, 6.00, 21, 500, 0),
      (${LIB}, ${H}, 'LIB', 'Libro',    28.00, 14.00, 4, 500, 0);
  `)
  const numero = (t) => t.split('\n').map((x) => x.trim()).filter((x) => /^-?\d+$/.test(x)).pop() ?? ''
  const solo = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean).pop() ?? ''
  caso('el fixture existe (si no, esto no probaría nada)', '2',
    numero(await sql(`select count(*) from productos where hermandad_id = ${H}`)))

  const vender = async (lineas, canal, forma) => sql(`begin; set local role authenticated;
    set local "request.jwt.claim.sub" = ${U};
      select registrar_venta('${lineas}'::jsonb, '${canal}', '${forma}');
    commit;`)
  const L = (id, n) => `{"producto_id":"${id.slice(1, -1)}","cantidad":${n}}`

  //  Mostrador: 2 camisetas (30 €) + 1 libro (28 €). Internet: 3 camisetas (45 €).
  await vender(`[${L(CAM, 2)},${L(LIB, 1)}]`, 'fisica', 'Efectivo')
  await vender(`[${L(CAM, 3)}]`, 'online', 'Bizum')
  //  Y una que se anula: no puede contar en ningún sitio.
  await vender(`[${L(CAM, 10)}]`, 'fisica', 'Tarjeta')
  await sql(`begin; set local role authenticated; set local "request.jwt.claim.sub" = ${U};
    select anular_venta((select id from ventas where hermandad_id = ${H}
      order by numero desc limit 1), 'prueba'); commit;`)

  /*
   * Las tres se han registrado HOY. Para poder comprobar el corte de año se
   * mueven a mano a los dos lados de la medianoche del 31 de diciembre, que es
   * el único sitio donde el huso se nota.
   */
  const ANIO = 2031
  await sql(`
    update ventas set fecha = timestamptz '${ANIO}-06-15 12:00:00+02'
     where hermandad_id = ${H} and estado <> 'Anulada';
    -- Y dos más, una a cada lado de la medianoche de fin de año EN ESPAÑA.
    insert into ventas (hermandad_id, serie, numero, canal, forma_pago, base, iva_total, total,
                        coste_total, estado, fecha)
    values
      (${H}, 'A', 900, 'fisica', 'Efectivo', 10, 2.1, 12.10, 5, 'Cobrada',
       timestamptz '${ANIO}-12-31 23:30:00+01'),
      (${H}, 'A', 901, 'fisica', 'Efectivo', 20, 4.2, 24.20, 9, 'Cobrada',
       timestamptz '${ANIO + 1}-01-01 00:30:00+01');
  `)

  /*
   * `psql` imprime también sus BEGIN, SET y ROLLBACK, así que de toda la
   * salida se busca LA LÍNEA que es el objeto. Coger la última no vale: es
   * «ROLLBACK», y `JSON.parse` se cae con un mensaje que no dice nada del
   * fallo de verdad.
   */
  const datos = async (uid, anio) => {
    const salida = await sql(`begin; set local role authenticated;
      set local "request.jwt.claim.sub" = ${uid};
        select datos_tienda(${anio})::text; rollback;`)
    const linea = salida.split('\n').map((x) => x.trim()).find((x) => x.startsWith('{'))
    if (!linea) throw new Error(`datos_tienda no devolvió nada: ${salida.slice(0, 200)}`)
    return linea
  }

  const d = JSON.parse(await datos(U, ANIO))

  // 1. Los dos canales, separados y con sus importes.
  const mes6 = d.meses.filter((m) => m.mes === 6)
  caso('junio tiene los dos canales', ['fisica', 'online'], mes6.map((m) => m.canal).sort())
  /*
   * Se comparan NÚMEROS y no textos. `jsonb` serializa los `numeric` sin los
   * ceros de cola —58.00 sale como `58`—, así que comparar cadenas fallaba por
   * el formato y no por el importe. El navegador los pasa por `Number()` igual.
   */
  caso('lo del mostrador son 58 €', 58, Number(mes6.find((m) => m.canal === 'fisica').total))
  caso('y lo de internet, 45 €', 45, Number(mes6.find((m) => m.canal === 'online').total))

  /*
   * 2. LA ANULADA NO CUENTA EN NINGÚN SITIO. Eran 10 camisetas: si se colara,
   * el mostrador diría 208 € y la camiseta sería el artículo del año por
   * goleada.
   */
  caso('la anulada no suma en el mes', 58, Number(mes6.find((m) => m.canal === 'fisica').total))
  const cam = d.articulos.filter((a) => a.codigo === 'CAM')
  caso('ni en los artículos', 5, cam.reduce((n, a) => n + a.unidades, 0))
  caso('ni en las formas de pago', 0, d.formas.filter((f) => f.forma === 'Tarjeta').length)

  // 3. Los artículos, separados por canal y ordenados por lo que dejan.
  caso('la camiseta sale en los dos canales', ['fisica', 'online'], cam.map((a) => a.canal).sort())
  caso('el libro solo en el mostrador', 1, d.articulos.filter((a) => a.codigo === 'LIB').length)
  caso('y el artículo que más deja va primero', 'CAM', d.articulos[0].codigo)

  /*
   * 4. EL CORTE DE AÑO, EN HORA DE AQUÍ. La de las 23:30 del 31 de diciembre
   * es de este ejercicio; la de las 00:30 del 1 de enero, del siguiente.
   * Cortando en UTC —lo que haría `extract(year from fecha)` en Supabase—, la
   * segunda se habría caído dentro del año que ya está cerrado.
   */
  const dic = d.meses.find((m) => m.mes === 12)
  caso('la venta de Nochevieja entra en su año', 12.1, Number(dic.total))
  const siguiente = JSON.parse(await datos(U, ANIO + 1))
  const enero = siguiente.meses.find((m) => m.mes === 1)
  caso('y la de Año Nuevo, en el siguiente', 24.2, Number(enero.total))
  caso('sin colarse en el anterior', 1, d.meses.filter((m) => m.mes === 12).length)

  // 5. Los años que ofrecer en el selector salen de lo que hay.
  caso('el selector ofrece los dos años', [ANIO + 1, ANIO], d.anios)

  /*
   * 6. Y NO LO VE CUALQUIERA. Aquí está lo que gana la hermandad con cada
   * artículo: eso es cosa de la junta, no del censo.
   */
  let deja = 'sí'
  try {
    await sql(`begin; set local role authenticated; set local "request.jwt.claim.sub" = ${UPEON};
      select datos_tienda(${ANIO}); rollback;`)
  } catch { deja = 'no' }
  caso('un hermano de a pie no ve los datos de la tienda', 'no', deja)
  // Y que el mayordomo no lo vea por ser titular, que invalidaría lo anterior.
  caso('y el mayordomo no es titular', '0',
    numero(await sql(`select count(*) from titulares where auth_user_id = ${U}`)))
}
