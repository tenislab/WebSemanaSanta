/**
 * GUARDAR UN CENSO GRANDE SIN MIL DOSCIENTAS PETICIONES.
 *
 * Todo lo que se guarda pasa por `sincronizar`, y ahí había tres cosas que solo
 * se notan con datos de verdad:
 *
 *   · El BORRADO va en la DIRECCIÓN (`.in('id', […])`). Un identificador es un
 *     UUID de 36 caracteres: doscientos son unos ocho mil de URL, justo el tope
 *     de fábrica de casi cualquier servidor o proxy. De cien van cuatro mil.
 *   · El ALTA en una sola petición se cae entera si la base rechaza UNA fila:
 *     de seiscientas no entra ninguna.
 *   · Y las MODIFICACIONES iban de una en una. Volver a importar un censo de
 *     mil doscientos para actualizarlo —un botón, y ahora está en Ajustes— son
 *     mil doscientas peticiones seguidas: minuto y medio con la pantalla
 *     diciendo que ya está guardado, y quien cambie de sección a la mitad deja
 *     la mitad de las fichas sin actualizar y sin aviso.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/lib/supabaseSync.ts', 'utf8')

  caso('el borrado va a trozos, y más cortos', true,
    /const DE_UNA_VEZ_BORRAR = 100/.test(src))
  caso('y se usan al borrar', true,
    /trozos\(eliminados, DE_UNA_VEZ_BORRAR\)/.test(src))
  caso('el alta va a trozos', true, /for \(const parte of trozos\(nuevos\)\)/.test(src))
  /*
   * --- Y LAS MODIFICACIONES, QUE TIENEN TRAMPA ---
   *
   * Lo obvio para no ir de una en una es `upsert`, que hace lo mismo que
   * `update` cuando la fila ya existe. Y NO SE PUEDE.
   *
   * PostgREST lo manda como `insert … on conflict do update`, y Postgres
   * comprueba la política de INSERCIÓN aunque acabe actualizando. El hermano
   * tiene permiso para cambiar SU ficha (`hermanos_propio_update`) y no tiene
   * ninguno para crear hermanos —ni debe tenerlo—, así que con `upsert`
   * dejaría de poder cambiar su propio correo o su contraseña desde su área,
   * con un «no tienes permiso» que no viene a cuento.
   *
   * Se quedan de una en una y se lanzan de seis en seis: mil doscientas
   * esperas pasan a doscientas, y cada fallo sigue diciendo QUÉ fila ha sido.
   */
  caso('las modificaciones NO van por upsert', false, /\.upsert\(/.test(src))
  caso('van de seis en seis', true, /const A_LA_VEZ = 6/.test(src))
  caso('y en paralelo dentro de cada tanda', true,
    /await Promise\.all\(posiblesCambios\.slice\(i, i \+ A_LA_VEZ\)/.test(src))
  // El fallo sigue nombrando la fila, que es más de lo que diría un envío en bloque.
  caso('un fallo dice qué fila ha sido', true, /`guardar \$\{item\.id\}`/.test(src))

  /*
   * Y que la política que lo impide siga siendo la que es: si algún día se le
   * diera al hermano permiso de inserción sobre `hermanos`, eso sería un
   * problema mucho mayor que el de las peticiones.
   */
  const { readFile: leerSql } = await import('node:fs/promises')
  const sql = await leerSql('supabase/TODO-EN-UNO.sql', 'utf8')
  caso('el hermano puede cambiar su ficha', true, /create policy "hermanos_propio_update" on hermanos for update/.test(sql))
  caso('y NO puede crear hermanos', false, /create policy "hermanos_propio_insert" on hermanos for insert/.test(sql))

  // Y que cada fallo siga contándose: troceado sin avisar es peor que sin
  // trocear, porque lo que no entra no lo sabe nadie.
  for (const op of ['borrar', 'crear', 'guardar']) {
    caso(`un fallo al ${op} se anota`, true, new RegExp(`anotar\\('${op}'`).test(src))
  }
}
