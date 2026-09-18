/**
 * EL CAJÓN DE LA REMESA BANCARIA.
 *
 * Lo que se le enseña a la tesorería antes de descargar el fichero: cuántos
 * recibos van, cuánto dinero, qué día se presenta, y —lo que más falta hacía—
 * quiénes se CAEN y por qué. Eso último se caía en silencio.
 *
 * DOS PROPS: `remesa` es lo que devuelve `useLaRemesa()` de una pieza, y
 * `hermanoDe` para pintar cada fila con el nombre y el IBAN de su hermano.
 */
import { Link } from 'react-router-dom'
import Drawer from '../../../components/Drawer'
import type { Hermano } from '../../../data/hermanos'
import { formatCurrency } from '../../../lib/format'
import { hayDatosDeEjemplo } from '../../../lib/demo'
import type { useLaRemesa } from './remesa'

export default function CajonDeRemesa({ remesa, hermanoDe }: {
  remesa: ReturnType<typeof useLaRemesa>
  /** Para pintar cada fila con el nombre y el IBAN de su hermano. */
  hermanoDe: (id: string) => Hermano | undefined
}) {
  const {
    remesaOpen, setRemesaOpen, fechaRemesa, setFechaRemesa,
    recibosRemesables, avisoAcreedor,
    exportarRemesaCsv, descargarSepaXml, simularCobro,
  } = remesa
  return (
    <Drawer
      open={remesaOpen}
      onClose={() => setRemesaOpen(false)}
      title="Remesa bancaria"
      subtitle={`${recibosRemesables.length} recibo${recibosRemesables.length === 1 ? '' : 's'} pendiente${recibosRemesables.length === 1 ? '' : 's'} domiciliado${recibosRemesables.length === 1 ? '' : 's'}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={exportarRemesaCsv}>
            Solo CSV
          </button>
          {/* SOLO en modo demostración. Con una hermandad de verdad detrás,
              este botón daba por cobrada una remesa entera sin que hubiera
              entrado un euro: los recibos quedaban «Pagada», sin apunte en
              Tesorería, y encima devolvía una parte al azar. La contabilidad
              quedaba diciendo que se había cobrado algo que no se cobró, y
              deshacerlo es recibo por recibo. En una pantalla de trabajo,
              al lado de «Descargar XML», es un accidente esperando. */}
          {hayDatosDeEjemplo() && (
            <button className="btn btn-outline" onClick={simularCobro} title="Solo para probar: marca la remesa como cobrada sin que haya pasarela">
              Simular cobro
            </button>
          )}
          <button className="btn btn-primary" onClick={descargarSepaXml} disabled={!!avisoAcreedor || !fechaRemesa}>
            Descargar XML SEPA
          </button>
        </>
      }
    >
      <div className="app-form">
        {avisoAcreedor && (
          <div className="banner-inline banner-inline--warn">
            <span>{avisoAcreedor}</span>
            {/* Antes decía «(Configuración)» y había que buscarlo a mano. */}
            <Link to="/app/configuracion" className="btn btn-outline btn-sm">Ir a Configuración</Link>
          </div>
        )}
        <div className="form-row">
          <label htmlFor="fechaRemesa">Fecha de cobro</label>
          <input
            id="fechaRemesa"
            type="date"
            value={fechaRemesa}
            onChange={(e) => setFechaRemesa(e.target.value)}
          />
          <p className="form-hint">
            La misma fecha para todos los recibos del lote: es la fecha en la que el banco
            presentará el cobro a cada hermano.
          </p>
        </div>
        <div className="table-card table-card--in-drawer">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Hermano</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {recibosRemesables.map((c) => (
                <tr key={c.id}>
                  <td className="num">{c.numero}</td>
                  <td>{hermanoDe(c.hermanoId)?.nombre ?? '—'}</td>
                  <td className="num">{formatCurrency(c.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="form-hint">
          El XML es un fichero de adeudo directo SEPA CORE (pain.008.001.02) real, listo para
          subir a la banca online. El «Solo CSV» es un listado de trabajo para revisar antes de
          enviarlo.{' '}
          {hayDatosDeEjemplo() && (
            <>
              <b>Simular cobro</b> marca la remesa como pagada (sin pasarela real, para probar el
              ciclo completo); una pequeña parte se devuelve, como en la vida real. Solo aparece
              mientras estáis probando.
            </>
          )}
        </p>
        <p className="form-hint">
          Al descargar el XML, estos recibos quedan marcados como remesados y no vuelven a entrar
          en la siguiente remesa. Si al final no mandáis el fichero, podéis devolverlos desde el
          aviso que sale en la pantalla de cuotas.
        </p>
      </div>
    </Drawer>
  )
}
