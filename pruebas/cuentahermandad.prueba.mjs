/**
 * LAS DOS MITADES TIENEN QUE DAR EL MISMO NOMBRE DE CUENTA.
 *
 * La cuenta de un hermano se llama por dentro «DNI + hermandad», y ese nombre
 * lo escriben DOS SITIOS DISTINTOS:
 *
 *   · `correoDeAcceso()` en la aplicación, AL CREAR la cuenta;
 *   · `correo_de_acceso()` en el SQL, que es lo que se guarda en la ficha.
 *
 * Y lo lee un tercero: `resolver_email_hermano`, cuando esa persona entra.
 *
 * SI LAS DOS NO DIERAN EXACTAMENTE LO MISMO, la cuenta se crearía con un nombre
 * y se buscaría con otro: esa persona no podría entrar NUNCA, y el mensaje que
 * vería sería «DNI o contraseña incorrectos», que apunta justo al sitio
 * equivocado. Es la clase de fallo que se descubre en marzo.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const accesos = await cargar('src/lib/accesos.ts')
  const sql = await readFile('supabase/cuenta-por-hermandad.sql', 'utf8')

  const HD = 'a1a1a1a1-0000-0000-0000-0000000000a1'

  // Lo que hace la aplicación.
  caso('el nombre de la cuenta lleva el DNI y la hermandad',
    '11223344C.a1a1a1a10000@acceso.gobergo.com',
    accesos.correoDeAcceso(HD, '11223344C'))

  /*
   * Y DA IGUAL CÓMO SE ESCRIBA EL DNI. En medio censo importado está con puntos
   * y guion, porque es como viene en la tarjeta. Si el nombre de la cuenta
   * cambiara según eso, corregir un DNI en la ficha dejaría a esa persona
   * fuera.
   */
  caso('con puntos y guion sale el mismo',
    accesos.correoDeAcceso(HD, '11223344C'), accesos.correoDeAcceso(HD, '11.223.344-C'))
  caso('en minúsculas también',
    accesos.correoDeAcceso(HD, '11223344C'), accesos.correoDeAcceso(HD, '11223344c'))
  caso('y con espacios de por medio',
    accesos.correoDeAcceso(HD, '11223344C'), accesos.correoDeAcceso(HD, ' 11 223 344 C '))

  // Dos hermandades, dos cuentas. Es de lo que va todo esto.
  caso('la misma persona en otra hermandad tiene otra cuenta', false,
    accesos.correoDeAcceso(HD, '11223344C')
      === accesos.correoDeAcceso('b2b2b2b2-0000-0000-0000-0000000000b2', '11223344C'))

  /*
   * --- QUE EL SQL HAGA LO MISMO ---
   *
   * No se puede ejecutar el SQL desde aquí, así que se comprueba que las dos
   * piezas que forman el nombre son las mismas: el DNI limpio en mayúsculas, y
   * los DOCE primeros caracteres del id de la hermandad sin guiones. Si alguien
   * cambia una de las dos y no la otra, esto salta.
   */
  const enSql = sql.match(/create or replace function correo_de_acceso\([\s\S]*?\$\$;/)?.[0] ?? ''
  caso('el SQL existe', true, enSql.length > 0)
  caso('el SQL limpia el DNI igual', true, /\[\^A-Za-z0-9\]/.test(enSql) && /upper\(/.test(enSql))
  caso('coge los mismos doce caracteres', true, /left\(replace\(p_hermandad_id::text, '-', ''\), 12\)/.test(enSql))
  caso('y el mismo dominio', true, /@acceso\.gobergo\.com/.test(enSql))
  const enApp = (await readFile('src/lib/accesos.ts', 'utf8'))
    .match(/export function correoDeAcceso[\s\S]*?\n\}/)?.[0] ?? ''
  caso('la aplicación coge los mismos doce', true, /\.slice\(0, 12\)/.test(enApp))
  caso('y usa el mismo dominio', true, /@acceso\.gobergo\.com/.test(enApp))

  await loQueNoPuedeRomperse({ caso, readFile })
}

/**
 * Y LO QUE NO SE PUEDE ROMPER AL HACER ESTO.
 *
 * Son dos cosas, y las dos dejarían a gente fuera de su área:
 *
 *   1. Quien YA tiene cuenta entra con su correo de siempre. Su `correo_acceso`
 *      está a null y `resolver_email_hermano` se cae a `email`. Sin ese
 *      `coalesce`, el día de la actualización se quedarían fuera TODOS los
 *      hermanos que ya estaban dentro.
 *   2. El nombre de la cuenta se GUARDA en la ficha al crearla. Si se creara y
 *      no se apuntara, la pantalla de entrar no lo encontraría a partir del DNI
 *      y esa persona no entraría nunca — con la cuenta existiendo.
 */
async function loQueNoPuedeRomperse({ caso, readFile }) {
  const sql = await readFile('supabase/cuenta-por-hermandad.sql', 'utf8')
  const accesos = await readFile('src/lib/accesos.ts', 'utf8')

  caso('quien ya tiene cuenta entra con su correo de siempre', true,
    /coalesce\(nullif\(correo_acceso, ''\), nullif\(email, ''\)\)/.test(sql))

  caso('el nombre de la cuenta se devuelve para guardarlo', true,
    /correoAcceso: r\.id && hermandadId \? usuario : null/.test(accesos))

  // Y se guarda en TODOS los sitios que crean una cuenta de hermano. Basta con
  // que uno se olvide para que esa gente no entre.
  const sitios = [
    ['src/pages/app/Hermanos.tsx', 2],
    ['src/pages/app/Personal.tsx', 2],
  ]
  for (const [fichero, cuantos] of sitios) {
    const src = await readFile(fichero, 'utf8')
    const veces = (src.match(/correoAcceso/g) ?? []).length
    caso(`${fichero} guarda el nombre de la cuenta`, true, veces >= cuantos)
  }
  const envio = await readFile('src/lib/enviarAcceso.ts', 'utf8')
  caso('y el envío en tanda también lo devuelve', true, /correoAcceso: acceso\.correoAcceso/.test(envio))

  /*
   * --- Y LA RECUPERACIÓN DE CONTRASEÑA ---
   *
   * Es lo que obligaba a hacer esto entero: la de Supabase manda el correo a la
   * dirección de la cuenta, que con este cambio no recibe nada. Sin la nuestra,
   * cada hermano nuevo se queda sin poder recuperar su acceso.
   */
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  caso('ya no se le pide a Supabase que mande el correo', false,
    /resetPasswordForEmail/.test(portal))
  caso('lo manda la función, con el correo de la ficha', true,
    /await pedirRecuperacion\(hermandadElegida\.id, dni\)/.test(portal))
  caso('y el enlace nuestro se atiende al llegar', true,
    /searchParams\.get\('recuperar'\)|URLSearchParams\(window\.location\.search\)\.get\('recuperar'\)/.test(portal))
  /*
   * Los enlaces VIEJOS de Supabase siguen funcionando: los hermanos que ya
   * tenían cuenta los usan, y quitarlos les dejaría sin recuperación justo el
   * día de la actualización.
   */
  caso('y los enlaces de antes siguen valiendo', true, /supabase\.auth\.updateUser\(\{ password: nueva \}\)/.test(portal))
}
