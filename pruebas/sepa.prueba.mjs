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
}
