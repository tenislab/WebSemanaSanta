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

export interface SepaAcreedor {
  nombre: string
  iban: string
  identificadorAcreedor: string
}

export interface SepaDeudor {
  nombre: string
  iban: string
  /** Para sintetizar el identificador de mandato y su fecha de firma. */
  numeroHermano: number
  antiguedad: number
}

export interface SepaRecibo {
  numero: number
  deudor: SepaDeudor
  importe: number
  concepto: string
}

function limpiarIban(iban: string) {
  return iban.replace(/\s+/g, '').toUpperCase()
}

function escaparXml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function fechaIso(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Comprueba que hay lo mínimo para poder generar la remesa. */
export function acreedorIncompleto(acreedor: SepaAcreedor): string | null {
  if (!acreedor.nombre.trim()) return 'Falta el nombre legal de la hermandad (Configuración).'
  if (!limpiarIban(acreedor.iban)) return 'Falta el IBAN de la hermandad (Configuración).'
  if (!acreedor.identificadorAcreedor.trim()) return 'Falta el identificador de acreedor SEPA (Configuración).'
  return null
}

/**
 * Construye el XML pain.008.001.02 de una remesa de adeudos CORE recurrentes
 * (RCUR), con una fecha de cobro y un lote por remesa. `ahora` se pasa desde
 * fuera para no depender de Date.now() dentro de esta función pura.
 */
export function buildSepaXml(acreedor: SepaAcreedor, recibos: SepaRecibo[], fechaCobro: Date, ahora: Date): string {
  const msgId = `CABILDO-${ahora.getTime()}`
  const ctrlSum = recibos.reduce((s, r) => s + r.importe, 0).toFixed(2)
  const ibanAcreedor = limpiarIban(acreedor.iban)

  const transacciones = recibos
    .map((r) => {
      const mndtId = `MND-${r.deudor.numeroHermano}`
      const fechaFirma = `${r.deudor.antiguedad}-01-01`
      return `      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>REC-${r.numero}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${r.importe.toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${escaparXml(mndtId)}</MndtId>
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
          <Nm>${escaparXml(r.deudor.nombre)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <IBAN>${limpiarIban(r.deudor.iban)}</IBAN>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${escaparXml(r.concepto)}</Ustrd>
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
        <Nm>${escaparXml(acreedor.nombre)}</Nm>
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
        <Nm>${escaparXml(acreedor.nombre)}</Nm>
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
              <Id>${escaparXml(acreedor.identificadorAcreedor.replace(/\s+/g, ''))}</Id>
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
