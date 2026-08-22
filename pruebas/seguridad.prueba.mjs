/**
 * LA DEUDA DE SEGURIDAD: contraseñas y registro de actividad.
 *
 * Tres cosas que llevaban ahí desde antes de los cargos y que había que cerrar
 * antes de que entren datos de una hermandad de verdad. Ochocientos DNI con
 * IBAN y notas de salud es categoría especial del RGPD por partida doble.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const sinComentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  // =========================================================================
  // 1. LA CONTRASEÑA INICIAL YA NO ES EL DNI
  // =========================================================================
  /*
   * Era su propio DNI, y el DNI está en su ficha. La cadena entera era:
   * alguien con un cargo cualquiera lee el censo → coge el correo y el DNI del
   * Hermano Mayor → entra como él → los trece módulos, incluido «Personal y
   * permisos», desde donde se reparten cargos a quien se quiera.
   */
  const { build } = await import('esbuild')
  const { tmpdir } = await import('node:os')
  const { mkdtempSync } = await import('node:fs')
  const { join } = await import('node:path')
  const destino = join(mkdtempSync(join(tmpdir(), 'gobergo-claves-')), 'c.mjs')
  await build({
    entryPoints: ['src/lib/claves.ts'],
    bundle: true, platform: 'node', format: 'esm', outfile: destino, logLevel: 'silent',
  })
  const { claveDeUnSoloUso, claveAdivinable } = await import(destino)

  const claves = Array.from({ length: 200 }, () => claveDeUnSoloUso())
  caso('todas distintas', 200, new Set(claves).size)
  caso('con la forma de siempre', true, /^[A-Z]{4}-[0-9]{4}-[A-Z]{4}$/.test(claves[0]))
  /*
   * Sin las que se confunden al dictarlas por teléfono: ni O ni 0, ni I ni l
   * ni 1. Una contraseña que se dicta mal acaba en una llamada a secretaría.
   */
  caso('sin letras ni números que se confundan', false, /[O0Il1]/.test(claves.join('')))
  // Y con azar de verdad, no `Math.random()`.
  const fuente = await readFile('src/lib/claves.ts', 'utf8')
  caso('el azar es criptográfico', true, /crypto\.getRandomValues/.test(fuente))
  caso('y no Math.random', false, /Math\.random/.test(sinComentar(fuente)))

  caso('el DNI se reconoce como adivinable', true, claveAdivinable('12345678A', '12345678-A'))
  caso('una de un solo uso, no', false, claveAdivinable(claves[0], '12345678A'))

  // Los dos sitios que dan de alta la usan, y ninguno pone ya el DNI.
  const hermanos = sinComentar(await readFile('src/pages/app/Hermanos.tsx', 'utf8'))
  caso('el alta a mano usa una contraseña de un solo uso', true,
    /claveDeUnSoloUso\(\)/.test(hermanos))
  caso('y ya no usa el DNI como contraseña', false,
    /crearAccesoHermano\(email, dni, dni,/.test(hermanos))

  // =========================================================================
  // 2. LA CONTRASEÑA YA NO SE GUARDA NI SE ENSEÑA
  // =========================================================================
  /*
   * `clave_acceso` guardaba la contraseña TAL CUAL dentro de la tabla, y la
   * ficha la imprimía en pantalla: bastaba con abrirla para poder entrar como
   * esa persona. No hacía falta para nada — la de verdad vive cifrada en
   * Supabase Auth y es la que comprueba `signInWithPassword`.
   */
  const mapeo = sinComentar(await readFile('src/lib/db/hermanos.ts', 'utf8'))
  caso('la contraseña no viaja a la base', true, /clave_acceso: ''/.test(mapeo))
  caso('ni se lee de ella', true, /claveAcceso: ''/.test(mapeo))
  caso('la ficha ya no la imprime', false, /<code>\{selected\.claveAcceso\}<\/code>/.test(hermanos))

  // Y en la base se vacía lo que ya hubiera guardado.
  const sql = await readFile('supabase/seguridad-claves-y-registro.sql', 'utf8')
  caso('se vacían las que ya estaban guardadas', true,
    /update hermanos set clave_acceso = ''/.test(sql))
  caso('también las del personal', true, /update personal set clave = ''/.test(sql))
  /*
   * La columna NO se borra, y es a propósito: si se borrara, la versión
   * anterior de la web fallaría al guardar con «column does not exist». Y si
   * se dejara `not null`, la nueva fallaría por lo contrario. Vaciándola y
   * dejándola opcional funcionan las dos mientras dura el cambio.
   */
  caso('la columna se deja opcional, no se borra', true,
    /alter column clave_acceso drop not null/.test(sql))
  caso('con valor por defecto para la versión nueva', true,
    /alter column clave_acceso set default ''/.test(sql))
  caso('y queda escrito cómo borrarla del todo después', true,
    /drop column if exists clave_acceso/.test(sql))

  // La importación masiva ponía LA MISMA a las ochocientas fichas del Excel.
  const imp = sinComentar(await readFile('src/lib/importar.ts', 'utf8'))
  caso('la importación ya no pone una contraseña para todos', false, /clavePorDefecto/.test(imp))
  const pantallaImp = sinComentar(await readFile('src/components/ImportarCenso.tsx', 'utf8'))
  caso('ni la pide la pantalla', false, /impClave/.test(pantallaImp))

  // =========================================================================
  // 3. EL REGISTRO DE ACTIVIDAD LO ESCRIBE LA BASE
  // =========================================================================
  /*
   * Lo escribía el NAVEGADOR, mandando el nombre del autor como texto libre.
   * Dos agujeros: un cambio hecho por fuera de la aplicación no dejaba rastro,
   * y quien tuviera cargo podía meter un apunte con el nombre de otro — que
   * además no se puede borrar, porque el propio fichero presume de eso.
   */
  caso('hay un disparador que apunta los cambios', true,
    /create or replace function apuntar_cambio\(\)/.test(sql))
  caso('el autor sale de auth.uid(), no del navegador', true,
    /quien := auth\.uid\(\)/.test(sql))
  caso('y se distingue de lo que apunta la aplicación', true, /'base'/.test(sql))
  caso('la columna que los separa existe', true,
    /add column if not exists origen text not null default 'app'/.test(sql))

  // Solo en las tablas que se preguntan en un cabildo: ponerlo en todas
  // llenaría el registro de ruido y dejaría de servir para encontrar nada.
  for (const tabla of ['hermanos', 'cuotas', 'papeletas', 'movimientos']) {
    caso(`se apunta lo que pasa en ${tabla}`, true,
      new RegExp(`'${tabla}'`).test(sql.slice(sql.indexOf('foreach t in array'))))
  }
  // Y no en el editor de la web, que sería un apunte por tecla.
  caso('no se apunta el editor de la web', false,
    /'web_publica'/.test(sql.slice(sql.indexOf('foreach t in array'), sql.indexOf('foreach t in array') + 300)))

  // Lo apuntado no se toca: sin política de update ni de delete, en Postgres
  // no se puede. Ni el titular puede reescribir la historia.
  const reg = await readFile('supabase/registro-actividad.sql', 'utf8')
  caso('no hay forma de modificar lo apuntado', false,
    /create policy[^\n]*on registro_actividad for (update|delete)/.test(reg))
}
