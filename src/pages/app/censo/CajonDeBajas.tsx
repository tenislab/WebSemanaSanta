import Drawer from '../../../components/Drawer'
import { cuotaEnPalabras } from './columnas'
import type { SituacionCuota } from '../../../lib/estadoCuotaHermano'
import type { Hermano } from '../../../data/hermanos'

/**
 * LAS BAJAS QUE HAN PEDIDO LOS HERMANOS DESDE SU ÁREA.
 *
 * Sale de `Hermanos.tsx` por tamaño, no por acoplamiento: son siete props para
 * cincuenta líneas, y ninguna es estado que se pueda mover aquí —el censo, el
 * tramitar y el descartar son de la pantalla—. Lo que se gana es que la
 * pantalla del censo deja de llevar dentro un cajón que no tiene nada que ver
 * con la tabla.
 *
 * LO QUE NO SE TOCA, y conviene que se lea aquí: hasta que se tramite, quien
 * ha pedido la baja SIGUE SIENDO HERMANO de pleno derecho, con su número y su
 * antigüedad. Este cajón no da de baja a nadie solo por listarlo.
 */
export default function CajonDeBajas({
  abierto, onCerrar, bajasPedidas, situacionDe, onTramitar, onDescartar, onVerFicha,
}: {
  abierto: boolean
  onCerrar: () => void
  bajasPedidas: Hermano[]
  situacionDe: (id: string) => SituacionCuota
  onTramitar: (id: string) => void
  onDescartar: (id: string) => void
  onVerFicha: (id: string) => void
}) {
  return (
      <Drawer
        open={abierto}
        onClose={onCerrar}
        title="Bajas pedidas"
        subtitle={`${bajasPedidas.length} esperando`}
      >
        <div className="ficha">
          <p className="form-hint">
            Lo han pedido desde su área. Hasta que se tramite <b>siguen siendo hermanos de pleno
            derecho</b>, con su número y su antigüedad.
          </p>
          {bajasPedidas.length === 0 ? (
            <p className="form-hint">No hay bajas pendientes.</p>
          ) : (
            bajasPedidas.map((h) => (
              <div className="assign-box" key={h.id}>
                <div className="ficha__row">
                  <span className="pill pill--warn">Pide la baja</span>
                  {h.bajaSolicitadaEl && <span className="pill pill--off">{h.bajaSolicitadaEl}</span>}
                </div>
                <dl className="ficha__list">
                  <div><dt>Hermano/a</dt><dd>{h.nombre}</dd></div>
                  <div><dt>Número</dt><dd>{h.numero > 0 ? h.numero : '—'}</dd></div>
                  <div><dt>Hermano desde</dt><dd>{h.antiguedad}</dd></div>
                  <div><dt>Cuota</dt><dd>{cuotaEnPalabras(situacionDe(h.id))}</dd></div>
                  {h.email && <div><dt>Correo</dt><dd><a href={`mailto:${h.email}`}>{h.email}</a></dd></div>}
                  {h.telefono && <div><dt>Teléfono</dt><dd><a href={`tel:${h.telefono.replace(/\s+/g, '')}`}>{h.telefono}</a></dd></div>}
                </dl>
                {/* El motivo es lo único que le permite a la hermandad
                    reaccionar. Si lo ha escrito, va destacado, no perdido. */}
                {h.motivoBaja ? (
                  <p className="baja-motivo">«{h.motivoBaja}»</p>
                ) : (
                  <p className="form-hint">No ha dicho por qué.</p>
                )}
                <div className="assign-box__row">
                  <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => onTramitar(h.id)}>
                    Tramitar la baja
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => onDescartar(h.id)}>
                    Retirar la solicitud
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onVerFicha(h.id)}>
                    Ver su ficha
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>
  )
}
