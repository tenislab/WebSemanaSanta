import { LogoMark } from './Logo'
import type { HermandadSettings } from '../lib/hermandadSettings'

export default function InformeImpreso({
  hermandad,
  titulo,
  generadoEl,
  resumen,
  columnas,
  filas,
  className = '',
}: {
  hermandad: HermandadSettings
  titulo: string
  generadoEl: string
  resumen: { etiqueta: string; valor: string }[]
  columnas: string[]
  filas: (string | number)[][]
  className?: string
}) {
  const direccionHermandad = [hermandad.direccion, hermandad.codigoPostal, hermandad.ciudad]
    .filter(Boolean)
    .join(', ')

  return (
    <div className={`recibo-doc print-doc informe-doc ${className}`.trim()}>
      <div className="recibo-doc__head">
        <div className="recibo-doc__brand">
          <span className="recibo-doc__logo">
            {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={30} />}
          </span>
          <div className="recibo-doc__brand-text">
            <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
            {hermandad.cif && <span>CIF {hermandad.cif}</span>}
            {direccionHermandad && <span>{direccionHermandad}</span>}
          </div>
        </div>
        <div className="recibo-doc__meta">
          <p className="eyebrow">Informe</p>
          <span className="recibo-doc__num">{titulo}</span>
          <span className="recibo-doc__date">Generado el {generadoEl}</span>
        </div>
      </div>

      <div className="informe-doc__resumen">
        {resumen.map((r) => (
          <div key={r.etiqueta}>
            <span className="table-subtle">{r.etiqueta}</span>
            <b>{r.valor}</b>
          </div>
        ))}
      </div>

      <table className="recibo-doc__table informe-doc__table">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="recibo-doc__note">Documento generado por Cabildo · datos de ejemplo, sin validez oficial</p>
    </div>
  )
}
