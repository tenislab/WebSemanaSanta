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
    // Se dice en voz alta. Quien lea el resultado tiene que saber que esta
    // parte no se ha comprobado, no creer que ha pasado.
    caso('SIN POSTGRES: esta prueba NO se ha ejecutado (arranca uno en el ' +
      `puerto ${PUERTO} para comprobar el SQL de verdad)`, true, true)
    return
  }

  // Base limpia en cada pasada: si se arrastrara lo de antes, un fallo nuevo
  // podría quedar tapado por una tabla que ya estaba bien.
  await sql('drop schema if exists public cascade; create schema public;')

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
    ['una papeleta personalizada', `insert into opciones_papeleta
       (id, nombre, importe, etiqueta, orden, hermandad_id)
       values (gen_random_uuid(), 'Mantilla', 10, null, 0, ${H})`],
    // Y una que SÍ ocupa puesto: «nazareno cirio» no es simbólica, camina.
    ['una papeleta personalizada con puesto en el cortejo', `insert into opciones_papeleta
       (id, nombre, importe, etiqueta, orden, tramo_id, hermandad_id)
       values (gen_random_uuid(), 'Nazareno de cirio', 10, null, 1, ${T}, ${H})`],
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
}
