import { LogoMark } from './Logo'
import type { HermandadSettings } from '../lib/hermandadSettings'
import type { Memoria } from '../lib/memoria'

/**
 * LA MEMORIA DEL EJERCICIO, en el papel que se reparte en el cabildo general.
 *
 * Es el documento que la junta pone encima de la mesa una vez al año: cuántos
 * somos, quién entró, quién se fue, qué se cobró, qué se gastó y con qué saldo
 * se cierra. Hasta ahora había que armarlo a mano abriendo cinco pantallas y
 * copiando cifras a un documento aparte, que es justo como se cuela un número
 * que no cuadra con otro dos páginas más allá.
 *
 * Las cuentas no se hacen aquí: vienen dadas de `lib/memoria.ts`, que es una
 * función pura y con pruebas. Este fichero solo las coloca en la hoja. Es el
 * mismo reparto que el estado de cuentas, y por el mismo motivo: lo que se
 * lee en voz alta delante de la hermandad tiene que poder comprobarse en el
 * banco de pruebas, no mirando una pantalla.
 *
 * LO QUE SÍ SE DECIDE AQUÍ es que las advertencias VAN IMPRESAS. La nota de
 * que el censo es el de hoy y no el del cierre, y las bajas que constan sin
 * fecha, salen en el papel y no solo en la pantalla de quien lo genera. Un
 * aviso que se queda en el monitor no llega al hermano que lee el documento
 * seis meses después, que es exactamente quien necesita saberlo.
 */
export default function MemoriaEjercicio({
  hermandad,
  memoria,
  generadoEl,
  className = '',
}: {
  hermandad: HermandadSettings
  memoria: Memoria
  generadoEl: string
  className?: string
}) {
  const direccion = [hermandad.direccion, hermandad.codigoPostal, hermandad.ciudad, hermandad.provincia]
    .filter(Boolean)
    .join(', ')

  return (
    <div className={`recibo-doc print-doc estado-cuentas memoria-doc ${className}`.trim()}>
      {/* Se repite en cada hoja impresa (ver .print-hoja). */}
      <div className="print-hoja">
        {hermandad.nombreLegal || 'Tu hermandad'} · Memoria del ejercicio {memoria.anio}
      </div>

      <div className="recibo-doc__head">
        <div className="recibo-doc__brand">
          <span className="recibo-doc__logo">
            {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={30} />}
          </span>
          <div className="recibo-doc__brand-text">
            <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
            {hermandad.cif && <span>CIF {hermandad.cif}</span>}
            {direccion && <span>{direccion}</span>}
            {hermandad.telefono && <span>Tel. {hermandad.telefono}</span>}
            {hermandad.email && <span>{hermandad.email}</span>}
          </div>
        </div>
        <div className="recibo-doc__meta">
          <p className="eyebrow">Memoria del ejercicio</p>
          <span className="recibo-doc__num">Del 1 de enero al 31 de diciembre de {memoria.anio}</span>
          <span className="recibo-doc__date">Generado el {generadoEl}</span>
        </div>
      </div>

      {memoria.bloques.map((b) => (
        <section key={b.titulo} className="memoria-doc__bloque">
          <h3 className="estado-cuentas__seccion">{b.titulo.toUpperCase()}</h3>
          {b.nota && <p className="memoria-doc__nota">{b.nota}</p>}
          <table className="recibo-doc__table estado-cuentas__table">
            <tbody>
              {b.cifras.map((c) => (
                <tr key={c.etiqueta}>
                  <td>
                    {c.etiqueta}
                    {c.ayuda && <span className="memoria-doc__ayuda">{c.ayuda}</span>}
                  </td>
                  <td className="estado-cuentas__importe">{c.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {/* ------------------------------------------------------------------
          EL MOVIMIENTO DEL CENSO, CON NOMBRES.

          Las dos cifras de arriba —tantas altas, tantas bajas— son las que se
          leen; estas dos listas son las que se piden después. En un cabildo,
          «catorce bajas» se responde con «¿quiénes?».
          ------------------------------------------------------------------ */}
      <h3 className="estado-cuentas__seccion">A L T A S&nbsp; D E L&nbsp; E J E R C I C I O</h3>
      {memoria.altas.length === 0 ? (
        <p className="memoria-doc__vacio">Ningún hermano se dio de alta en {memoria.anio}.</p>
      ) : (
        <table className="recibo-doc__table estado-cuentas__table">
          <tbody>
            {memoria.altas.map((a) => (
              <tr key={`${a.numero}-${a.nombre}`}>
                {/* Los de baja llevan número 0, y en papel eso se lee como
                    «el hermano cero». Se pinta como en el resto de la app. */}
                <td className="memoria-doc__num">{a.numero > 0 ? a.numero : '—'}</td>
                <td>{a.nombre}</td>
                <td className="estado-cuentas__importe">{a.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="estado-cuentas__seccion">B A J A S&nbsp; D E L&nbsp; E J E R C I C I O</h3>
      {memoria.bajas.length === 0 ? (
        <p className="memoria-doc__vacio">Ninguna baja tramitada en {memoria.anio}.</p>
      ) : (
        <table className="recibo-doc__table estado-cuentas__table">
          <tbody>
            {memoria.bajas.map((b) => (
              <tr key={`${b.fecha}-${b.nombre}`}>
                <td className="memoria-doc__num">{b.fecha}</td>
                <td>{b.nombre}</td>
                <td className="estado-cuentas__importe">{b.motivo}</td>
              </tr>
            ))}
          </tbody>
          {/* Reserva la banda del pie repetido en cada hoja: `.print-hoja` va
              fijo y no le quita sitio a nada, así que sin esto pisa la última
              línea (ver InformeImpreso). Va en la última tabla del documento
              porque es un `tfoot`: suelto, fuera de una tabla, no reserva
              nada. */}
          <tfoot className="print-pie-hueco">
            <tr><td colSpan={3} /></tr>
          </tfoot>
        </table>
      )}
      {memoria.bajasSinFecha > 0 && (
        <p className="memoria-doc__nota">
          Constan además {memoria.bajasSinFecha}{' '}
          {memoria.bajasSinFecha === 1 ? 'baja' : 'bajas'} sin fecha registrada, de antes de que se
          guardara. No se atribuyen a ningún ejercicio.
        </p>
      )}

      {/* ------------------------------------------------------------------
          LAS FIRMAS.

          Una memoria sin firmar no es una memoria: es un listado. Van las dos
          que la aprueban, con la línea puesta para que se firme a mano sobre
          el papel impreso.
          ------------------------------------------------------------------ */}
      <div className="memoria-doc__firmas">
        <div>
          <span className="memoria-doc__linea" />
          <b>El secretario / la secretaria</b>
        </div>
        <div>
          <span className="memoria-doc__linea" />
          <b>El hermano mayor / la hermana mayor</b>
        </div>
      </div>

      <p className="recibo-doc__note">
        Documento generado a partir de los datos de gestión de la hermandad · sin validez oficial
        hasta su firma
      </p>
    </div>
  )
}
