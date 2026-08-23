/** W10: lo que la web pública recibe (validación y resumen del buzón). */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/mensajesWeb.ts')

  // --- Correos ---
  caso('un correo normal vale', true, m.pareceEmail('ana@hermandad.es'))
  caso('con subdominio también', true, m.pareceEmail('ana.sanchez@correo.hermandad.es'))
  caso('con espacios alrededor, se recorta', true, m.pareceEmail('  ana@hermandad.es  '))
  caso('sin arroba, no', false, m.pareceEmail('ana.hermandad.es'))
  caso('sin punto tras la arroba, no', false, m.pareceEmail('ana@hermandad'))
  caso('con espacios dentro, no', false, m.pareceEmail('ana sanchez@hermandad.es'))
  caso('vacío, no', false, m.pareceEmail(''))

  // --- Teléfonos ---
  caso('nueve dígitos valen', true, m.pareceTelefono('622104558'))
  caso('escrito con espacios, también', true, m.pareceTelefono('622 10 45 58'))
  caso('con guiones, también', true, m.pareceTelefono('622-10-45-58'))
  caso('con prefijo internacional, también', true, m.pareceTelefono('+34 622 104 558'))
  caso('ocho dígitos, no', false, m.pareceTelefono('62210455'))
  caso('con letras, no', false, m.pareceTelefono('622 10 45 5X'))

  // --- El formulario entero ---
  const bueno = { nombre: 'Ana Sánchez', email: 'ana@hermandad.es', telefono: '', consiente: true }
  caso('un formulario correcto no da errores', 0, Object.keys(m.erroresFormulario(bueno)).length)
  caso('sin nombre, avisa', true, !!m.erroresFormulario({ ...bueno, nombre: 'A' }).nombre)
  caso('sin correo, avisa', true, !!m.erroresFormulario({ ...bueno, email: '' }).email)
  caso('con correo mal, avisa', true, !!m.erroresFormulario({ ...bueno, email: 'ana@' }).email)
  // Sin aceptar el aviso de datos no se manda nada: es lo que exige el RGPD.
  caso('sin aceptar el aviso de datos, avisa', true, !!m.erroresFormulario({ ...bueno, consiente: false }).consiente)
  // El teléfono es opcional: vacío no molesta, pero mal escrito sí.
  caso('sin teléfono no pasa nada', undefined, m.erroresFormulario(bueno).telefono)
  caso('un teléfono mal escrito sí avisa', true, !!m.erroresFormulario({ ...bueno, telefono: '12' }).telefono)
  caso('donde hace falta teléfono, se exige', true,
    !!m.erroresFormulario(bueno, { exigeTelefono: true }).telefono)
  // El mensaje solo se exige en el formulario de contacto: a quien te está
  // dando dinero no se le pide encima que escriba una redacción.
  caso('el mensaje no se exige por defecto', undefined, m.erroresFormulario(bueno).mensaje)
  caso('en contacto sí se exige', true, !!m.erroresFormulario(bueno, { exigeMensaje: true }).mensaje)
  caso('y con texto de sobra, no', undefined,
    m.erroresFormulario({ ...bueno, mensaje: 'Quería preguntar por los cultos' }, { exigeMensaje: true }).mensaje)

  // --- El resumen que se lee en la lista del buzón ---
  caso('un donativo enseña el importe', '25 €', m.resumenMensaje({ tipo: 'donativo', importe: 25 }))
  caso('y su causa si la tiene', '25 € · Bolsa de caridad',
    m.resumenMensaje({ tipo: 'donativo', importe: 25, causa: 'Bolsa de caridad' }))
  caso('una participación, en singular', '1 participación',
    m.resumenMensaje({ tipo: 'loteria', participaciones: 1 }))
  caso('varias, en plural', '5 participaciones',
    m.resumenMensaje({ tipo: 'loteria', participaciones: 5 }))
  caso('un mensaje enseña su asunto', 'Sobre los cultos',
    m.resumenMensaje({ tipo: 'contacto', asunto: 'Sobre los cultos', mensaje: 'Buenas…' }))
  caso('sin asunto, el principio del texto', 'Buenas tardes',
    m.resumenMensaje({ tipo: 'contacto', asunto: '', mensaje: 'Buenas tardes' }))

  // --- Que no lo mande un robot ---
  // El campo trampa: lo rellenan porque leen el HTML, no la pantalla.
  caso('con el campo trampa relleno, es robot', true, m.pareceRobot('https://spam.example', 60000))
  caso('con espacios sueltos en la trampa, no cuenta', false, m.pareceRobot('   ', 60000))
  caso('vacío y con tiempo, es persona', false, m.pareceRobot('', 9000))
  // El reloj: nadie rellena un formulario en un segundo.
  caso('un envío instantáneo es robot', true, m.pareceRobot('', 200))
  caso('justo en el umbral, todavía robot', true, m.pareceRobot('', m.MS_MINIMOS_HUMANOS - 1))
  caso('en el umbral justo, ya persona', false, m.pareceRobot('', m.MS_MINIMOS_HUMANOS))
  // El umbral se deja bajo a propósito: tirar el mensaje de una persona de
  // verdad es peor que colarse un spam.
  caso('el umbral no pasa de un segundo y medio', true, m.MS_MINIMOS_HUMANOS <= 1500)

  // --- Sin leer ---
  caso('cuenta los sin leer', 2, m.sinLeer([{ leido: false }, { leido: true }, { leido: false }]))
  caso('sin nada, cero', 0, m.sinLeer([]))
}
