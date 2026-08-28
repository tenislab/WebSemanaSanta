/**
 * UNA CONSULTA DENEGADA NO PUEDE BORRAR LA PANTALLA NI LA COPIA LOCAL.
 *
 * Llegó dicho así: «registro una papeleta y se borran todos los datos», y
 * después «se ha solventado pero faltan datos».
 *
 * EL MECANISMO, que es lo que hay que entender para que no vuelva:
 *
 * RLS NO DA ERROR CUANDO DENIEGA. Devuelve CERO FILAS con `error` a nulo, y
 * eso es indistinguible de una tabla vacía. `useSupabaseTable` recarga en cada
 * `onAuthStateChange` —al refrescarse el token, o en cualquier vaivén de la
 * sesión—, y hay un instante en que `hermandad_actual()` todavía no resuelve y
 * TODAS las políticas deniegan a la vez.
 *
 * Con la rama de éxito tal como estaba, ese instante pintaba la pantalla vacía
 * Y machacaba la copia local con `[]`. Lo segundo es lo peor: `deReserva()`
 * tira de esa copia cuando la base no responde, así que se destruía la red de
 * seguridad justo antes de necesitarla.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/lib/supabaseSync.ts', 'utf8')

  // Se mira el CÓDIGO, sin comentarios: la explicación de por qué algo está
  // puesto no puede hacer pasar la prueba de que está puesto.
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  /*
   * 1. EL CERO SOSPECHOSO SE RECONOCE Y SE REINTENTA.
   */
  {
    caso('se mira si lo que llega está vacío', true, /traidos\.length === 0/.test(codigo))
    caso('y si aquí había algo', true, /const teniamos/.test(codigo))
    caso('se reintenta una vez', true, /reintentado\.current/.test(codigo))
    caso('con un segundo intento de verdad', true, /setTimeout\(\(\) => \{ if \(!cancelado\) cargar\(\)/.test(codigo))

    // Y lo importante: en ese caso NO se espeja ni se pinta.
    const rama = codigo.slice(codigo.indexOf('traidos.length === 0'), codigo.indexOf('reintentado.current = false'))
    caso('mientras se reintenta NO se espeja', false, /espejarEnLocal/.test(rama))
    caso('ni se vacía la pantalla', false, /setItemsState/.test(rama))
  }

  /*
   * 2. PERO UN VACIADO DE VERDAD SE TIENE QUE VER.
   *
   * Si alguien borra el censo entero desde otro ordenador, este se tiene que
   * enterar. Por eso se REINTENTA en vez de rechazarlo siempre: al segundo
   * intento, `reintentado` ya está puesto y el cero se acepta.
   */
  {
    caso('el reintento se marca antes de reintentar', true,
      codigo.indexOf('reintentado.current = true') < codigo.indexOf('cargar()', codigo.indexOf('reintentado.current = true')))
    caso('y se limpia al aceptar una carga', true, /reintentado\.current = false/.test(codigo))
    // La condición lleva el `!reintentado.current`, que es lo que hace que el
    // segundo cero pase. Sin eso, la pantalla no se vaciaría NUNCA.
    caso('el segundo cero se acepta', true, /&& !reintentado\.current/.test(codigo))
  }

  /*
   * 3. EL ÁREA DEL HERMANO SE QUEDA FUERA, y no es un olvido.
   *
   * Monta el hook con `sinEspejo`: no tiene copia local, y sus consultas SÍ
   * vienen vacías de verdad mientras no ha entrado —RLS solo le deja ver sus
   * filas—. Aplicarle el reintento sería duplicar cada consulta suya para
   * nada, en el móvil y con datos.
   */
  {
    caso('el guardia no se le aplica al hermano', true, /const teniamos = !sinEspejo/.test(codigo))
  }

  /*
   * 4. Y NO SE LEE LA `items` DEL CIERRE, que es un fallo que tuve escribiendo
   * esto mismo.
   *
   * El efecto solo se vuelve a montar cuando cambia `tabla`, así que la `items`
   * que se ve dentro es la del montaje —vacía— para siempre. Con ella, la
   * comprobación habría dicho «no teníamos nada» justo cuando más datos había,
   * y el guardia no habría servido de nada.
   */
  {
    caso('se usa una referencia viva', true, /itemsRef\.current\.length > 0/.test(codigo))
    caso('que se actualiza en cada pintada', true, /itemsRef\.current = items/.test(codigo))
    caso('y no la del cierre', false, /const teniamos[^\n]*[^s]items\.length/.test(codigo))
  }

  /*
   * 5. LO QUE YA ESTABA Y NO SE TOCA: la rama de ERROR sigue sin marcar
   * `cargado`. Es lo que evita que el primer cambio que haga la secretaría
   * dispare `sincronizar` comparando contra una lista que nunca vino de la
   * base — que sería borrar el censo entero en Supabase.
   */
  {
    const ramaError = codigo.slice(codigo.indexOf('if (error) {'), codigo.indexOf('} else {'))
    caso('la rama de error no da la carga por buena', false, /cargado\.current = true/.test(ramaError))
    caso('y tira de la copia local', true, /deReserva\(\)/.test(ramaError))
  }
}
