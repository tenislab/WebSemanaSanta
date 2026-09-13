/**
 * LOS DOCUMENTOS QUE LLEVAN NÚMEROS DENTRO, VIGILADOS.
 *
 * ============================================================================
 * POR QUÉ ESTO EXISTE
 * ============================================================================
 *
 * `COMO-TRABAJAR.md` lo dice con estas palabras: «Un documento en prosa no se
 * puede vigilar: solo queda la disciplina». Es verdad de la prosa. NO es verdad
 * de los datos concretos que un documento cita del código.
 *
 * Y esos son justo los que hacen daño. `LA-TARDE-DE-SUPABASE.md` es una lista
 * para ejecutar con el ratón, y dice «`version_del_esquema()` tiene que decir
 * 70». El día que suba a 71 —y sube sola con cualquier cambio en una pieza de
 * SQL— ese documento manda a alguien a buscar un problema que no existe: pega
 * el SQL, ve un 71 donde el papel dice 70, y se pone a investigar una avería
 * inventada. Un documento que miente de forma comprobable es peor que no
 * tenerlo.
 *
 * Aquí se comprueba SOLO lo comprobable: los números y los nombres que el
 * documento copia de otro sitio. La prosa sigue siendo cosa de la disciplina.
 *
 * `COBROS-LO-QUE-FALTA.md` es el aviso de lo que pasa si no: daba por
 * pendientes cuatro cosas hechas desde meses antes, y el plan de trabajo que
 * salía de él era entero sobre problemas que no existían.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')

  const tarde = await readFile('docs/LA-TARDE-DE-SUPABASE.md', 'utf8')
  const { version } = JSON.parse(await readFile('supabase/VERSION.json', 'utf8'))

  /*
   * LA VERSIÓN DEL ESQUEMA, que es el número que se teclea en el SQL Editor y
   * se compara con lo que devuelve la base. Sale dos veces: en el paso 1 y en
   * la tabla del final.
   */
  const vecesQueSaleLaVersion = (tarde.match(new RegExp(`\\b${version}\\b`, 'g')) ?? []).length
  caso('la tarde de Supabase dice la versión de hoy', true, vecesQueSaleLaVersion >= 2)
  // Y que no cite OTRA versión: un documento con las dos es peor que con una mal.
  const otrasVersiones = [...tarde.matchAll(/dice (\d+)/g)].map((m) => Number(m[1]))
  caso('y no cita ninguna otra', [], otrasVersiones.filter((v) => v !== version))

  /*
   * LAS CUATRO TAREAS PROGRAMADAS, por su nombre. El documento las lista en una
   * tabla con su hora, y lo que se pide luego es `select jobname from cron.job`:
   * si un nombre no coincide, la comprobación de «ha salido bien» no se puede
   * hacer.
   */
  const sql = await readFile('supabase/tareas-programadas.sql', 'utf8')
  const tareasDelSql = [...new Set([...sql.matchAll(/'(gobergo-[a-z-]+)'/g)].map((m) => m[1]))].sort()
  const tareasDelDoc = [...new Set([...tarde.matchAll(/`(gobergo-[a-z-]+)`/g)].map((m) => m[1]))].sort()
  caso('están las cuatro tareas programadas', 4, tareasDelSql.length)
  caso('y el documento nombra exactamente esas', tareasDelSql, tareasDelDoc)

  /*
   * Y SUS HORAS. Un cron mal copiado manda a mirar los registros a una hora en
   * la que no ha pasado nada.
   */
  const horaDeCron = (cron) => {
    const [m, h] = cron.split(' ')
    return `${h}:${m.padStart(2, '0')}`
  }
  const horasDelSql = [...sql.matchAll(/'(gobergo-[a-z-]+)',\s*(?:--[^\n]*\n\s*)*'([^']+)'/g)]
    .map(([, nombre, cron]) => `${nombre} ${horaDeCron(cron)}`)
  caso('se leen las cuatro horas del SQL', 4, horasDelSql.length)
  const horasQueFaltan = horasDelSql.filter(([]) => true).filter((par) => {
    const [nombre, hora] = par.split(' ')
    const fila = tarde.split('\n').find((l) => l.includes(`\`${nombre}\``))
    return !fila || !fila.includes(hora)
  })
  caso('y el documento las dice todas bien', [], horasQueFaltan)

  /*
   * EL IDENTIFICADOR DE ACREEDOR DEL EJEMPLO. `LOS-DOS-TRAMITES.md` lo enseña
   * descompuesto pieza a pieza para explicar de dónde sale cada trozo. Si el
   * del dibujo no fuera válido de verdad, el documento estaría enseñando a
   * escribir uno que el banco rechaza.
   */
  const tramites = await readFile('docs/LOS-DOS-TRAMITES.md', 'utf8')
  const nif = await cargar('src/lib/nif.ts')
  const delDibujo = tramites.match(/^ES (\d\d) (\d{3}) ([A-Z0-9]{9})$/m)
  caso('el dibujo del identificador está en el documento', true, delDibujo !== null)
  if (delDibujo) {
    const entero = `ES${delDibujo[1]}${delDibujo[2]}${delDibujo[3]}`
    caso('y el identificador que dibuja es válido', true, nif.identificadorAcreedorValido(entero))
    caso('y es el que le toca a ese NIF', entero, nif.identificadorQueLeToca(delDibujo[3], delDibujo[2]))
  }
}
