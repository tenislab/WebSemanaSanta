/**
 * LOS AVISOS AUTOMÁTICOS: EL APARTADO QUE QUEDABA «POCO PREMIUM».
 *
 * «El apartado que se manden solos queda poco premium, mejóralo; el nombre no
 * me gusta así.»
 *
 * Y «poco premium» tenía causas medibles, no de gusto:
 *
 *  · TODO ABIERTO A LA VEZ. Con dos avisos, 1.969 px de formulario desplegado:
 *    dos asuntos, dos mensajes, dos juegos de cinco marcas, dos vistas previas
 *    y dos filas de cinco redes. Con cuatro avisos serían cuatro mil. Era una
 *    pila de formularios, no un panel. Cerrados: 318 px.
 *
 *  · SIN JERARQUÍA. Cada aviso era un `.assign-box` beige dentro de otro
 *    `.assign-box` beige dentro de una `.settings-card` beige: tres cajas del
 *    mismo color anidadas, sin un borde que dijera dónde acaba una.
 *
 *  · LA ACCIÓN QUE IMPORTA ERA LO MÁS PEQUEÑO. Encender un envío a ochocientas
 *    personas era una casilla de trece píxeles arriba a la derecha, con menos
 *    presencia que el botón rojo de «Quitar». Y el dato que hace falta para
 *    atreverse —«hoy alcanzaría a 5»— iba en letra pequeña gris detrás de tres
 *    puntos medios.
 *
 * EL NOMBRE: «Que se manden solos» describe el mecanismo, y de paso suena a
 * que la aplicación hace cosas por su cuenta — que es lo contrario de lo que
 * hace esto, porque nacen apagados. «Avisos automáticos» es lo que son desde
 * el lado del hermano.
 *
 * LO QUE NO SE TIRÓ. El código traía escrita una decisión razonada: «el texto
 * se ve y se edita aquí mismo, sin abrir nada; esconderlo detrás de un botón
 * editar es cómo se encienden reglas sin haber leído lo que dicen». Plegar por
 * plegar la rompía. Así que el plegado es ASIMÉTRICO: encender solo se puede
 * desde dentro —hay que haber abierto, o sea haber pasado por encima del
 * texto—, y apagar se puede desde fuera, porque apagar sí puede ser urgente.
 */
import { fuenteDe, cuerpoDeLaFuncion, sinComentarios, fuenteLlana } from './fuentes.mjs'

