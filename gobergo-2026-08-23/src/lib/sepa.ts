/**
 * Generador de remesas de adeudo directo SEPA CORE (ISO 20022, esquema
 * pain.008.001.02), el fichero XML que se presenta al banco para cobrar
 * recibos domiciliados. Se genera entero en el navegador, sin backend.
 *
 * El identificador de mandato (MndtId) y su fecha de firma se sintetizan a
 * partir del número de hermano y su antigüedad, porque la app todavía no
 * guarda mandatos SEPA firmados de verdad: es un valor de partida razonable,
 * pero conviene revisarlo con el banco antes del primer envío real.
 */

import { ibanValido, limpiarIban, porQueNoValeElIban } from './iban'

export interface SepaAcreedor {
  nombre: string
  iban: string
  identificadorAcreedor: string
}

export interface SepaDeudor {
  nombre: string
  iban: string
  /**
   * Id del hermano en la base. Es lo que identifica el mandato, porque NO
   * cambia: el número de hermano se renumera con cada baja.
   */
  hermanoId?: string
  /** Solo para mostrar; ya no se usa para el identificador de mandato. */
  numeroHermano: number
  antiguedad: number
}

export interface SepaRecibo {
  numero: number
  deudor: SepaDeudor
  importe: number
  concepto: string
}


/**
 * EL JUEGO DE CARACTERES QUE ADMITE UNA REMESA SEPA, que NO es el del idioma.
 *
 * El estándar europeo (EPC, y el Cuaderno 19-14 del sector español que lo
 * sigue) admite solo esto:
 *
 *     a-z  A-Z  0-9  /  -  ?  :  (  )  .  ,  '  +  y el espacio
 *
 * Ni tildes, ni la eñe, ni la diéresis. Y un fichero de una hermandad española
 * viene lleno de las tres: «María», «Muñoz», «Núñez», «Peñalver». Mandarlo tal
 * cual es jugársela a lo que haga cada banco: unos rechazan el fichero entero,
 * otros lo aceptan y sustituyen cada carácter raro por un símbolo, y el nombre
 * del titular deja de coincidir con el de la cuenta — que es motivo de
 * devolución, con su comisión.
 *
 * Aquí se transcribe: «Muñoz» → «Munoz». Se pierde la tilde y se cobra el
 * recibo, que es lo que se venía a hacer.
 */
