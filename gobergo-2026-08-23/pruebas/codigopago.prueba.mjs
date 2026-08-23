/**
 * EL CÓDIGO DE PAGO DEL HERMANO.
 *
 * Lo que sustituye: «Papeleta 1 - Jaime Rivas» escrito a mano en el concepto de
 * un Bizum. Nadie escribe eso entero desde un móvil, y lo que llega a la
 * tesorería es un ingreso sin dueño.
 */
export default async function ({ caso }) {
  const m = await import('../src/lib/codigoHermano.ts')

  // Lo normal: tres nombres, tres iniciales.
  caso('tres palabras dan sus tres iniciales', 'JRR-0001',
    m.codigoDeHermano({ nombre: 'Jaime Rivas Reinoso', numero: 1 }))
  // Con más palabras se cogen las tres primeras, no todas: el código tiene que
  // medir siempre igual para que se reconozca de un vistazo.
  caso('con cuatro, solo las tres primeras', 'MJL-0042',
    m.codigoDeHermano({ nombre: 'María José López de Haro', numero: 42 }))
  // Con dos palabras se completa con el APELLIDO, no con el nombre: es lo que
  // se reconoce en un extracto bancario.
  caso('con dos, se completa con el apellido', 'AGI-0007',
    m.codigoDeHermano({ nombre: 'Ana Gil', numero: 7 }))
  caso('con una sola', 'CAR-0003', m.codigoDeHermano({ nombre: 'Carmen', numero: 3 }))

  // Las tildes y la eñe no pueden salir en un concepto bancario: hay bancos que
  // las comen y el código dejaría de cuadrar.
  caso('sin tildes', 'AMP-0010', m.codigoDeHermano({ nombre: 'Ángel Muñoz Peña', numero: 10 }))
  caso('ni la eñe suelta', 'NUN-0011', m.codigoDeHermano({ nombre: 'Ñuño', numero: 11 }))

  // El número, siempre a cuatro dígitos: así todos los códigos miden lo mismo.
  caso('el número va a cuatro cifras', 'JRV-0999',
    m.codigoDeHermano({ nombre: 'Juan Ruiz Vega', numero: 999 }))
  caso('y aguanta uno de cinco', 'JRV-12345',
    m.codigoDeHermano({ nombre: 'Juan Ruiz Vega', numero: 12345 }))
  // Un hermano sin número (un civil, alguien recién creado) no puede tumbar la
  // pantalla de pago.
  caso('sin número no se rompe', 'JRV-0000',
    m.codigoDeHermano({ nombre: 'Juan Ruiz Vega', numero: 0 }))
  caso('un nombre vacío tampoco', 'XXX-0001', m.codigoDeHermano({ nombre: '   ', numero: 1 }))

  // ES ESTABLE. Si cambiara de un día para otro, el hermano no podría
  // aprendérselo y todo esto no serviría de nada.
  const h = { nombre: 'Jaime Rivas Reinoso', numero: 1 }
  caso('el mismo hermano da siempre el mismo código',
    m.codigoDeHermano(h), m.codigoDeHermano({ ...h }))

  /*
   * Y AL REVÉS: la tesorería teclea lo que ve en el extracto.
   *
   * Ahí llega como llega: en minúsculas, sin el guion, con espacios. Si solo
   * valiera la forma exacta, esto no ahorraría trabajo a nadie.
   */
  const censo = [
    { nombre: 'Jaime Rivas Reinoso', numero: 1 },
    { nombre: 'Carmen Ortiz', numero: 2 },
  ]
  caso('se encuentra por el código exacto', 'Jaime Rivas Reinoso',
    m.hermanoDelCodigo('JRR-0001', censo)?.nombre)
  caso('en minúsculas también', 'Jaime Rivas Reinoso',
    m.hermanoDelCodigo('jrr-0001', censo)?.nombre)
  caso('sin el guion', 'Jaime Rivas Reinoso', m.hermanoDelCodigo('JRR0001', censo)?.nombre)
  caso('con espacios de más', 'Jaime Rivas Reinoso',
    m.hermanoDelCodigo('  JRR 0001 ', censo)?.nombre)
  caso('otro hermano, otro código', 'Carmen Ortiz',
    m.hermanoDelCodigo('COR-0002', censo)?.nombre)

  // Y lo que NO tiene que encontrar. Devolver a alguien equivocado sería peor
  // que no devolver a nadie: el dinero se le apuntaría a quien no es.
  caso('un código que no existe no devuelve a nadie', undefined,
    m.hermanoDelCodigo('ZZZ-9999', censo))
  caso('un dígito mal, tampoco', undefined, m.hermanoDelCodigo('JRR-0011', censo))
  // Esto es para lo que están las letras: el número solo se teclea mal muy
  // fácil, y con letras el error se ve en vez de colarse.
  caso('las letras de otro con el número de este, tampoco', undefined,
    m.hermanoDelCodigo('COR-0001', censo))
  caso('vacío no devuelve a nadie', undefined, m.hermanoDelCodigo('', censo))
  caso('ni un concepto cualquiera', undefined, m.hermanoDelCodigo('pago cuota', censo))
}
