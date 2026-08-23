/** Remesa bancaria: el XML que se le entrega al banco. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/sepa.ts')
  const acreedor = { nombre: 'Hermandad', iban: 'ES9121000418450200051332', identificadorAcreedor: 'ES23000B12345678' }

  caso('acreedor completo', null, m.acreedorIncompleto(acreedor))
  caso('sin nombre avisa', true, /nombre/i.test(m.acreedorIncompleto({ ...acreedor, nombre: '' })))
  caso('sin IBAN avisa', true, /IBAN/i.test(m.acreedorIncompleto({ ...acreedor, iban: '' })))
  caso('un IBAN con espacios vale', null, m.acreedorIncompleto({ ...acreedor, iban: 'ES91 2100 0418 4502 0005 1332' }))
  caso('sin identificador de acreedor avisa', true, /acreedor/i.test(m.acreedorIncompleto({ ...acreedor, identificadorAcreedor: '' })))

  const deudor = (nombre, hermanoId) => ({ nombre, hermanoId, numeroHermano: 1, antiguedad: 2000, iban: 'ES7921000813610123456789' })
  const recibos = [
    { numero: 1, deudor: deudor('Juan Pérez', 'h1'), importe: 18, concepto: 'Cuota' },
    { numero: 2, deudor: deudor('Ana <Gil> & Cía', 'h2'), importe: 60.5, concepto: 'Cuota & más' },
  ]
  const xml = m.buildSepaXml(acreedor, recibos, new Date(2026, 7, 23), new Date(2026, 7, 18, 10, 30))
  caso('dos adeudos', 2, (xml.match(/<DrctDbtTxInf>/g) || []).length)
  caso('la suma de control cuadra (18 + 60,50)', 2, (xml.match(/<CtrlSum>78\.50<\/CtrlSum>/g) || []).length)
  /*
   * Los caracteres que no admite SEPA se quitan ANTES de escapar, así que a la
   * plantilla ya no le llega ni un «<» ni un «&»: el nombre entra como «Ana Gil
   * Cia». El escapado sigue puesto porque es la última red —si algún día entra
   * un texto por otra vía, el XML no se rompe— pero aquí ya no tiene trabajo.
   */
  caso('los signos que SEPA no admite se quitan', true, /<Nm>Ana Gil Cia<\/Nm>/.test(xml))
  caso('no queda ningún & suelto', false, /&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml))
  caso('ni un < ni un > dentro de un nombre', false, /<Nm>[^<]*[<>][^<]*<\/Nm>/.test(xml))
  caso('la fecha de cobro es la pedida', true, xml.includes('<ReqdColltnDt>2026-08-23</ReqdColltnDt>'))
  caso('esquema pain.008.001.02', true, xml.includes('pain.008.001.02'))
  caso('el IBAN va sin espacios', true, xml.includes('<IBAN>ES9121000418450200051332</IBAN>'))

  await laSumaDeControlCuadraSiempre({ m, acreedor, deudor, caso })
  await _limitesDelBanco({ cargar, caso })
}

/**
 * LA SUMA DE CONTROL, CUADRE COMO CUADRE EL IMPORTE.
 *
 * El banco RECHAZA EL FICHERO ENTERO si `CtrlSum` no es exactamente la suma de
 * los `InstdAmt`. Y se calculaban por dos caminos distintos: cada línea
 * redondeaba su importe a dos decimales, y la suma de control sumaba los
 * importes SIN redondear y redondeaba al final.
 *
 * Con cualquier importe de más de dos decimales, las dos cuentas se separan:
 * tres recibos de 0,005 € daban líneas de 0,01+0,01+0,01 = 0,03 y una suma de
 * control de 0,02. Basta con que alguien teclee 12,345 en el importe de un
 * concepto o que venga así de una hoja de cálculo.
 *
 * Y el fallo NO SE VE al descargar —el XML parece correcto—: se ve tres días
 * después, cuando el banco devuelve la remesa entera y no ha cobrado nadie.
 */
async function laSumaDeControlCuadraSiempre({ m, acreedor, deudor, caso }) {
  const cuadra = (importes) => {
    const xml = m.buildSepaXml(
      acreedor,
      importes.map((importe, i) => ({ numero: i + 1, deudor: deudor(`H${i}`, `h${i}`), importe, concepto: 'Cuota' })),
      new Date(2027, 2, 1),
      new Date(2027, 1, 14, 10, 0),
    )
    const control = xml.match(/<CtrlSum>([\d.]+)<\/CtrlSum>/)[1]
    const lineas = [...xml.matchAll(/<InstdAmt Ccy="EUR">([\d.]+)<\/InstdAmt>/g)].map((x) => Number(x[1]))
    return control === lineas.reduce((a, b) => a + b, 0).toFixed(2)
  }

  caso('con importes normales', true, cuadra([60, 18, 25]))
  caso('con céntimos', true, cuadra([20.10, 20.10, 20.10]))
  // Los tres casos que NO cuadraban.
  caso('con medios céntimos', true, cuadra([0.005, 0.005, 0.005]))
  caso('con tres decimales', true, cuadra([12.345, 12.345]))
  caso('con muchos medios céntimos', true, cuadra(Array(10).fill(1.005)))
  // Y el clásico de la coma flotante, que sí cuadraba y tiene que seguir.
  caso('con 0,1 + 0,2', true, cuadra([0.1, 0.2]))
  // Una remesa de una hermandad de verdad: 600 recibos.
  caso('con seiscientos recibos', true, cuadra(Array(600).fill(37.5)))
}

