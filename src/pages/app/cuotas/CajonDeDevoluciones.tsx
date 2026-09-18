/**
 * EL CAJÓN DE LAS DEVOLUCIONES DEL BANCO.
 *
 * Se sube el fichero, se LEE, y se enseña lo que trae ANTES de tocar nada:
 * cuáles ha encontrado, cuáles no —esas se pintan igual, para que no se
 * pierdan— y cuánto dinero se va a dar por no cobrado. Aplicar directo al
 * soltar el fichero sería cambiar veinte recibos y dos docenas de apuntes sin
 * que nadie haya visto qué trae.
 *
 * Es la otra mitad de la remesa: se manda el fichero, y unos días después el
 * banco contesta cuáles no ha podido cobrar.
 *
 * DOS PROPS: `devoluciones` de una pieza y el censo para poner el nombre de
 * cada uno al lado de su recibo.
 */
import Drawer from '../../../components/Drawer'
import type { Hermano } from '../../../data/hermanos'
import { formatCurrency } from '../../../lib/format'
import { resumenDeLaLectura } from '../../../lib/devoluciones'
import type { LasDevoluciones } from './devoluciones'

export default function CajonDeDevoluciones({ devoluciones, hermanos }: {
  devoluciones: LasDevoluciones
  /** Para poner el nombre de cada hermano al lado de su recibo devuelto. */
  hermanos: Hermano[]
}) {
  const {
    devolucionesOpen, cerrarDevoluciones, falloLectura, aplicando,
    cruceDevoluciones, cargarFicheroDeDevoluciones, aplicarDevoluciones,
  } = devoluciones
  return (
    <Drawer
      open={devolucionesOpen}
      onClose={cerrarDevoluciones}
      title="Devoluciones del banco"
      subtitle={cruceDevoluciones ? resumenDeLaLectura(cruceDevoluciones) : 'Sube el fichero que te da el banco'}
      ancho="ancho"
      footer={cruceDevoluciones && cruceDevoluciones.casadas.length > 0 && (
        <button
          className="btn btn-primary"
          onClick={aplicarDevoluciones}
          disabled={aplicando}
        >
          {aplicando
            ? 'Aplicando…'
            : `Marcar ${cruceDevoluciones.casadas.length} como devuelto${cruceDevoluciones.casadas.length === 1 ? '' : 's'}`}
        </button>
      )}
    >
      <div className="app-form">
        <p className="form-hint">
          Después de mandar una remesa, el banco devuelve los recibos que no ha podido cobrar.
          Descarga de tu banca electrónica el fichero <b>pain.002</b> —suele llamarse «informe de
          estado» o «devoluciones»— y súbelo aquí.
        </p>

        <div className="form-row">
          <label htmlFor="ficheroDevoluciones">Fichero del banco</label>
          <input
            id="ficheroDevoluciones"
            type="file"
            accept=".xml,text/xml,application/xml,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void cargarFicheroDeDevoluciones(f)
              // Para poder volver a subir el mismo fichero si hizo falta
              // corregir algo antes: sin esto, el segundo intento no dispara.
              e.target.value = ''
            }}
          />
        </div>

        {falloLectura && <p className="form-hint form-hint--error">{falloLectura}</p>}

        {cruceDevoluciones && (
          <>
            {cruceDevoluciones.casadas.length > 0 && (
              <>
                <h3 className="settings-card__subtitle">Se va a marcar como devuelto</h3>
                <div className="table-card">
                  <table>
                    <thead>
                      <tr><th>Recibo</th><th>Hermano/a</th><th>Importe</th><th>Por qué lo devuelven</th></tr>
                    </thead>
                    <tbody>
                      {cruceDevoluciones.casadas.map(({ recibo, devolucion }) => (
                        <tr key={recibo.id}>
                          <td><code>{devolucion.referencia}</code></td>
                          <td>{hermanos.find((h) => h.id === recibo.hermanoId)?.nombre ?? '—'}</td>
                          <td className="num">{formatCurrency(devolucion.importe || recibo.importe)}</td>
                          <td>{devolucion.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/*
              LAS QUE NO CUADRAN SE ENSEÑAN, NO SE TIRAN. Un recibo que el
              banco devuelve y que aquí no aparece significa que algo no
              encaja —el fichero es de otra remesa, o de otra hermandad— y
              eso hay que verlo antes de aplicar nada.
            */}
            {cruceDevoluciones.huerfanas.length > 0 && (
              <>
                <h3 className="settings-card__subtitle" style={{ marginTop: '1.2rem' }}>
                  No cuadran con ningún recibo de aquí
                </h3>
                <p className="form-hint form-hint--error">
                  Estas devoluciones vienen en el fichero pero su recibo no está en esta
                  hermandad. Míralo antes de aplicar: puede que el fichero sea de otra remesa.
                </p>
                <ul className="lista-limpia">
                  {cruceDevoluciones.huerfanas.map((x, i) => (
                    <li key={`${x.referencia}-${i}`}>
                      <code>{x.referencia || '(sin referencia)'}</code> · {formatCurrency(x.importe)} · {x.motivo}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </Drawer>
  )
}
