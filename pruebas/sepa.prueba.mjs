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
  caso('escapa los caracteres de XML', true, xml.includes('Ana &lt;Gil&gt; &amp; C'))
  caso('no queda ningún & suelto', false, /&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml))
  caso('la fecha de cobro es la pedida', true, xml.includes('<ReqdColltnDt>2026-08-23</ReqdColltnDt>'))
  caso('esquema pain.008.001.02', true, xml.includes('pain.008.001.02'))
  caso('el IBAN va sin espacios', true, xml.includes('<IBAN>ES9121000418450200051332</IBAN>'))

  await laSumaDeControlCuadraSiempre({ m, acreedor, deudor, caso })
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
