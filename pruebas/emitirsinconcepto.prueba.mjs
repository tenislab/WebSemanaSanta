/**
 * «NO ME DEJA EMITIR EL EJERCICIO ENTERO».
 *
 * Así llegó, y casi no era un fallo: la hermandad no había definido todavía
 * la cuota —su nombre y su importe— y sin eso no hay nada que emitir. Lo que
 * sí estaba mal era CÓMO lo decía la pantalla:
 *
 *   · En la tabla vacía, el botón «Emitir el ejercicio entero» abría un cajón
 *     donde no se podía emitir. Prometía algo que no cumplía.
 *   · Y el botón de emitir del cajón se quedaba apagado, mudo, sin decir por
 *     qué.
 *
 * Esto NO se puede pintar sin base de datos: sin Supabase, un catálogo vacío
 * cae a «Cuota anual» de fábrica (ver `getConceptosCuota`) y el caso no existe.
 * Con Supabase y la tabla vacía, existe — y es justo el de una hermandad recién
 * dada de alta. Por eso aquí se comprueba el cableado de las dos ramas, ya que
 * la que importa no se puede ver en la demo.
 */
import { readFileSync } from 'node:fs'

export default async function ({ caso }) {
  const cuotas = readFileSync('src/pages/app/Cuotas.tsx', 'utf8')

  /*
   * 1. LA TABLA VACÍA, SIN CONCEPTO, NO OFRECE EMITIR: MANDA A DEFINIR LA CUOTA.
   *
   * Se busca la rama entera: la condición y, dentro, el enlace a Configuración.
   * Si alguien vuelve a poner el botón de emitir para los dos casos, esto cae.
   */
  const ramaVacia = cuotas.slice(
    cuotas.indexOf("cuotas.length === 0 ? ("),
    cuotas.indexOf("query.trim() ? ("),
  )
  caso('la tabla vacía distingue si hay concepto o no', true, /!catalogoListo \? \(/.test(ramaVacia))
  caso('sin concepto, enlaza a definir la cuota en Configuración', true,
    /Configuración → Catálogos y cuotas/.test(ramaVacia) && /to="\/app\/configuracion"/.test(ramaVacia))
  caso('sin concepto, NO ofrece «Emitir el ejercicio entero»', true,
    // El botón sigue existiendo, pero solo en la rama con concepto (la de
    // `else`). Se busca el BOTÓN (`onClick={abrirEmision}`) y no el texto: el
    // texto aparece también en el comentario que explica el cambio, antes de la
    // rama, y con él esta comprobación pasaba o fallaba según dónde mirara.
    ramaVacia.indexOf('onClick={abrirEmision}') > ramaVacia.indexOf(') : ('))

  /*
   * 2. EL BOTÓN APAGADO DEL CAJÓN DICE POR QUÉ.
   *
   * Un `title` por cada motivo por el que se apaga: sin concepto, año inválido,
   * o nadie a quien emitírsela. Si se añade un motivo nuevo de apagado sin su
   * texto, el botón vuelve a quedarse mudo.
   *
   * Se recorta desde el botón de EMITIR (`onClick={confirmarEmision}`), no
   * desde el título del cajón: el primer `</button>` tras el título es el de
   * Cancelar, y con él se estaba mirando el botón equivocado.
   */
  const cajon = cuotas.slice(cuotas.indexOf('onClick={confirmarEmision}'))
  const boton = cajon.slice(0, cajon.indexOf('</button>'))
  caso('el botón de emitir explica cuando falta la cuota', true, /definir la cuota/.test(boton))
  caso('y cuando el año no vale', true, /no es válido/.test(boton))
  caso('y cuando ya la tienen todos', true, /ya la tienen/.test(boton))
  // Y los motivos cubren exactamente las condiciones que lo apagan.
  const condiciones = boton.match(/disabled=\{([^}]+)\}/)?.[1] ?? ''
  caso('las condiciones de apagado son las tres que se explican', true,
    /!catalogoListo/.test(condiciones) && /pendientesDeEmitir\.length === 0/.test(condiciones) && /!ejercicioValido/.test(condiciones))
}
