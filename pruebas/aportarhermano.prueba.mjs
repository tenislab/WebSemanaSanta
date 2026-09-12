/**
 * LA APORTACIÓN A UNA CAMPAÑA: BUSCAR AL HERMANO Y AVISAR SI SE PASA.
 *
 * Se pidió: «en aportación que pueda buscar hermano, y que no se pueda añadir
 * más dinero del que falta; sí se puede, pero se añade a otros proyectos».
 *
 * Lo primero es un buscador (el mismo `HermanoPicker` de tareas y cortejo) en
 * vez de escribir el nombre a mano. Con texto libre aparte, porque un donativo
 * puede venir de un vecino o una empresa que no es hermano.
 *
 * Lo segundo se resolvió AVISANDO, no rechazando: la aritmética está en
 * `loQueSobra` (probada en objetivos.prueba.mjs); aquí se comprueba que la
 * pantalla la usa según se escribe la cifra, que la enseña con «se apunta
 * igual», y que el envío no la bloquea. Si alguien vuelve a poner el rechazo,
 * cae la última.
 */
import { readFileSync } from 'node:fs'

export default async function ({ caso }) {
  const src = readFileSync('src/pages/app/Campanas.tsx', 'utf8')
  const form = src.slice(src.indexOf('function FormularioAportacion('), src.indexOf('PROYECTOS  '))

  /* 1. EL BUSCADOR DE HERMANO, Y EL TEXTO LIBRE SOLO SI NO SE ELIGE A NADIE. */
  caso('el panel le pasa los hermanos activos al formulario', true,
    /hermanos=\{asignables\}/.test(src) && /h\.estado !== 'Baja'/.test(src.slice(0, src.indexOf('function TarjetaCampana'))))
  caso('el formulario pinta el HermanoPicker', true, /<HermanoPicker/.test(form))
  caso('al elegir, se guarda quién', true, /onSelect=\{setHermanoElegido\}/.test(form))
  caso('el texto libre se ofrece solo si no hay hermano elegido', true,
    /\{!hermanoElegido && \([\s\S]*?id="apQuien"/.test(form))
  caso('el concepto lleva al hermano elegido, o lo escrito', true,
    /const quien = hermanoElegido \? hermanoElegido\.nombre : deQuien\.trim\(\)/.test(form)
    && /\$\{campana\.nombre\} — \$\{quien\}/.test(form))

  /* 2. EL AVISO DE PASARSE: SEGÚN SE ESCRIBE, CON LA CIFRA, Y SIN BLOQUEAR. */
  caso('el panel calcula lo que falta desde Tesorería', true,
    /falta=\{loQueFalta\(loRecaudado\(movimientos, aportandoA\), aportandoA\.objetivo\)\}/.test(src))
  caso('la pantalla pregunta a loQueSobra con la cifra viva', true,
    /const sobra = loQueSobra\(cifraViva, falta, campana\.objetivo\)/.test(form))
  caso('el aviso se pinta solo cuando sobra algo', true, /\{sobra !== null && \(/.test(form))
  caso('el aviso dice en cuánto se pasa', true, /se pasa en \{formatCurrency\(sobra\)\}/.test(form))
  caso('y que se apunta igual', true, /Se apunta igual/.test(form))
  // El envío: la única salida temprana es la de la cifra vacía o cero.
  const enviar = form.slice(form.indexOf('function enviar('), form.indexOf('onApuntar({'))
  caso('enviar NO rechaza por pasarse del objetivo', true,
    !/sobra|falta/.test(enviar) && (enviar.match(/return/g) ?? []).length === 1)
}