export default async function ({ caso }) {
  const ruta = 'src/pages/app/comunicados/PanelDeReglas.tsx'
  const panel = sinComentarios(await fuenteDe(ruta))
  const llano = fuenteLlana(await fuenteDe(ruta))
  const css = sinComentarios(await fuenteDe('src/styles/global.css'))

  // ---------------------------------------------------------------------
  // 1. EL NOMBRE.
  // ---------------------------------------------------------------------
  caso('el apartado se llama Avisos automáticos', true, /Avisos automáticos<\/h2>/.test(panel))
  caso('y no «Que se manden solos»', false, /Que se manden solos/.test(panel))
  // Y el texto habla de avisos, no de reglas, para que el nombre y el cuerpo
  // digan lo mismo: media pantalla llamándolo «regla» es el cambio a medias.
  caso('el cuerpo habla de avisos', true, /Un aviso automático escribe el comunicado/.test(llano))
  caso('y al quitarlo pregunta por el aviso', true, /¿Quitar el aviso automático/.test(llano))
  // Cuántos están encendidos, de un vistazo y sin abrir nada.
  caso('la cabecera cuenta los encendidos', true,
    /reglas\.filter\(\(r\) => r\.activa\)\.length\} de \{reglas\.length\} encendido/.test(panel))

  // ---------------------------------------------------------------------
  // 2. CABEZA SIEMPRE, CUERPO AL ABRIR.
  // ---------------------------------------------------------------------
  caso('cada aviso es un plegable', true, /<details\s*\n?\s*className=\{`regla/.test(panel))
  caso('con su cabeza', true, /<summary className="regla__cabeza">/.test(panel))
  /*
   * LO QUE SE VE SIN ABRIR es exactamente lo que hace falta para decidir:
   * nombre, cuándo, a quién, a cuánta gente alcanza HOY y si está encendido.
   */
  const cabeza = panel.slice(panel.indexOf('<summary className="regla__cabeza">'), panel.indexOf('</summary>'))
  caso('se acota la cabeza', true, cabeza.length > 200)
  caso('la cabeza dice el nombre', true, /\{r\.nombre\}/.test(cabeza))
  caso('y cuándo toca', true, /r\.cada === 'diaria'/.test(cabeza))
  caso('y a quién', true, /\{r\.destinatarios\}/.test(cabeza))
  caso('y a cuánta gente alcanza hoy', true, /hoy, a \$\{alcanza\}/.test(cabeza))
  caso('y si está encendido', true, /r\.activa \? 'Encendido' : 'Apagado'/.test(cabeza))
  /*
   * EL ALCANCE EN UNA PASTILLA, no en letra pequeña gris. Es el dato que evita
   * la sorpresa: se elige «los que cumplen hoy», sale a tres de ochocientos, y
   * sin el número no hay forma de saber si es que solo cumplen tres o es que
   * al resto le falta la fecha en la ficha.
   */
  caso('el alcance se ve como pastilla', true, /pill \$\{alcanza === 0 \? 'pill--info' : 'pill--ok'\}/.test(cabeza))

  // ---------------------------------------------------------------------
  // 3. EL PLEGADO ES ASIMÉTRICO, Y ES EL PUNTO.
  // ---------------------------------------------------------------------
  /*
   * ENCENDER, SOLO DESDE DENTRO. Medido en el navegador: con el aviso cerrado,
   * el interruptor de encender mide 0×0 px, o sea que no se puede pulsar. Es
   * la decisión del código de antes, reforzada: para llegar al interruptor hay
   * que haber pasado por encima del texto que se va a mandar.
   */
  const dentro = panel.slice(panel.indexOf('</summary>'), panel.indexOf('</details>'))
  caso('se acota el cuerpo', true, dentro.length > 800)
  caso('el interruptor de encender va dentro', true, /regla__encender/.test(dentro))
  caso('y es un interruptor de verdad', true, /className=\{`interruptor\$\{r\.activa \? ' interruptor--on'/.test(dentro))
  caso('con su palanca', true, /interruptor__palanca/.test(dentro))
  // Y el texto va ANTES del interruptor: el orden es el recorrido.
  caso('el texto se lee antes de encender', true,
    dentro.indexOf('id={`cuerpo-${r.id}`}') < dentro.indexOf('regla__encender'))

  /*
   * APAGAR, DESDE FUERA. Una regla que está mandando algo mal no se apaga con
   * dos clics, así que el botón de apagar se ofrece sin abrir — y solo cuando
   * está encendida, que es cuando sirve.
   */
  caso('apagar se ofrece desde fuera', true, /regla__apagar/.test(dentro))
  caso('y solo si está encendida', true, /\{r\.activa && \(\s*<div className="regla__apagar">/.test(dentro))

  // ---------------------------------------------------------------------
  // 4. EL `details` SALE DEL ESTADO, Y VA LA SEGUNDA VEZ HOY.
  // ---------------------------------------------------------------------
  /*
   * La primera versión puso `open={!r.activa && reglas.length <= 2}`. Es el
   * mismo fallo que el cobro en mano de Cuotas, el mismo día: el `summary`
   * abre y cierra el `details` por su cuenta, y React solo reescribe `open`
   * cuando el VALOR de la prop cambia. Con esa expresión, encender un aviso
   * cambia `r.activa`, cambia el valor, y el aviso se cerraba de golpe justo
   * al encenderlo. Medido después del arreglo: se enciende y sigue abierto.
   */
  caso('lo abierto sale del estado', true, /open=\{abiertos\.has\(r\.id\)\}/.test(panel))
  caso('y no de una cuenta sobre el array', false, /open=\{![\s\S]{0,40}reglas\.length/.test(panel))
  caso('el estado se entera de que lo han cerrado', true,
    /onToggle=\{\(e\) => abrir\(r\.id, \(e\.target as HTMLDetailsElement\)\.open\)\}/.test(panel))
  // Uno recién añadido nace abierto, que es cuando hay que leerlo.
  caso('el aviso nuevo nace abierto', true, /abrir\(id, true\)/.test(panel))

  // ---------------------------------------------------------------------
  // 5. NO SE ENCIENDE CON UNA MARCA QUE NO EXISTE, Y SE DICE POR QUÉ.
  // ---------------------------------------------------------------------
  /*
   * Aquí hace más falta que en un comunicado a mano: un aviso encendido se
   * manda solo, sin que nadie vuelva a leer el texto. Un `{nombe}` puesto hoy
   * saldría en cada cumpleaños durante años. Y ni con una marca en el texto
   * del post: ahí no se sustituye nada, así que se publicaría literalmente
   * «Hola {nombre}» en Instagram.
   */
  caso('el freno de las marcas sigue puesto', true,
    /const puedeEncenderse = sePuedePersonalizar\(`\$\{r\.asunto\}\\n\$\{r\.cuerpo\}`\)\.puede/.test(panel))
  caso('y también mira el texto del post', true, /&& !llevaMarcas\(r\.textoRedes\)/.test(panel))
  caso('el interruptor no deja encenderlo', true, /disabled=\{!r\.activa && !puedeEncenderse\}/.test(panel))
  /*
   * Y SE DICE POR QUÉ NO SE PUEDE. Un interruptor apagado y gris sin
   * explicación es lo que hace pensar que está roto: antes el `disabled` no
   * venía acompañado de nada.
   */
  caso('y dice por qué no se puede', true,
    /No se puede encender todavía: arregla el aviso de arriba/.test(llano))
  caso('y que encendido se manda sin revisar', true,
    /sin que nadie lo revise/.test(llano))

  // ---------------------------------------------------------------------
  // 6. LA JERARQUÍA, EN EL CSS.
  // ---------------------------------------------------------------------
  caso('el aviso es una tarjeta con filete', true,
    /\.regla \{[^}]*border-left: 3px solid/.test(css))
  // El encendido se ve SIN leer: es el que manda correos.
  caso('el encendido se distingue por el color del filete', true,
    /\.regla--encendida \{ border-left-color: var\(--ok-fg\); \}/.test(css))
  // El nombre se come el hueco, así que las pastillas quedan alineadas y se
  // pueden comparar de una fila a otra de un vistazo.
  caso('el nombre se come el hueco libre', true, /\.regla__que \{ flex: 1 1 14rem/.test(css))
  caso('y el encender va separado por un filete', true,
    /\.regla__encender \{[^}]*border-top: 1px solid/.test(css))
  caso('y la flecha respeta a quien pide quieto', true,
    /@media \(prefers-reduced-motion: reduce\) \{ \.regla__cabeza::before \{ transition: none/.test(css))

  // ---------------------------------------------------------------------
  // 7. `.lista-limpia`, UNA CLASE QUE NO EXISTÍA.
  // ---------------------------------------------------------------------
  /*
   * Se usa en OCHO pantallas —reservas de la tienda, devoluciones de cuotas,
   * encargos de redes, el área del hermano, lo que se comparte de la web…— y
   * NO tenía ni una regla en los nueve mil renglones del CSS. O sea que las
   * ocho pedían una lista sin viñetas y las ocho enseñaban la viñeta del
   * navegador, con su sangría de 40 px, al lado de tarjetas que ya traen su
   * propio borde.
   *
   * Nadie lo vio porque el nombre de la clase dice lo que debería pasar, y
   * leyendo el marcado parece que pasa. Salió al mirar la pantalla: un punto a
   * la izquierda de cada aviso. Medido después: `list-style-type: none` y
   * sangría 0 px.
   */
  caso('la clase existe de verdad', true, /\.lista-limpia \{ list-style: none; margin: 0; padding: 0; \}/.test(css))
  // Y sigue usándose donde se usaba: si alguien la quita de las ocho
  // pantallas, esta guarda deja de tener sentido y hay que enterarse.
  const { readdir, readFile } = await import('node:fs/promises')
  const buscarEn = async (dir) => {
    let cuantos = 0
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`
      if (e.isDirectory()) cuantos += await buscarEn(p)
      else if (/\.tsx?$/.test(e.name) && (await readFile(p, 'utf8')).includes('lista-limpia')) cuantos += 1
    }
    return cuantos
  }
  const pantallasQueLaUsan = await buscarEn('src')
  caso('la usan varias pantallas, no una', true, pantallasQueLaUsan >= 5)
}
