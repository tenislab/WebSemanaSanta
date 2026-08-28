/**
 * LAS DEVOLUCIONES DEL BANCO (C3).
 *
 * Se manda la remesa, el banco cobra, y unos días después devuelve una parte.
 * Sin leer ese fichero, TODOS los recibos se quedan «Pagada»: la hermandad cree
 * que tiene un dinero que no tiene, al hermano devuelto no se le vuelve a pasar
 * el recibo, y a la remesa siguiente entra otra vez la cuenta cancelada — con
 * su comisión otra vez.
 */
export default async function ({ cargar, caso }) {
  const d = await cargar('src/lib/devoluciones.ts')

  const pain002 = (transacciones) => `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.002.001.03">
  <CstmrPmtStsRpt>
    <GrpHdr><MsgId>DEV-1</MsgId><CreDtTm>2026-03-05T09:00:00</CreDtTm></GrpHdr>
    <OrgnlGrpInfAndSts><OrgnlMsgId>REM-1</OrgnlMsgId><OrgnlMsgNmId>pain.008.001.02</OrgnlMsgNmId></OrgnlGrpInfAndSts>
    <OrgnlPmtInfAndSts>
      <OrgnlPmtInfId>REM-1-1</OrgnlPmtInfId>
      ${transacciones}
    </OrgnlPmtInfAndSts>
  </CstmrPmtStsRpt>
</Document>`

  const tx = (endToEnd, codigo, importe, estado = 'RJCT') => `
      <TxInfAndSts>
        <OrgnlEndToEndId>${endToEnd}</OrgnlEndToEndId>
        <TxSts>${estado}</TxSts>
        <StsRsnInf><Rsn><Cd>${codigo}</Cd></Rsn></StsRsnInf>
        <OrgnlTxRef><Amt><InstdAmt Ccy="EUR">${importe}</InstdAmt></Amt></OrgnlTxRef>
      </TxInfAndSts>`

  /* 1. Un fichero normal, con tres devoluciones. */
  {
    const r = d.leerDevoluciones(pain002(
      tx('REC-101', 'AM04', '30.00') + tx('REC-102', 'AC04', '30.00') + tx('REC-215', 'MS02', '45.50'),
    ))
    caso('se lee', true, r.ok)
    caso('trae las tres', 3, r.devoluciones.length)
    caso('con su número de recibo', '101,102,215', r.devoluciones.map((x) => x.numeroRecibo).join(','))
    caso('con su importe', 30, r.devoluciones[0].importe)
    caso('y con decimales', 45.5, r.devoluciones[2].importe)
    // El motivo EN CRISTIANO, que es lo que decide qué se hace con cada uno.
    caso('sin fondos se dice así', 'No había saldo suficiente', r.devoluciones[0].motivo)
    caso('cuenta cancelada, así', 'La cuenta está cancelada', r.devoluciones[1].motivo)
    caso('y el rechazo del titular, así', 'El titular ha rechazado el cargo', r.devoluciones[2].motivo)
  }

  /*
   * 2. SOLO LO RECHAZADO. Un pain.002 puede traer también las que salieron
   * bien. Darlas por devueltas dejaría al hermano debiendo una cuota que sí
   * pagó, y es un fallo que no se ve: el recibo pasa a «Devuelta» sin ruido.
   */
  {
    const r = d.leerDevoluciones(pain002(
      tx('REC-1', 'AM04', '30.00', 'RJCT') + tx('REC-2', '', '30.00', 'ACSC') + tx('REC-3', '', '30.00', 'ACCP'),
    ))
    caso('solo entra la rechazada', 1, r.devoluciones.length)
    caso('y es la que era', 1, r.devoluciones[0].numeroRecibo)
  }

  /*
   * 3. CADA BANCO USA SU PREFIJO DE ESPACIO DE NOMBRES. Sin quitarlos, el
   * fichero de un banco se lee y el del de al lado no — y desde fuera parece
   * que el segundo banco manda un fichero roto.
   */
  {
    const conPrefijo = pain002(tx('REC-7', 'AC06', '12.00'))
      .replace(/<(\/?)([A-Z][A-Za-z]*)/g, '<$1ns2:$2')
    const r = d.leerDevoluciones(conPrefijo)
    caso('con prefijos se lee igual', true, r.ok)
    caso('y trae lo mismo', 7, r.devoluciones[0].numeroRecibo)
  }

  /* 4. La referencia, escrita como venga. */
  {
    caso('REC-128', 128, d.numeroDeReferencia('REC-128'))
    caso('rec_128 también', 128, d.numeroDeReferencia('rec_128'))
    caso('y el número a secas', 128, d.numeroDeReferencia('128'))
    caso('con espacios', 128, d.numeroDeReferencia('  REC-128 '))
    caso('lo que no se reconoce, no se inventa', null, d.numeroDeReferencia('MANDATO-XY'))
    caso('ni vacío', null, d.numeroDeReferencia(''))
  }

  /*
   * 5. EL CUADERNO ANTIGUO SE RECONOCE Y SE RECHAZA CON INSTRUCCIONES.
   *
   * No se interpreta a propósito: acertar sus columnas exige saber en qué
   * posición pone cada banco cada cosa, y adivinarlas es leer el número de
   * recibo del sitio equivocado. Eso no falla con un error: marca como devuelta
   * LA CUOTA DE OTRO HERMANO.
   */
  {
    const viejo = [
      '5180' + '1'.repeat(100),
      '5380' + '2'.repeat(100),
      '5980' + '3'.repeat(100),
    ].join('\n')
    const r = d.leerDevoluciones(viejo)
    caso('no se interpreta', false, r.ok)
    caso('se reconoce que es el antiguo', true, /cuaderno antiguo/.test(r.error))
    caso('y se dice qué pedir', true, /pain\.002/.test(r.error))
  }

  /* 6. Y los demás rechazos, dichos para quien no es informático. */
  {
    caso('vacío', true, /vacío/.test(d.leerDevoluciones('   ').error))
    caso('un texto cualquiera', true, /pain\.002/.test(d.leerDevoluciones('hola qué tal').error))
    // Subir la propia remesa en vez del acuse es un error normal, y el mensaje
    // lo dice en vez de hablar de esquemas.
    const remesa = '<?xml version="1.0"?><Document><CstmrDrctDbtInitn><GrpHdr/></CstmrDrctDbtInitn></Document>'
    caso('la remesa no es el acuse', false, d.leerDevoluciones(remesa).ok)
    caso('y se explica cuál es cuál', true, /devuelve DESPUÉS/.test(d.leerDevoluciones(remesa).error))
    // Un fichero bien formado y sin devoluciones no es un error: es que se
    // cobró todo.
    const limpio = d.leerDevoluciones(pain002(tx('REC-1', '', '30.00', 'ACSC')))
    caso('sin devoluciones se dice, y bien', true, /buena noticia/.test(limpio.error))
  }

  /*
   * 7. CRUZAR CON LOS RECIBOS. Las que no casan NO SE TIRAN: un recibo que el
   * banco devuelve y que aquí no aparece significa que algo no cuadra, y eso
   * hay que verlo. Tragárselas dejaría dinero descuadrado sin ninguna pista.
   */
  {
    const recibos = [{ numero: 101, id: 'a' }, { numero: 102, id: 'b' }]
    const devs = [
      { referencia: 'REC-101', numeroRecibo: 101, codigo: 'AM04', motivo: 'x', importe: 30 },
      { referencia: 'REC-999', numeroRecibo: 999, codigo: 'AC04', motivo: 'y', importe: 12 },
      { referencia: 'RARO', numeroRecibo: null, codigo: 'MS03', motivo: 'z', importe: 5 },
    ]
    const c = d.cruzarConRecibos(devs, recibos)
    caso('casa la que existe', 1, c.casadas.length)
    caso('con su recibo', 'a', c.casadas[0].recibo.id)
    caso('y las otras dos se enseñan, no se tiran', 2, c.huerfanas.length)
    caso('la de número desconocido también', true, c.huerfanas.some((x) => x.referencia === 'RARO'))
  }

  /* 8. El resumen que se enseña antes de aplicar nada. */
  {
    const recibos = [{ numero: 1 }, { numero: 2 }]
    const devs = [
      { referencia: 'REC-1', numeroRecibo: 1, codigo: 'AM04', motivo: 'x', importe: 30 },
      { referencia: 'REC-2', numeroRecibo: 2, codigo: 'AM04', motivo: 'x', importe: 12.5 },
    ]
    const texto = d.resumenDeLaLectura(d.cruzarConRecibos(devs, recibos))
    caso('dice cuántos', true, /2 recibos devueltos/.test(texto))
    // El importe además del número: «12 devoluciones» no asusta lo que asusta
    // «12 devoluciones, 360 €», y es la misma información.
    caso('y cuánto dinero', true, /42,50/.test(texto))
    const conHuerfana = d.resumenDeLaLectura(d.cruzarConRecibos(
      [...devs, { referencia: 'REC-9', numeroRecibo: 9, codigo: 'AM04', motivo: 'x', importe: 1 }], recibos))
    caso('y avisa de las que no cuadran', true, /no cuadra/.test(conHuerfana))
  }

  /*
   * 9. EL HILO QUE UNE LOS DOS FICHEROS.
   *
   * El `EndToEndId` que se escribe al presentar (`lib/sepa.ts`) es lo ÚNICO que
   * permite reconocer el recibo cuando vuelve. Cambiarlo en un sitio y no en el
   * otro deja las devoluciones sin casar con nada, en silencio y para siempre.
   */
  {
    const { readFile } = await import('node:fs/promises')
    const sepa = await readFile('src/lib/sepa.ts', 'utf8')
    caso('la remesa sigue marcando REC-<número>', true, /<EndToEndId>REC-\$\{r\.numero\}<\/EndToEndId>/.test(sepa))
    // Y lo que se genera se sabe leer: se cierra el círculo con el formato real.
    caso('y ese formato se sabe leer', 128, d.numeroDeReferencia('REC-128'))
  }

  /* 10. La marca del contra-apunte en Tesorería. */
  {
    caso('lleva el id de la cuota', 'devolucion:abc', d.origenDeDevolucion('abc'))
  }
}