function soloCaracteresSepa(texto: string): string {
  return texto
    // Descompone «á» en «a» + tilde y se queda con la letra.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // La eñe descompuesta ya ha quedado en «n». Lo que siga sin ser admitido
    // —comillas tipográficas, guiones largos, símbolos— pasa a espacio, no se
    // borra: pegar dos palabras cambiaría el nombre más que separarlas.
    .replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Recorta a lo que cabe en el campo.
 *
 * El esquema pain.008 define los campos como `Max35Text` o `Max70Text`, y un
 * validador de banco no perdona un carácter de más: rechaza el fichero entero
 * sin decir cuál era la línea larga.
 */
function cabe(texto: string, largo: number): string {
  return texto.length <= largo ? texto : texto.slice(0, largo).trim()
}

/** Un texto listo para un campo del fichero: sin caracteres raros, sin pasarse de largo y escapado. */
function campo(texto: string, largo: number): string {
  return escaparXml(cabe(soloCaracteresSepa(texto), largo))
}

function escaparXml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Fecha en ISO pero con la hora LOCAL. Con `toISOString()` la medianoche
 * española es el día ANTERIOR en UTC, así que la fecha de cobro del fichero
 * salía siempre un día antes de lo pedido — todo el año, no solo de madrugada.
 * Si el día elegido era el mínimo de presentación, el banco rechazaba la
 * remesa entera por fuera de plazo.
 */
function fechaIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Comprueba que hay lo mínimo para poder generar la remesa. */
export function acreedorIncompleto(acreedor: SepaAcreedor): string | null {
  if (!acreedor.nombre.trim()) return 'Falta el nombre legal de la hermandad.'
  if (!limpiarIban(acreedor.iban)) return 'Falta el IBAN de la hermandad: sin él el banco no sabe dónde ingresar.'
  /*
   * Y QUE SEA UN IBAN DE VERDAD, no solo que esté escrito algo.
   *
   * Este es el de la hermandad, el de cobro: si está mal, el banco rechaza el
   * fichero ENTERO. No una línea — el fichero. Y el aviso que llega es un
   * código que no dice qué pasa, así que conviene pararlo aquí, donde todavía
   * se puede leer «te falta un dígito».
   */
  if (!ibanValido(acreedor.iban)) {
    return `El IBAN de la hermandad no vale: ${porQueNoValeElIban(acreedor.iban)}. `
      + 'Está en Configuración → La hermandad.'
  }
  if (!acreedor.identificadorAcreedor.trim()) {
    return 'Falta el identificador de acreedor SEPA. Lo da el banco, y es gratis.'
  }
  return null
}

/**
 * Construye el XML pain.008.001.02 de una remesa de adeudos CORE recurrentes
 * (RCUR), con una fecha de cobro y un lote por remesa. `ahora` se pasa desde
 * fuera para no depender de Date.now() dentro de esta función pura.
 */
/**
 * EL IMPORTE DE UNA LÍNEA, en céntimos enteros.
 *
 * Todo el dinero del fichero pasa por aquí, y es lo que hace que la suma de
 * control cuadre siempre con las líneas. Ver `buildSepaXml`.
 */
function centimos(importe: number): number {
  return Math.round(importe * 100)
}

/** Céntimos escritos como los quiere el banco: «60.00». */
function euros(cent: number): string {
  return (cent / 100).toFixed(2)
}

export function buildSepaXml(acreedor: SepaAcreedor, recibos: SepaRecibo[], fechaCobro: Date, ahora: Date): string {
  const msgId = `CABILDO-${ahora.getTime()}`
  const ibanAcreedor = limpiarIban(acreedor.iban)

  /*
   * LA SUMA DE CONTROL SE SACA DE LAS LÍNEAS, no de los importes de partida.
   *
   * El banco RECHAZA EL FICHERO ENTERO si `CtrlSum` no es exactamente la suma
   * de los `InstdAmt`. Y antes se calculaban por caminos distintos: cada línea
   * redondeaba su importe a dos decimales, y la suma de control sumaba los
   * importes sin redondear y redondeaba al final. Con cualquier importe de más
   * de dos decimales las dos cuentas se separan:
   *
   *     tres recibos de 0,005 €  →  líneas 0,01+0,01+0,01 = 0,03
   *                                 suma de control        = 0,02
   *
   * No es un caso rebuscado: basta con que alguien teclee 12,345 en el importe
   * de un concepto, o que venga así de una hoja de cálculo. Y el fallo no se
   * ve al descargar —el XML parece correcto—: se ve tres días después, cuando
   * el banco devuelve la remesa entera y nadie ha cobrado.
   *
   * Ahora se cuenta en CÉNTIMOS ENTEROS, se suman esos, y las dos cifras salen
   * del mismo sitio. Cuadran por construcción.
   */
  /*
   * El nombre legal de una hermandad se pasa de 70 caracteres con facilidad
   * —«Real, Ilustre y Fervorosa Hermandad y Cofradía de Nazarenos de…»— y
   * `Nm` es `Max70Text`. Por eso todos los nombres del fichero pasan por
   * `campo()`: recortarlos aquí es lo que evita que el banco tumbe la remesa.
   */
  const importes = recibos.map((r) => centimos(r.importe))
  const ctrlSum = euros(importes.reduce((s, c) => s + c, 0))

  const transacciones = recibos
    .map((r, i) => {
      /*
       * EL IDENTIFICADOR DE MANDATO: DEL ID DEL HERMANO, Y EN 35 CARACTERES.
       *
       * Del id del hermano porque NO cambia: con el número de hermano, cada
       * baja renumera el censo y el mismo hermano se presentaba al banco cada
       * mes con un identificador distinto —el que era del vecino—, y todos los
       * de baja compartían «MND-0».
       *
       * Y en 35 porque `MndtId` es `Max35Text`. Aquí ponía `MND-` + el id, y
       * el id es un UUID de 36 caracteres: 40 en total, CINCO DE MÁS, en todas
       * y cada una de las líneas. Eso no se ve al descargar el fichero —el XML
       * parece perfecto— y no se ve hasta que el banco rechaza la remesa
       * entera, con los recibos sin cobrar y el mes empezado.
       *
       * Quitarle los guiones al UUID lo deja en 32, y con «MND» delante son 35
       * justos. Sigue saliendo del mismo sitio y sigue sin cambiar nunca.
       */
  const mndtId = cabe(`MND${String(r.deudor.hermanoId ?? r.deudor.numeroHermano).replace(/-/g, '').toUpperCase()}`, 35)
      const fechaFirma = `${r.deudor.antiguedad}-01-01`
      return `      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>REC-${r.numero}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${euros(importes[i])}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${campo(mndtId, 35)}</MndtId>
            <DtOfSgntr>${fechaFirma}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            <Othr>
              <Id>NOTPROVIDED</Id>
            </Othr>
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${campo(r.deudor.nombre, 70)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <IBAN>${limpiarIban(r.deudor.iban)}</IBAN>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${campo(r.concepto, 140)}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${ahora.toISOString()}</CreDtTm>
      <NbOfTxs>${recibos.length}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty>
        <Nm>${campo(acreedor.nombre, 70)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${recibos.length}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${fechaIso(fechaCobro)}</ReqdColltnDt>
      <Cdtr>
        <Nm>${campo(acreedor.nombre, 70)}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${ibanAcreedor}</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <Othr>
            <Id>NOTPROVIDED</Id>
          </Othr>
        </FinInstnId>
      </CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${campo(acreedor.identificadorAcreedor.replace(/\s+/g, ''), 35)}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>
${transacciones}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>
`
}
