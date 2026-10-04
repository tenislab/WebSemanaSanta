/**
 * ENSAYAR `ACTUALIZAR.sql` DESDE TODOS LOS ESTADOS INTERMEDIOS.
 *
 * ============================================================================
 * QUÉ HUECO TAPA
 * ============================================================================
 *
 * `pruebas/actualizardesdevieja.prueba.mjs` ya hace lo más importante: instala
 * dos instaladores ANTIGUOS DE VERDAD —guardados tal cual— y les pasa el
 * `ACTUALIZAR.sql` de hoy por encima, dos veces, comparando el catálogo
 * resultante con el de una instalación nueva.
 *
 * Pero los dos guardados son la versión **sin sello** y la **62**, y hoy el
 * esquema va por la **74**. O sea que están probados los dos extremos —una base
 * muy vieja y una base al día— y NO las de en medio. Y la base de una hermandad
 * que lleva meses funcionando está, justamente, en medio.
 *
 * El riesgo no es teórico: lo que rompe una actualización no es una pieza
 * nueva, es una pieza nueva CHOCANDO con lo que ya dejó puesto una anterior
 * («cannot change return type of existing function» llegó dos veces a
 * producción con las pruebas en verde). Ese choque depende de QUÉ prefijo de
 * piezas tenga la base, y cada versión intermedia es un prefijo distinto.
 *
 * ============================================================================
 * CÓMO LO HACE
 * ============================================================================
 *
 * No hacen falta más instaladores guardados: el generador sabe la lista de
 * piezas y su orden (`PIEZAS` en `scripts/generar-todo-en-uno.mjs`). Así que
 * una base «como estaba en la versión N» se consigue pegando solo las N
 * primeras piezas.
 *
 * Para cada prefijo:
 *
 *   1. Base limpia con lo que pone Supabase (esquemas `auth`, `storage`…).
 *   2. Se pegan las N primeras piezas → eso es la base de esa época.
 *   3. Se siembra una hermandad con datos, para ver que no se pierden.
 *   4. Se pega `ACTUALIZAR.sql`. Y OTRA VEZ, porque la cabecera lo promete.
 *   5. Se compara el catálogo con el de instalar hoy desde cero: tiene que ser
 *      IDÉNTICO. «Sin error» no es «bien» — a una base del 29 de agosto le
 *      faltaba un `default` y nadie se enteró hasta que se midió.
 *   6. Y que los datos sembrados sigan ahí.
 *
 * ============================================================================
 * POR QUÉ ESTO ES UN GUION Y NO UNA PRUEBA
 * ============================================================================
 *
 * Son setenta y una piezas: ensayarlas todas son setenta y una instalaciones
 * completas más dos actualizaciones cada una. Eso no puede estar en `npm test`,
 * que tiene que seguir corriendo en cien segundos.
 *
 * Se ejecuta a mano ANTES DE UNA TARDE DE SUPABASE, que es cuando importa:
 *
 *     PGHOST=/tmp PGPORT=5433 node scripts/ensayar-la-actualizacion.mjs
 *     PGHOST=/tmp PGPORT=5433 node scripts/ensayar-la-actualizacion.mjs 8
 *
 * El número es cada cuántas piezas se prueba un prefijo (por defecto 1, o sea
 * todas). Con 8 son nueve ensayos y tarda un minuto: sirve para el día a día.
 * Sin número, no se queda nada sin mirar.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  PUERTO, hayPostgres, sql, baseLimpia, fotoDelCatalogo, diferenciaDeFotos, loQueDijoPostgres,
} from '../pruebas/postgres.mjs'
import { PIEZAS } from './generar-todo-en-uno.mjs'

const HDAD = 'eeeeeeee-0000-0000-0000-000000000001'

/*
 * LO QUE SE SIEMBRA. Poco y de tablas que existen desde el principio: la
 * siembra tiene que funcionar en la base de la pieza 5 igual que en la de la
 * pieza 70, porque si no, el ensayo falla por la siembra y no por lo que mide.
 */
const SIEMBRA = `
  insert into hermandades (id, nombre) values ('${HDAD}', 'Ensayo')
    on conflict (id) do nothing;
  /*
   * «clave_acceso» VA EN LA SIEMBRA aunque hoy no se use, y esto lo enseñó el
   * propio ensayo: en las versiones de antes la columna era NOT NULL —guardaba
   * la contraseña del hermano en claro, que es justo lo que se quitó— así que
   * sin ella la siembra reventaba en los prefijos de en medio y el ensayo se
   * quedaba sin medir ahí. Hoy la columna sigue existiendo y se manda vacía.
   *
   * (Y el comentario va con comillas y no con acentos graves: esto está DENTRO
   *  de una plantilla de JavaScript, y un acento grave la cierra. Pasó.)
   */
  insert into hermanos (id, hermandad_id, numero, nombre, estado, antiguedad, email, dni, clave_acceso)
  values
    ('eeeeeeee-1111-0000-0000-000000000001', '${HDAD}', 1, 'Uno de ensayo', 'Activo', 1990, 'uno@ensayo.test', '00000001R', ''),
    ('eeeeeeee-1111-0000-0000-000000000002', '${HDAD}', 2, 'Dos de ensayo', 'Activo', 1995, 'dos@ensayo.test', '00000002W', '')
  on conflict (id) do nothing;
`
const LO_QUE_HAY = `select count(*) from hermanos where hermandad_id = '${HDAD}'`

