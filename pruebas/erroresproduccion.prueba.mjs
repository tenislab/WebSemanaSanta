/**
 * MIRAR LO QUE SE ROMPE EN PRODUCCIÓN.
 *
 * `lib/vigilancia.ts` llevaba semanas recogiendo todo lo que revienta en el
 * navegador de una hermandad y dejándolo en `errores_cliente`. Y ahí se
 * quedaba: NO HABÍA NINGUNA PANTALLA QUE LO LEYERA. Se recogía y no lo miraba
 * nadie ni una vez — que es peor que no recogerlo, porque eso al menos no
 * engaña. Es la fase 6 del plan de bugs: «falta mirarlo: un sitio en la
 * aplicación que lo enseñe, y la costumbre de abrirlo».
 *
 * LA CERRADURA SE PRUEBA EN LA BASE, ejecutando la función con los dos roles
 * (`basedatos.prueba.mjs`, «un titular no ve los errores de producción»). Aquí
 * van las decisiones del lado del navegador, y la que más importa es la del
 * resumen: distinguir «no se rompe nada» de «no lo sé».
 */
import { readFileSync } from 'node:fs'

export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/erroresProduccion.ts')

  const e = (extra = {}) => ({
    mensaje: 'TypeError: x is not a function', clase: 'js', veces: 1, hermandades: 1,
    ultima: '2026-09-12T10:00:00Z', ruta: '/app/cuotas', versionApp: '2026-09-01', pila: '',
    ...extra,
  })

  /*
   * 1. LA FRASE DEL RESUMEN, que es lo único con decisiones.
   *
   * Singular y plural de las dos cuentas, y el caso de que no haya nada dicho
   * con la ventana dentro: «ni un fallo» a secas no se puede comprobar —¿en
   * cuánto tiempo?— y esta pantalla existe justamente para no contar
   * tranquilidades falsas.
   */
  caso('sin fallos, lo dice con la ventana', 'Ni un fallo en los últimos 7 días.',
    m.comoVaLaCosa([], 7))
  caso('y con la ventana que se pida', 'Ni un fallo en los últimos 30 días.',
    m.comoVaLaCosa([], 30))
  caso('uno solo, en singular', '1 fallo distinto, 1 vez en 7 días.',
    m.comoVaLaCosa([e()], 7))
  caso('el mismo repetido sigue siendo uno', '1 fallo distinto, 9 veces en 7 días.',
    m.comoVaLaCosa([e({ veces: 9 })], 7))
  caso('y varios, en plural y sumando', '2 fallos distintos, 12 veces en 7 días.',
    m.comoVaLaCosa([e({ veces: 9 }), e({ mensaje: 'otro', veces: 3 })], 7))

  /*
   * 2. QUÉ ES DEL CÓDIGO Y QUÉ ES DE UN ORDENADOR.
   *
   * Es el dato que ordena el trabajo: el mismo fallo en tres hermandades es el
   * código y va primero; en una sola puede ser su navegador, su red o su móvil.
   * Se pinta con un distintivo distinto, así que la regla vive aparte y se
   * comprueba con datos.
   */
  caso('en una sola hermandad, puede ser cosa suya', false, m.esDeTodos(e({ hermandades: 1 })))
  caso('en dos, ya es del código', true, m.esDeTodos(e({ hermandades: 2 })))
  caso('y en cero —no debería pasar— no se acusa al código', false, m.esDeTodos(e({ hermandades: 0 })))

  /*
   * 3. NO LANZA NUNCA, y esto no es cosmético.
   *
   * Sin base de datos, sin la función puesta (una hermandad que no ha pegado el
   * SQL nuevo) o sin ser soporte, la respuesta es una lista vacía. Una pantalla
   * de diagnóstico que revienta al abrirla no sirve para diagnosticar nada.
   *
   * Se ejecuta de verdad: aquí no hay Supabase configurado, que es justo uno de
   * los tres casos.
   */
  caso('sin base de datos devuelve una lista vacía', [], await m.erroresDeProduccion(7))
  caso('y tampoco lanza con una ventana absurda', [], await m.erroresDeProduccion(-3))
  caso('la ventana de fábrica es de una semana', 7, m.DIAS_POR_DEFECTO)

  /*
   * 4. Y EL CABLEADO DE LA PANTALLA.
   *
   * Estas leen el fichero porque no hay otra —montar la pantalla pide un
   * navegador— y vigilan dos cosas que se podrían perder sin que nada más se
   * entere:
   *
   *   · Que «cargando» y «no hay nada» NO se pinten igual. Si se juntaran, la
   *     pantalla diría «ni un fallo» durante el segundo que tarda la consulta:
   *     la mentira tranquilizadora que esto viene a quitar.
   *   · Que la pila NO se pinte siempre. Son veinte líneas por fallo; con
   *     cuarenta fallos la tabla es ilegible.
   */
  const pantalla = readFileSync('src/pages/app/ErroresProduccion.tsx', 'utf8')
  caso('cargando no se confunde con no haber nada', true,
    /estado === 'cargando' \? \(/.test(pantalla) && /'cargando' \| 'listo'/.test(pantalla))
  caso('la pila solo se pinta al pedirla', true, /\{abierto === e\.mensaje && \(/.test(pantalla))
  caso('y se puede volver a mirar sin recargar', true, /Volver a mirar/.test(pantalla))

  /*
   * Y EL ENLACE DEL MENÚ, solo para soporte.
   *
   * Esconderlo NO es lo que protege la pantalla —eso lo hace `es_soporte()`
   * dentro de la función, y tiene su prueba ejecutada en `basedatos`— pero un
   * enlace que la secretaria no puede usar no tiene por qué estar en su menú.
   */
  const shell = readFileSync('src/components/AppShell.tsx', 'utf8')
  caso('el menú pregunta si la cuenta es de soporte', true, /void soySoporte\(\)\.then\(setEsSoporte\)/.test(shell))
  caso('y el enlace solo sale para ella', true,
    /group\.label === 'Sistema' && esSoporte/.test(shell))
  // Y el menú se recalcula cuando llega la respuesta: si no, el enlace no
  // aparecería hasta el siguiente cambio de cargo.
  caso('y el menú se recalcula al saberlo', true, /permisosVersion, suscripcion, esSoporte\]/.test(shell))
}
