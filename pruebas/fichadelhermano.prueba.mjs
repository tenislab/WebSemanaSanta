/**
 * LA FICHA DEL HERMANO ERA UN MURO DE TEXTO.
 *
 * Llegó como pregunta: «el apartado de hermano se puede mejorar (es pregunta,
 * quiero que me digas si y cómo o no), tanto texto al principio». La respuesta
 * fue que sí, y bastante: el cajón hacía DOS trabajos a la vez —ser la ficha
 * (datos que se consultan de un vistazo) y ser el manual (prosa que explica
 * qué es cada cosa)— y ganaba el manual.
 *
 * Abriendo la ficha de un hermano, por delante del DNI y del cumpleaños había:
 * las cuotas, el historial de la estación con su párrafo, los dos párrafos del
 * certificado de antigüedad, el aviso de que nadie figura como Hermano Mayor,
 * el campo «Para qué lo pide» con su explicación y el botón de expedir. Para
 * ver un dato había que leer por encima medio manual.
 *
 * NO SE HA BORRADO NINGUNA EXPLICACIÓN. Lo que se consulta va arriba; lo que
 * explica se pliega («¿Qué es esto?»); y lo que solo hace falta al expedir un
 * certificado aparece al decir que se va a expedir.
 */
import { readFileSync } from 'node:fs'

export default async function ({ caso }) {
  const { fuenteDelCenso, fuenteDe } = await import('./fuentes.mjs')
  const src = await fuenteDelCenso()
  /*
   * DOS FUENTES, Y ES EL PRECIO DE HABER PARTIDO LA PANTALLA.
   *
   * Esta prueba acotaba un trozo —«desde la cabecera hasta el bloque de
   * corregir la ficha»— y comprobaba dentro tanto EL ORDEN como EL CONTENIDO.
   * Funcionaba mientras la ficha era un solo fichero de ochocientas líneas. Al
   * sacar el certificado a su propio componente, su texto se fue al final de
   * lo pegado y cayó fuera de la ventana: once comprobaciones en rojo contra
   * una pantalla que no había cambiado ni un píxel.
   *
   * Así que ahora cada cosa se mira donde está:
   *  · EL ORDEN en el padre, que es quien coloca los bloques en la pantalla.
   *  · EL CONTENIDO en la pieza, que es quien lo tiene.
   */
  const ficha = src.slice(src.indexOf('</header>'), src.indexOf('<label>Corregir la ficha</label>'))
  const cert = await fuenteDe('src/pages/app/censo/FichaCertificado.tsx')

  /*
   * 1. LOS DATOS, ANTES QUE LAS EXPLICACIONES.
   *
   * Es el orden lo que se comprueba, no que existan: el DNI y el cumpleaños ya
   * estaban, pero detrás de todo lo demás.
   */
  const donde = (t) => ficha.indexOf(t)
  caso('el DNI va antes que las cuotas', true,
    donde('<dt>DNI / NIE</dt>') < donde('<h4>Cuotas</h4>') && donde('<dt>DNI / NIE</dt>') > 0)
  caso('y antes que el historial de la estación', true,
    donde('<dt>DNI / NIE</dt>') < donde('Participación en la estación de penitencia'))
  /* El certificado ya no está escrito aquí: lo coloca `<FichaCertificado />`,
     y es esa etiqueta la que marca su sitio en la pantalla. */
  caso('y antes que el certificado', true,
    donde('<dt>DNI / NIE</dt>') < donde('<FichaCertificado') && donde('<FichaCertificado') > 0)
  caso('el cumpleaños va con él', true,
    donde('<dt>Cumpleaños</dt>') < donde('<h4>Cuotas</h4>'))
  // Siguen estando los demás datos de la rejilla: no se ha perdido nada al subirla.
  caso('y la familia sigue en la rejilla', true,
    donde('<dt>A cargo de</dt>') > 0 && donde('<dt>A cargo de</dt>') < donde('<h4>Cuotas</h4>'))

  /*
   * 2. LO QUE EXPLICA, PLEGADO.
   *
   * Ni una palabra menos: el párrafo largo del certificado y el «qué hacer si
   * ha perdido la contraseña» siguen escritos, dentro de un <details>.
   */
  caso('el certificado explica qué es, plegado', true,
    /<details className="ficha-ayuda">\s*<summary>¿Qué es esto\?<\/summary>/.test(cert))
  caso('sin perder para qué sirve', true, /para el varal que va por antigüedad/.test(cert))
  caso('y el acceso pliega el «si no la recuerda»', true,
    /<summary>¿Y si no la recuerda\?<\/summary>/.test(ficha))
  caso('sin perder que la contraseña no se guarda', true,
    /La contraseña no se guarda en ningún sitio/.test(ficha))

  /*
   * 3. LO DE EXPEDIR, SOLO AL EXPEDIR.
   *
   * El aviso de los firmantes y el «para qué lo pide» estaban SIEMPRE. Ahora
   * el botón abre el formulario, y es ahí donde avisa — que es el momento en
   * que hace falta: enterarse al imprimirlo, con la persona delante, es tarde.
   */
  caso('el certificado empieza siendo un botón', true, /Expedir certificado…\s*<\/button>/.test(cert))
  caso('que abre el formulario', true, /onClick=\{\(\) => setExpidiendoAbierto\(true\)\}/.test(cert))
  const alExpedir = cert.slice(cert.indexOf('{!expidiendoAbierto ? ('), cert.indexOf('{/* Lo primero que hace la secretaría'))
  caso('el aviso de los firmantes va dentro', true, /sinFirmantes\.length > 0 &&/.test(alExpedir))
  caso('y el «para qué lo pide» también', true, /id="motivoCert"/.test(alExpedir))
  caso('con su botón de verdad y su cancelar', true,
    /'Expedir certificado'\}\s*<\/button>/.test(alExpedir) && /Cancelar/.test(alExpedir))

  /*
   * Y SE CIERRA CUANDO TOCA. Abierto en la ficha de OTRA persona sería un
   * certificado a punto de salir a nombre de quien no lo pidió.
   */
  /*
   * Los dos sitios que lo cierran viven ahora en la propia pieza, uno al lado
   * del otro, que es como se lee de un tirón: antes había que acotar un
   * `useEffect` de la pantalla que reiniciaba media ficha a la vez.
   */
  const efecto = cert.slice(cert.indexOf('useEffect(() => {'), cert.indexOf('}, [selected.id])'))
  caso('al cambiar de hermano se cierra', true, /setExpidiendoAbierto\(false\)/.test(efecto))
  const expedir = cert.slice(cert.indexOf('const r = await emitirCertificado('))
  caso('y al expedirlo, también', true, /setExpidiendoAbierto\(false\)/.test(expedir))
  // Lo que no cambia: el certificado se sigue expidiendo igual, con su motivo.
  caso('se sigue expidiendo con el motivo escrito', true,
    /emitirCertificado\(selected\.id, motivoCert\.trim\(\)\)/.test(cert))
}