/**
 * LO QUE EL BANCO MIDE ANTES DE LEER: longitudes y juego de caracteres.
 *
 * Un fichero pain.008 no se rechaza «un poco». O pasa el validador entero o no
 * pasa, y entonces no se cobra NADA: ni un recibo de los mil. Y eso se descubre
 * días después, con el mes empezado.
 *
 * Aquí estaban los dos fallos que garantizaban el rechazo:
 *
 *   1. `MndtId` iba como «MND-» + el id del hermano, y ese id es un UUID de 36
 *      caracteres. Cuarenta en un campo de treinta y cinco, en TODAS las
 *      líneas, en cualquier hermandad con base de datos.
 *   2. Y nada se transcribía. El estándar europeo no admite tildes ni eñes, y
 *      un censo español va lleno: María, Muñoz, Núñez, Peñalver.
 *
 * Ninguno de los dos se ve al descargar el fichero: el XML parece perfecto.
 */
export async function _limitesDelBanco({ cargar, caso }) {
  const m = await cargar('src/lib/sepa.ts')

  // Una hermandad de verdad: el nombre legal se pasa de 70 con facilidad.
  const acreedor = {
    nombre: 'Real, Ilustre y Fervorosa Hermandad y Cofradia de Nazarenos de Nuestro Padre Jesus del Gran Poder',
    iban: 'ES9121000418450200051332',
    identificadorAcreedor: 'ES23000B12345678',
  }
  // Un id como los que hace la aplicación de verdad: `crypto.randomUUID()`.
  const uuid = '3f2a9c14-8b7d-4e51-9a02-6c1d5e8f7b39'
  const recibos = [{
    numero: 1,
    deudor: {
      nombre: 'Peñalver Núñez, María del Rocío de la Santísima Trinidad y de los Ángeles Custodios',
      hermanoId: uuid, numeroHermano: 7, antiguedad: 1998,
      iban: 'ES7921000813610123456789',
    },
    importe: 60,
    concepto: 'Cuota anual · ejercicio 2026 — Hermandad',
  }]
  const xml = m.buildSepaXml(acreedor, recibos, new Date(2027, 2, 1), new Date(2027, 1, 14, 10, 0))

  const dentro = (etiqueta) => [...xml.matchAll(new RegExp(`<${etiqueta}>([^<]*)</${etiqueta}>`, 'g'))].map((x) => x[1])

  // --- 1. Longitudes. Ni uno de más.
  caso('MndtId cabe en 35', true, dentro('MndtId').every((v) => v.length <= 35))
  caso('y es el del UUID, sin guiones', 'MND3F2A9C148B7D4E519A026C1D5E8F7B39', dentro('MndtId')[0])
  caso('MsgId cabe en 35', true, dentro('MsgId').every((v) => v.length <= 35))
  caso('PmtInfId cabe en 35', true, dentro('PmtInfId').every((v) => v.length <= 35))
  caso('EndToEndId cabe en 35', true, dentro('EndToEndId').every((v) => v.length <= 35))
  caso('ningún Nm se pasa de 70', true, dentro('Nm').every((v) => v.length <= 70))
  caso('Ustrd cabe en 140', true, dentro('Ustrd').every((v) => v.length <= 140))

  // --- 2. Juego de caracteres. Ni tildes, ni eñes, ni símbolos raros.
  const ADMITIDOS = /^[A-Za-z0-9/\-?:().,'+ ]*$/
  for (const etiqueta of ['Nm', 'Ustrd', 'MndtId']) {
    caso(`${etiqueta} solo lleva caracteres de SEPA`, '', dentro(etiqueta).filter((v) => !ADMITIDOS.test(v)).join(' | '))
  }
  // Y que se TRANSCRIBA, no que se borre: la eñe pasa a n, no desaparece.
  caso('«Peñalver Núñez» entra como «Penalver Nunez»', true, dentro('Nm').some((v) => v.startsWith('Penalver Nunez')))
  caso('y el nombre del acreedor también', true, dentro('Nm').some((v) => v.startsWith('Real, Ilustre y Fervorosa')))

  // El punto medio del concepto y la raya no están admitidos: pasan a espacio,
  // no se pegan las palabras.
  caso('el concepto se limpia sin pegar palabras', 'Cuota anual ejercicio 2026 Hermandad', dentro('Ustrd')[0])

  // --- Y con el censo entero, que es cuando duele.
  const muchos = Array.from({ length: 300 }, (_, i) => ({
    numero: i + 1,
    deudor: {
      nombre: `Muñoz Peñalver, José María ${i}`,
      hermanoId: `${uuid.slice(0, 34)}${String(i % 100).padStart(2, '0')}`,
      numeroHermano: i + 1, antiguedad: 2000,
      iban: 'ES7921000813610123456789',
    },
    importe: 45.5,
    concepto: 'Cuota anual',
  }))
  const grande = m.buildSepaXml(acreedor, muchos, new Date(2027, 2, 1), new Date(2027, 1, 14, 10, 0))
  const todosLosCampos = [...grande.matchAll(/<(Nm|MndtId|Ustrd|EndToEndId)>([^<]*)<\/\1>/g)]
  caso('en 300 recibos no se pasa ninguno', '', todosLosCampos.filter(([, e, v]) =>
    v.length > (e === 'Ustrd' ? 140 : e === 'Nm' ? 70 : 35)).map(([, e]) => e).join(', '))
  caso('ni lleva ninguno un carácter prohibido', '', todosLosCampos.filter(([, , v]) => !ADMITIDOS.test(v)).map(([, e]) => e).join(', '))
}