const raiz = new URL('..', import.meta.url).pathname

if (!(await hayPostgres())) {
  console.error(`No hay Postgres en el puerto ${PUERTO}. Arranca uno y vuelve.`)
  process.exit(2)
}

const salto = Number(process.argv[2] ?? 1)
const actualizar = await readFile(join(raiz, 'supabase/ACTUALIZAR.sql'), 'utf8')
const instaladorDeHoy = await readFile(join(raiz, 'supabase/TODO-EN-UNO.sql'), 'utf8')

/* La foto de referencia: instalar hoy desde cero. Es contra lo que se compara. */
console.log('Instalando hoy desde cero, para tener contra qué comparar…')
await baseLimpia()
await sql(instaladorDeHoy)
const fotoNueva = await fotoDelCatalogo()
console.log(`  catálogo de referencia: ${fotoNueva.split('\n').length} líneas\n`)

/*
 * DESDE DÓNDE TIENE SENTIDO ENSAYAR.
 *
 * `hermandades` la crea `multi-hermandad.sql`, y antes de esa pieza no hay a
 * qué colgar un hermano: la siembra no puede ni empezar. No es un fallo de la
 * actualización y tampoco es un estado en el que haya estado ninguna hermandad
 * —la frontera entre hermandades es anterior a que hubiera hermandades de
 * verdad—, así que esos prefijos no se ensayan y se dice cuántos van fuera.
 *
 * Se busca la pieza por su nombre y no por su número: mover una pieza de sitio
 * en `PIEZAS` es algo que pasa, y un número a mano se queda viejo callado.
 */
const primeraUtil = PIEZAS.findIndex(([f]) => f === 'multi-hermandad.sql') + 1
const prefijos = []
for (let n = primeraUtil; n < PIEZAS.length; n += salto) prefijos.push(n)
if (prefijos[prefijos.length - 1] !== PIEZAS.length - 1) prefijos.push(PIEZAS.length - 1)

console.log(
  `${prefijos.length} ensayos, de la pieza ${primeraUtil} a la ${PIEZAS.length - 1}, `
  + `una de cada ${salto}. Las ${primeraUtil - 1} primeras quedan fuera: todavía no existe `
  + '«hermandades» y no hay nada que sembrar.\n',
)

let fallados = 0
for (const n of prefijos) {
  const hasta = PIEZAS[n - 1][0]
  const etiqueta = `${String(n).padStart(2)} piezas (hasta ${hasta})`

  let trozos = ''
  for (const [fichero] of PIEZAS.slice(0, n)) {
    trozos += await readFile(join(raiz, 'supabase', fichero), 'utf8') + '\n'
  }

  await baseLimpia()
  let paso = 'instalar lo de esa época'
  let fallo = ''
  let datosAntes = null
  try {
    await sql(trozos)
    paso = 'sembrar'
    await sql(SIEMBRA)
    datosAntes = (await sql(LO_QUE_HAY)).trim()
    paso = 'actualizar'
    await sql(actualizar)
    paso = 'actualizar otra vez'
    await sql(actualizar)
    paso = 'ok'
  } catch (e) {
    fallo = loQueDijoPostgres(e).slice(0, 400)
  }

  if (paso !== 'ok') {
    /*
     * UN FALLO AL INSTALAR EL PREFIJO NO ES UN FALLO DE LA ACTUALIZACIÓN, y
     * distinguirlo importa: media lista de piezas no es una versión que haya
     * existido nunca —hay piezas que dependen de otra que va DESPUÉS en la
     * lista— y eso no le pasa a ninguna hermandad. Lo que se busca aquí es que
     * falle «actualizar», que sí le pasaría.
     */
    const culpa = paso === 'instalar lo de esa época' || paso === 'sembrar'
      ? `no es de la actualización (ese prefijo no se instala solo: salta) — ${fallo.slice(0, 160)}`
      : 'LA ACTUALIZACIÓN'
    const grave = culpa === 'LA ACTUALIZACIÓN'
    if (grave) fallados += 1
    console.log(`${grave ? '✗' : '·'} ${etiqueta} — falla en «${paso}»: ${culpa}`)
    if (grave) console.log(`    ${fallo}`)
    continue
  }

  const diferencia = diferenciaDeFotos(await fotoDelCatalogo(), fotoNueva)
  const datosDespues = (await sql(LO_QUE_HAY)).trim()
  const mismoCatalogo = diferencia.soloEnA.length === 0 && diferencia.soloEnB.length === 0
  const mismosDatos = datosAntes === datosDespues

  if (mismoCatalogo && mismosDatos) {
    console.log(`✓ ${etiqueta}`)
  } else {
    fallados += 1
    console.log(`✗ ${etiqueta}`)
    if (!mismoCatalogo) {
      console.log(`    sobra en la actualizada: ${diferencia.soloEnA.slice(0, 5).join(' · ') || '—'}`)
      console.log(`    falta en la actualizada: ${diferencia.soloEnB.slice(0, 5).join(' · ') || '—'}`)
    }
    if (!mismosDatos) console.log(`    los datos han cambiado: ${datosAntes} → ${datosDespues}`)
  }
}

console.log(`\n${prefijos.length - fallados}/${prefijos.length} ensayos buenos.`)
if (fallados > 0) {
  console.log('Hay estados desde los que ACTUALIZAR.sql no deja la base como la de hoy.')
  process.exit(1)
}
console.log('ACTUALIZAR.sql deja la base igual que una instalación nueva desde todos ellos.')
