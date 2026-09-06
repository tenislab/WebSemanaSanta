/**
 * EL CERTIFICADO DE ANTIGÜEDAD.
 *
 * El papel que pide un hermano cuando tiene que ACREDITAR ANTE ALGUIEN que lo
 * es y desde cuándo: para entrar en otra hermandad, para el consejo de
 * cofradías, para una bolsa de caridad, para el varal que va por antigüedad.
 *
 * Es de los pocos documentos que la hermandad emite HACIA FUERA, y eso manda
 * sobre todo lo demás:
 *
 *   · Lleva NÚMERO DE REGISTRO. Quien lo recibe puede llamar a la hermandad y
 *     preguntar por el 14/2027. Sin número es una carta bonita.
 *   · Está escrito en la fórmula de siempre —«CERTIFICA: Que D./Dña. …»—, que
 *     no es floritura: es lo que hace que quien lo lee al otro lado lo
 *     reconozca como lo que es.
 *   · Y lleva DOS FIRMAS: la del secretario, que es quien certifica, y el visto
 *     bueno del hermano mayor. Si un cargo está vacante sale la línea con su
 *     título y sin nombre, igual que en papel.
 *
 * TODO LO QUE SE PINTA VIENE DE LA COPIA GUARDADA, no de la ficha del hermano.
 * Un certificado dice lo que decía el día que se firmó: si mañana se corrige
 * una antigüedad mal importada, el papel que esa persona lleva en la mano no
 * cambia.
 */
import { LogoMark } from './Logo'
import { hayDatosDeEjemplo } from '../lib/demo'
import type { HermandadSettings } from '../lib/hermandadSettings'
import { referenciaCertificado, type Certificado } from '../data/certificados'

export default function CertificadoAntiguedad({ certificado: c, hermandad }: {
  certificado: Certificado
  hermandad: HermandadSettings
}) {
  const direccion = [hermandad.direccion, hermandad.codigoPostal, hermandad.ciudad]
    .filter(Boolean).join(', ')
  const donde = hermandad.ciudad || ''
  const anios = c.aniosDeAntiguedad

  return (
    <div className="recibo-doc print-doc certificado-doc">
      <div className="recibo-doc__head">
        <div className="recibo-doc__brand">
          <span className="recibo-doc__logo">
            {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={30} />}
          </span>
          <div className="recibo-doc__brand-text">
            <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
            {hermandad.cif && <span>CIF {hermandad.cif}</span>}
            {direccion && <span>{direccion}</span>}
            {hermandad.email && <span>{hermandad.email}</span>}
          </div>
        </div>
        <div className="recibo-doc__meta">
          <p className="eyebrow">Certificado de antigüedad</p>
          <span className="recibo-doc__num">Nº {referenciaCertificado(c)}</span>
          <span className="recibo-doc__date">Expedido el {c.fecha}</span>
        </div>
      </div>

      <h2 className="certificado-doc__titulo">Certificado de antigüedad</h2>

      <div className="certificado-doc__cuerpo">
        {/* Quien certifica va PRIMERO y con su cargo: es lo que le da valor al
            papel. Con la secretaría vacante se dice así, en vez de dejar un
            hueco en medio de la frase. */}
        <p>
          {c.firmaSecretario
            ? <>D./Dña. <b>{c.firmaSecretario}</b>, Secretario/a de {hermandad.nombreLegal || 'esta hermandad'},</>
            : <>La Secretaría de {hermandad.nombreLegal || 'esta hermandad'},</>}
        </p>

        <p className="certificado-doc__certifica">CERTIFICA:</p>

        <p>
          Que D./Dña. <b>{c.hermanoNombre}</b>
          {c.hermanoDni && <>, con DNI <b>{c.hermanoDni}</b>,</>}
          {' '}figura inscrito/a como hermano/a de esta corporación
          {c.hermanoNumero > 0 && <> con el número <b>{c.hermanoNumero}</b></>}
          {' '}desde el año <b>{c.antiguedad}</b>, contando por tanto con{' '}
          <b>{anios} {anios === 1 ? 'año' : 'años'}</b> de antigüedad
          {/* Cero años no es un error: es quien acaba de entrar este mismo año,
              y el papel se le expide igual. Se dice para que quien lo lea no
              piense que falta un dato. */}
          {anios === 0 && <> (alta en el año en curso)</>}
          , y que se encuentra en pleno uso de sus derechos como tal.
        </p>

        {c.motivo && (
          <p>
            Y para que así conste a los efectos de <b>{c.motivo}</b>, se expide el presente
            certificado a petición del interesado/a.
          </p>
        )}
        {!c.motivo && (
          <p>Y para que así conste donde proceda, se expide el presente a petición del interesado/a.</p>
        )}

        <p className="certificado-doc__lugar">
          {donde ? `En ${donde}, a ` : 'A '}{c.fecha}.
        </p>
      </div>

      {/* LAS DOS FIRMAS, en el sitio de siempre: el visto bueno a la izquierda
          y quien certifica a la derecha. El hueco entre la línea y el nombre es
          para firmar y sellar a mano, que es como se termina este papel. */}
      <div className="certificado-doc__firmas">
        <div>
          <span className="certificado-doc__vb">V.º B.º</span>
          <span className="certificado-doc__linea" />
          <b>El Hermano Mayor</b>
          {c.firmaHermanoMayor && <span>{c.firmaHermanoMayor}</span>}
        </div>
        <div>
          <span className="certificado-doc__vb">&nbsp;</span>
          <span className="certificado-doc__linea" />
          <b>El/La Secretario/a</b>
          {c.firmaSecretario && <span>{c.firmaSecretario}</span>}
        </div>
      </div>

      <p className="recibo-doc__note">
        {hermandad.textoPieDocumentos || (hayDatosDeEjemplo()
          ? 'Documento generado por Gobergo · datos de ejemplo, sin validez'
          : 'Documento generado por Gobergo')}
        {' · '}Registrado con el nº {referenciaCertificado(c)} en el libro de certificados de la hermandad.
      </p>
    </div>
  )
}
