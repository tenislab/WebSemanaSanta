/**
 * QUE EL VIGILANTE DE ERRORES NO SE LLEVE POR DELANTE UN DATO PERSONAL.
 *
 * Guardar los fallos sirve para arreglarlos. Lo que NO puede pasar es que, por
 * contar un fallo, acabe en una tabla el nombre, el DNI o el correo de un
 * hermano. Un mensaje de Postgres puede traer dentro el valor que se intentaba
 * guardar, así que el riesgo es real y no teórico.
 *
 * `limpiarMensaje()` es la pieza que corta esa vía, y por eso se prueba a
 * conciencia. Lo demás del módulo son eventos del navegador que aquí no
 * existen; lo que se comprueba de ellos es que estén enganchados, mirando el
 * código.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/vigilancia.ts')
  const l = m.limpiarMensaje

  // --- LO QUE SE BORRA ---
  caso('los identificadores se quitan',
    'no existe la fila ‹id›',
    l('no existe la fila 7f3a91b2-4c5d-4e6f-8a9b-0c1d2e3f4a5b'))
  /*
   * Y ESTO ES LO QUE HACE ÚTIL LA TABLA, no solo lo que la hace segura: con el
   * identificador dentro, el mismo fallo repetido ochenta veces son ochenta
   * filas distintas y no hay forma de ver que ha pasado ochenta veces.
   */
  caso('así que dos veces el mismo fallo son el mismo texto', true,
    l('falla 7f3a91b2-4c5d-4e6f-8a9b-0c1d2e3f4a5b')
    === l('falla 2b915c3d-1111-2222-3333-444455556666'))

  caso('las direcciones se quitan', 'fetch a ‹url› falló',
    l('fetch a https://abcdefg.supabase.co/rest/v1/hermanos?dni=eq.12345678Z falló'))
  caso('los correos se quitan', 'no se pudo avisar a ‹correo›',
    l('no se pudo avisar a maria.lopez@gmail.com'))
  caso('los números largos se quitan', 'importe ‹n› céntimos', l('importe 123456 céntimos'))
  /*
   * LOS VALORES ENTRE COMILLAS SIMPLES. Postgres escribe así lo que se
   * intentaba guardar: `duplicate key value violates ... (dni)=('12345678Z')`.
   */
  caso("lo que va entre comillas simples se quita", "el valor '…' ya existe",
    l("el valor '12345678Z' ya existe"))

  // --- LO QUE **NO** SE BORRA, QUE IMPORTA IGUAL ---
  /*
   * Postgres nombra las tablas y las columnas entre comillas DOBLES, y eso es
   * justamente lo que hace útil el mensaje: sin «fecha_baja» ahí, el aviso no
   * dice nada. Si algún día alguien amplía la limpieza a las comillas dobles,
   * esta prueba se lo dice.
   */
  caso('el nombre de la columna se conserva', true,
    l('column "fecha_baja" does not exist').includes('"fecha_baja"'))
  caso('y el del error también', true,
    l('new row violates row-level security policy for table "hermanos"').includes('"hermanos"'))
  // Un año no es un número largo cualquiera: sitúa el fallo y no identifica a nadie.
  caso('los años se quedan', true, l('el ejercicio 2026 no existe').includes('2026'))

  // --- Y NO REVIENTA CON NADA ---
  caso('sin texto no revienta', '', l(''))
  caso('con nulo tampoco', '', l(null))
  caso('un mensaje larguísimo se recorta', 500, l('x'.repeat(5000)).length)

  // --- LAS REGLAS QUE NO SE PUEDEN PROBAR EJECUTANDO ---
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/lib/vigilancia.ts', 'utf8')

  /*
   * REGLA 2: NO SE LLAMA A SÍ MISMO. Si mandar un error provoca un error, el
   * segundo no se manda. Sin esto, un fallo de red genera un fallo al
   * reportarlo, que genera otro, hasta agotar la pestaña.
   */
  caso('no se puede llamar a sí mismo', true, /if \(enviando\) return/.test(src))
  /* REGLA 3: el mismo mensaje una vez por sesión (un error de render se dispara 60 veces por segundo). */
  caso('no repite el mismo fallo', true, /yaMandados\.has\(mensaje\)/.test(src))
  /* REGLA 4: y aun así, techo. */
  caso('y tiene techo', true, /cuantos >= TECHO_POR_SESION/.test(src))
  /* REGLA 5: nadie espera a que se guarde un error. */
  caso('no hace esperar a nadie', true, /void supabase/.test(src))
  // En la demostración no hay hermandad a la que atribuir nada.
  caso('en la demostración no manda nada', true, /if \(modoDemoActivo\(\)\) return/.test(src))

  /*
   * NO SE MANDA `hermandad_id` DESDE AQUÍ. Lo pone la base con
   * `default hermandad_actual()`: el navegador cree saber de qué hermandad es,
   * la base lo sabe de verdad.
   */
  caso('no manda la hermandad: la pone la base', false, /hermandad_id:/.test(src))
  // Ni el nombre ni el correo de nadie. Solo el cargo.
  caso('no manda el nombre de quien está', false, /nombre:/.test(src))
  caso('ni su correo', false, /email/.test(src))

  /*
   * Y SE ENGANCHA ANTES DE PINTAR NADA. Desde dentro de un componente llegaría
   * tarde justo para el error que deja la página en blanco, que es el único que
   * nadie va a poder contar a mano.
   */
  const main = await readFile('src/main.tsx', 'utf8')
  caso('se engancha en main.tsx', true, /^vigilar\(\)$/m.test(main))
  caso('y antes de pintar', true, main.indexOf('vigilar()') < main.indexOf('createRoot'))
}
