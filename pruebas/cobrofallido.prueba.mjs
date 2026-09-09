/**
 * LA TARJETA QUE FALLA, Y LA COLUMNA QUE NO SIGNIFICABA NADA.
 *
 * ============================================================================
 * QUÉ ARREGLA LO QUE ESTO VIGILA
 * ============================================================================
 *
 * El circuito de la suscripción atendía el ALTA y la BAJA, y se dejaba fuera
 * lo que pasa EN MEDIO, que es donde vive una suscripción de verdad: que se
 * cobre cada mes y que un día la tarjeta no pase.
 *
 * Conviene tener claro qué era el agujero y qué no, porque es fácil contarlo
 * mal. NO era acceso gratis para siempre: cuando Stripe no consigue cobrar,
 * cancela la suscripción y manda `customer.subscription.deleted`, que sí se
 * atendía. El agujero era que NADIE SE LO DECÍA A LA HERMANDAD. Se enteraba el
 * día que se quedaba fuera de golpe, sin un solo aviso previo — y si tocaba en
 * marzo, en la peor semana del año.
 *
 * Y de paso, `suscripciones.hasta` era una columna muerta: el webhook le
 * pasaba siempre `null` y la aplicación no la leía nunca. Un dato que parece
 * significar algo y no significa nada es peor que no tenerlo, porque el día
 * que alguien lo mire para decidir, decidirá sobre vacío.
 *
 * ----------------------------------------------------------------------------
 * QUÉ SE COMPRUEBA AQUÍ Y QUÉ NO
 * ----------------------------------------------------------------------------
 *
 * Aquí, que las piezas ESTÁN Y ENCAJAN: que el webhook atiende los dos
 * eventos, que llama a las funciones que existen de verdad, que no se le
 * conceden al navegador y que el aviso dice lo que tiene que decir.
 *
 * Que las funciones HAGAN lo que prometen —que un fallo no desactive la
 * suscripción, que el aviso se limpie solo al cobrar— se comprueba ejecutando
 * SQL de verdad, en `basedatos.prueba.mjs`. Son dos preguntas distintas y la
 * segunda no se puede contestar leyendo texto.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile('supabase/renovacion-y-fallo-de-cobro.sql', 'utf8')
  const hook = await readFile('supabase/functions/webhook-stripe/index.ts', 'utf8')

  // --- 1. EL WEBHOOK ATIENDE LOS DOS EVENTOS QUE FALTABAN ---
  caso('atiende el cobro del mes', true, /evento\.type === 'invoice\.paid'/.test(hook))
  caso('y el cobro que falla', true, /evento\.type === 'invoice\.payment_failed'/.test(hook))
  // Y los tres de antes siguen ahí: esto se añadió, no se sustituyó.
  for (const e of [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'customer.subscription.deleted',
  ]) {
    caso(`sigue atendiendo ${e}`, true, hook.includes(`'${e}'`))
  }

  /*
   * --- 2. LLAMA A FUNCIONES QUE EXISTEN ---
   *
   * Es el fallo más caro de este circuito y no da error en ningún sitio: el
   * webhook llamaría a una función que la base no tiene, PostgREST contestaría
   * 404, el webhook devolvería 502, Stripe reintentaría unas horas y se
   * rendiría. La hermandad se quedaría sin activar habiendo pagado, y en los
   * registros no habría más que un 404 que nadie mira.
   */
  const llamadas = [...hook.matchAll(/llamarRpc\(\s*'([a-z_0-9]+)'/g)].map((m) => m[1])
  const nuevas = llamadas.filter((f) => /por_stripe$/.test(f) && /renovar|fallido/.test(f))
  caso('llama a las dos funciones nuevas', 'marcar_pago_fallido_por_stripe,renovar_suscripcion_por_stripe',
    [...new Set(nuevas)].sort().join(','))
  for (const f of nuevas) {
    caso(`${f} está creada en el SQL`, true,
      new RegExp(`create (or replace )?function ${f}\\b`).test(sql))
  }

  /*
   * --- 3. UN FALLO DE COBRO NO CIERRA LA PUERTA ---
   *
   * La decisión de todo el archivo, y la que más fácil sería deshacer sin
   * querer «para que no usen la aplicación sin pagar». Stripe reintenta
   * durante semanas y casi siempre acaba cobrando: cortar en el primer fallo
   * dejaría sin papeletas a cuatrocientas personas por una tarjeta caducada.
   *
   * Se mira solo el cuerpo de esa función, no el fichero entero: `activa`
   * aparece a propósito en la de renovar, que es la que vuelve a abrir.
   */
  const cuerpo = (nombre) => (sql.match(
    new RegExp(`create (?:or replace )?function ${nombre}[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`),
  ) ?? ['', ''])[1]
  caso('marcar un cobro fallido no toca `activa`', false, /\bactiva\b/.test(cuerpo('marcar_pago_fallido_por_stripe')))
  caso('y guarda el PRIMER día del fallo', true, /coalesce\(pago_fallido_el/.test(cuerpo('marcar_pago_fallido_por_stripe')))
  // Al cobrar sí se reabre, y el aviso se borra solo.
  caso('cobrar vuelve a activar', true, /activa = true/.test(cuerpo('renovar_suscripcion_por_stripe')))
  caso('y limpia el aviso sin que nadie lo quite a mano', true,
    /pago_fallido_el = null/.test(cuerpo('renovar_suscripcion_por_stripe')))

  /*
   * --- 4. LA FECHA SALE DE LA LÍNEA DE LA FACTURA ---
   *
   * `lines.data[0].period.end` y no `period_end`: la primera factura de una
   * suscripción tiene su propio periodo, que es el trozo que se está cobrando
   * y no el de la suscripción. Con el campo equivocado, `hasta` diría una
   * fecha que no es — y volveríamos a tener un dato que miente, que es
   * exactamente lo que esto viene a arreglar.
   */
  /*
   * SE MIRA EL CÓDIGO SIN LOS COMENTARIOS, y esto no es un detalle. La primera
   * versión de esta comprobación buscaba «lines … period … end» en el fichero
   * entero y pasaba en verde con el código roto: lo que encontraba era el
   * comentario de encima, que menciona `lines.data[0].period.end` para
   * explicar por qué es ese y no otro. Una prueba que se conforma con que algo
   * esté BIEN EXPLICADO no comprueba nada.
   */
  const codigo = hook.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  caso('la fecha sale del periodo de la línea de la factura', true,
    /objeto\.lines[\s\S]{0,200}?period[\s\S]{0,40}?end/.test(codigo))
  // Y si no viene, no se inventa: se manda `null` y la base deja la que había.
  caso('sin fecha no se inventa una', true, /:\s*null/.test(
    (codigo.match(/const hasta =[\s\S]{0,200}/) ?? [''])[0]))

  /*
   * --- 5. NI RENOVARSE NI BORRARSE EL AVISO DESDE EL NAVEGADOR ---
   *
   * Serían literalmente dos botones para cualquiera con una sesión iniciada:
   * «renuévame la suscripción» y «bórrame el aviso de que no he pagado».
   *
   * Y HAY QUE QUITARLO EXPRESAMENTE, que es la trampa. Aquí estuvo escrito «no
   * se conceden a `authenticated`» dando por hecho que no poner un `grant`
   * bastaba. No basta: Postgres concede EXECUTE a `public` en cuanto se crea
   * la función, así que sin el `revoke` estaban abiertas — y el comentario
   * afirmaba justo lo contrario de lo que pasaba.
   *
   * Lo cazó la prueba que le pregunta al propio Postgres
   * (`has_function_privilege`, en `basedatos.prueba.mjs`). Leyendo el texto no
   * se veía, que es exactamente por lo que el comentario parecía razonable.
   * Esta de aquí es la mitad barata: que las dos líneas sigan escritas.
   */
  for (const f of new Set(nuevas)) {
    caso(`${f} se le quita a todo el mundo`, true,
      new RegExp(`revoke all on function ${f}\\([^)]*\\) from public, anon, authenticated;`).test(sql))
    caso(`y solo se le da al servidor`, true,
      new RegExp(`grant execute on function ${f}\\([^)]*\\) to service_role;`).test(sql))
  }
  // Y que a nadie se le ocurra concedérselas al navegador de otra forma.
  caso('a `authenticated` no se le concede ninguna', [],
    [...sql.matchAll(/grant execute on function ([a-z_0-9]+)\([^)]*\) to authenticated/g)]
      .map((m) => m[1])
      .filter((f) => /por_stripe$/.test(f)))

  /*
   * --- 6. Y LA COLUMNA LLEGA HASTA LA PANTALLA ---
   *
   * El fallo recurrente de esta aplicación es la media instalación: la mitad
   * visible funciona, la invisible falta, y no salta nada. Una columna que la
   * base tiene, la función devuelve y la aplicación no lee sería otro
   * `suscripciones.hasta`: un dato ahí puesto que no sirve para nada.
   *
   * Así que se sigue el hilo entero, eslabón por eslabón.
   */
  caso('la base la guarda', true, /add column if not exists pago_fallido_el/.test(sql))
  caso('`mi_suscripcion` la devuelve', true, /pago_fallido_el date/.test(sql))
  /*
   * Y se recrea con `drop` delante, no con `create or replace`: cambiar el
   * número de columnas que devuelve una función es lo único que `replace` no
   * puede hacer, y Postgres para la instalación entera con «cannot change
   * return type of existing function».
   */
  caso('y se borra antes de recrearla, que es la única forma', true,
    /drop function if exists mi_suscripcion\(\)/.test(sql))
  caso('y se le devuelve el permiso después del drop', true,
    /grant execute on function mi_suscripcion\(\) to authenticated/.test(sql))

  const suscripcion = await readFile('src/lib/suscripcion.ts', 'utf8')
  caso('la aplicación la lee', true, /fila\.pago_fallido_el/.test(suscripcion))
  caso('y también `hasta`, que llevaba años sin leerse', true, /fila\.hasta/.test(suscripcion))
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('y la pantalla la enseña', true, /avisoDePagoFallido\(suscripcion\)/.test(shell))

  /*
   * --- 7. EL AVISO DICE ALGO QUE SE PUEDE HACER ---
   *
   * Un aviso que dice «error de pago» y ya está no sirve: quien lo lee no sabe
   * si tiene que llamar al banco, entrar en algún sitio o esperar. Tiene que
   * decir QUÉ PASA, QUÉ NO PASA —que no se ha bloqueado nada, o cunde el
   * pánico— y QUÉ HACER.
   */
  const m = await cargar('src/lib/suscripcion.ts')
  const alCorriente = { ...m.SUSCRIPCION_INICIAL, activa: true }
  caso('sin fallo no se dice nada', null, m.avisoDePagoFallido(alCorriente))

  const recien = m.avisoDePagoFallido({ ...alCorriente, pagoFallidoEl: '2026-03-01' }, '2026-03-01')
  caso('el mismo día se dice «hoy»', true, /hoy/.test(recien.texto))
  caso('y se aclara que no se ha bloqueado nada', true, /No se ha bloqueado nada/.test(recien.texto))
  caso('y dónde se arregla', true, /Configuración → Suscripción/.test(recien.texto))
  caso('el primer día no es urgente', false, recien.urgente)

  const ayer = m.avisoDePagoFallido({ ...alCorriente, pagoFallidoEl: '2026-03-01' }, '2026-03-02')
  caso('al día siguiente se dice «ayer»', true, /ayer/.test(ayer.texto))

  /*
   * A LAS DOS SEMANAS CAMBIA EL TONO, y esto es lo que hace que el aviso siga
   * sirviendo. «Tu tarjeta ha fallado» dicho el día 1 y dicho el día 18 son
   * dos situaciones distintas: si el texto no lo nota, el del día 18 se lee
   * con la misma calma que el del día 1 — y ese ya no admite calma, porque
   * Stripe está a punto de cancelar.
   */
  const tarde = m.avisoDePagoFallido({ ...alCorriente, pagoFallidoEl: '2026-03-01' }, '2026-03-19')
  caso('a los dieciocho días es urgente', true, tarde.urgente)
  caso('y se dice cuántos días lleva', true, /hace 18 días/.test(tarde.texto))
  caso('y que está a punto de cancelarse', true, /a punto de cancelarse/.test(tarde.titulo))
  caso('los dos textos son distintos', false, tarde.texto === recien.texto)

  /*
   * LA FECHA SE PARTE A MANO, no con `new Date(iso)`. Esa forma interpreta
   * «2026-03-01» como medianoche EN UTC, y en España eso es el 28 de febrero
   * por la noche: el aviso diría «ayer» el mismo día que ha fallado. Se
   * comprueba con un día de cambio de mes, que es donde se nota.
   */
  const finDeMes = m.avisoDePagoFallido({ ...alCorriente, pagoFallidoEl: '2026-02-27' }, '2026-03-01')
  caso('el cambio de mes se cuenta bien', true, /hace 2 días/.test(finDeMes.texto))
  // Y un reloj atrasado no produce «hace -3 días».
  const futuro = m.avisoDePagoFallido({ ...alCorriente, pagoFallidoEl: '2026-03-05' }, '2026-03-01')
  caso('una fecha futura no cuenta días negativos', true, /hoy/.test(futuro.texto))
}
