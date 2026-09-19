import type { AjustesCuotas } from '../../../lib/ajustesCuotas'
import Drawer from '../../../components/Drawer'
import { type Campana } from '../../../lib/campana'

/**
 * LOS AJUSTES DE LA CAMPAÑA.
 *
 * Las tres fechas que la gobiernan —cuándo empiezan a renovar los que salieron
 * el año pasado, cuándo los que no, y hasta cuándo— más el día de la salida y
 * el umbral de mora. Y el botón de abrir el año siguiente, que cierra esta
 * campaña y empieza la próxima.
 *
 * SIETE PROPS, y son siete cosas distintas de verdad: no hay manera honesta
 * de bajarlas agrupándolas.
 */
export default function CajonDeAjustes({
  ajustesOpen, setAjustesOpen, campana, guardarCampana, abrirNuevoAno,
  ajustes, setAjustes,
}: {
  ajustesOpen: boolean
  setAjustesOpen: (v: boolean) => void
  campana: Campana
  guardarCampana: (c: Campana) => void
  abrirNuevoAno: () => void
  ajustes: AjustesCuotas
  setAjustes: (a: AjustesCuotas) => void
}) {
  return (
    <Drawer
      open={ajustesOpen}
      onClose={() => setAjustesOpen(false)}
      title="Ajustes de campaña"
      subtitle={`Edición ${campana.anio}`}
    >
      <div className="app-form">
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="fechaIniPart">Inicio · participaron el año pasado</label>
            <input
              id="fechaIniPart"
              type="date"
              value={campana.fechaInicioParticiparon}
              onChange={(e) => guardarCampana({ ...campana, fechaInicioParticiparon: e.target.value })}
            />
            <p className="form-hint">Desde este día pueden solicitar los que salieron el año anterior (renovar).</p>
          </div>
          <div className="form-row">
            <label htmlFor="fechaIniNuevos">Inicio · no participaron</label>
            <input
              id="fechaIniNuevos"
              type="date"
              value={campana.fechaInicioNoParticiparon}
              onChange={(e) => guardarCampana({ ...campana, fechaInicioNoParticiparon: e.target.value })}
            />
            <p className="form-hint">Desde este día pueden solicitar el resto de hermanos (los que no salieron).</p>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="fechaLimite">Fin del plazo (fecha límite)</label>
          <input
            id="fechaLimite"
            type="date"
            value={campana.fechaLimiteRenovacion}
            onChange={(e) => guardarCampana({ ...campana, fechaLimiteRenovacion: e.target.value })}
          />
          <p className="form-hint">Último día del plazo. Pasada esta fecha, quien no haya renovado pierde su sitio.</p>
        </div>
        <div className="form-row">
          <label htmlFor="fechaSalida">Día de la estación de penitencia</label>
          <input
            id="fechaSalida"
            type="date"
            value={campana.fechaSalida ?? ''}
            onChange={(e) => guardarCampana({ ...campana, fechaSalida: e.target.value || null })}
          />
        </div>

        <div className="assign-box">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={ajustes.bloquearPapeletaConDeuda}
              onChange={(e) => setAjustes({ ...ajustes, bloquearPapeletaConDeuda: e.target.checked })}
            />
            Bloquear la papeleta si el hermano tiene cuotas pendientes
          </label>
          <p className="form-hint">
            {ajustes.bloquearPapeletaConDeuda
              ? 'No se podrá sacar papeleta a quien deba cuotas hasta que regularice.'
              : 'Solo se avisa de la deuda, pero se puede emitir la papeleta igualmente.'}
          </p>
        </div>

        <div className="assign-box">
          <label>Cerrar campaña {campana.anio}</label>
          <p className="form-hint">
            Abre la campaña de {campana.anio + 1}: los sitios entregados este año pasan a ser renovables, y todos los
            hermanos vuelven a empezar en «Por renovar» o «Sin papeleta». No se borra nada: el historial queda
            guardado.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (window.confirm(`¿Abrir la campaña ${campana.anio + 1}? Los sitios de ${campana.anio} pasan a renovables.`)) {
                abrirNuevoAno()
                setAjustesOpen(false)
              }
            }}
          >
            Abrir campaña {campana.anio + 1}
          </button>
        </div>
      </div>
    </Drawer>
  )
}
