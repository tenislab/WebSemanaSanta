/**
 * AJUSTES DE CUOTAS: LA RENOVACIÓN DEL EJERCICIO Y LA MORA.
 *
 * Dos decisiones de la hermandad que no son de una cuota sino de todas: en qué
 * mes arranca el ejercicio —que no es enero en muchas hermandades, es el mes
 * del titular— y a partir de cuántos recibos sin pagar se propone la baja por
 * mora.
 *
 * CINCO PROPS —salían seis y una no se usaba—: los ajustes y su setter, el
 * cajón y su setter, y el ejercicio en curso para poder decir dónde caería el
 * cambio antes de hacerlo.
 */
import Drawer from '../../../components/Drawer'
import type { AjustesCuotas } from '../../../lib/ajustesCuotas'
import { renovacionValida } from '../../../lib/cuotasEmision'
import { MESES_LARGOS } from './meses'

export default function CajonDeAjustes({
  ajustes, setAjustes, ajustesOpen, setAjustesOpen, ejercicioEnCurso,
}: {
  ajustes: AjustesCuotas
  setAjustes: (a: AjustesCuotas) => void
  ajustesOpen: boolean
  setAjustesOpen: (v: boolean) => void
  /** Para poder decir en qué ejercicio caería el cambio antes de hacerlo. */
  ejercicioEnCurso: number
}) {
  return (
    <Drawer
      open={ajustesOpen}
      onClose={() => setAjustesOpen(false)}
      title="Ajustes de cuotas"
      subtitle="Renovación y mora"
    >
      <div className="app-form">
        <div className="assign-box">
          <h4 className="assign-box__title">Cuándo se renuevan las cuotas</h4>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="renovacionDia">Día</label>
              <input
                id="renovacionDia"
                type="number"
                min={1}
                max={31}
                value={ajustes.renovacion.dia}
                onChange={(e) =>
                  setAjustes({
                    ...ajustes,
                    renovacion: renovacionValida({ ...ajustes.renovacion, dia: Number(e.target.value) }),
                  })
                }
              />
            </div>
            <div className="form-row">
              <label htmlFor="renovacionMes">Mes</label>
              <select
                id="renovacionMes"
                value={ajustes.renovacion.mes}
                onChange={(e) =>
                  setAjustes({
                    ...ajustes,
                    renovacion: renovacionValida({ ...ajustes.renovacion, mes: Number(e.target.value) }),
                  })
                }
              >
                {MESES_LARGOS.map((nombre, i) => (
                  <option key={nombre} value={i + 1}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="form-hint">
            Cada {ajustes.renovacion.dia} de {MESES_LARGOS[ajustes.renovacion.mes - 1]} empieza un
            ejercicio nuevo. Ahora mismo es el <b>{ejercicioEnCurso}</b>: es el que Cuotas propone
            emitir y con esa fecha de cobro. La emisión no es automática —la lanza la tesorería
            desde «Emitir el ejercicio entero»— pero el aviso vuelve solo cada año ese día.
          </p>
          <p className="form-hint">
            Al emitir, a quien tenga IBAN se le domicilia y entra en la remesa que se manda al
            banco; a quien no, el recibo le queda sin cobrar hasta que pague.
          </p>
        </div>
        <div className="assign-box">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={ajustes.moraRequiereDosCargos}
              onChange={(e) => setAjustes({ ...ajustes, moraRequiereDosCargos: e.target.checked })}
            />
            La mora requiere que la confirmen dos cargos
          </label>
          <p className="form-hint">
            {ajustes.moraRequiereDosCargos
              ? 'Un cargo (tesorero o secretario) PROPONE la mora y otro distinto la CONFIRMA. Es una doble validación.'
              : 'Basta con que un cargo autorizado (tesorero, secretario o titular) ponga la mora.'}
          </p>
        </div>
      </div>
    </Drawer>
  )
}
