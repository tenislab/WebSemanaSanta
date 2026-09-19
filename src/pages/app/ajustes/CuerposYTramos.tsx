import { repartoDe, type Cuerpo, type ModoReparto } from '../../../lib/tramos'

/**
 * LA SECCIÓN DE CUERPOS Y TRAMOS.
 *
 * Los cuerpos arriba —con su aviso de por qué no se puede quitar uno que tiene
 * tramos— y debajo los tramos de cada uno, en orden, con su aforo y su precio.
 *
 * TRES PROPS —salían cuatro y una no se usaba—: `cortejo` es lo que devuelve
 * `useCuerposYTramos()` de una pieza, el actualizador de los ajustes de la
 * hermandad, y el precio base de la papeleta.
 */
import type { HermandadSettings } from '../../../lib/hermandadSettings'
import type { useCuerposYTramos } from './cuerposYTramos'

export default function CuerposYTramos({ cortejo, update, precioBase }: {
  cortejo: ReturnType<typeof useCuerposYTramos>
  update: <K extends keyof HermandadSettings>(key: K, value: HermandadSettings[K]) => void
  /** El precio que se hereda cuando un tramo no pone el suyo. */
  precioBase: number
}) {
  const {
    tramos, tramosSaved, setTramosSaved, tramosError,
    cuerposGuardados, cuerposEdit, cuerposSaved, cuerposError,
    updateCuerpo, addCuerpo, removeCuerpo, handleSaveCuerpos,
    aforos, gruposConPrecioMixto,
    updateTramo, addTramo, removeTramo, moveTramo, handleSaveTramos,
  } = cortejo
  return (
      <>
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Cuerpos del cortejo</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={addCuerpo}>
          + Añadir cuerpo
        </button>
      </div>
      <p className="form-hint">
        Los cuerpos son los bloques del cortejo (normalmente, un paso y su acompañamiento).
        Ponles el nombre que uséis en vuestra hermandad: Cristo y Virgen, Misterio y Palio,
        Cautivo… o un único cuerpo si salís en un solo bloque. Al renombrar un cuerpo, sus
        tramos se actualizan solos.
      </p>
      <div className="opciones-editor">
        {cuerposEdit.map((c, i) => (
          <div className="opcion-row opcion-row--cuerpo" key={`${c.original ?? 'nuevo'}-${i}`}>
            <input
              type="text"
              value={c.actual}
              onChange={(e) => updateCuerpo(i, e.target.value)}
              placeholder="Ej. Misterio, Palio, Único…"
              aria-label="Nombre del cuerpo"
            />
            <button type="button" className="icon-btn" title="Quitar cuerpo" onClick={() => removeCuerpo(i)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        ))}
      </div>
      {cuerposError && <p className="form-hint form-hint--error">{cuerposError}</p>}
      <div className="settings-actions">
        {cuerposSaved && <span className="alert-item alert-item--ok">Cuerpos guardados</span>}
        <button type="button" className="btn btn-primary" onClick={handleSaveCuerpos}>
          Guardar cuerpos
        </button>
      </div>
    </section>

    <section className="settings-card tramos-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Tramos del cortejo</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={addTramo}>
          + Añadir tramo
        </button>
      </div>
      {/* Sugerencias para el campo de rol de tramos y opciones. Va una vez
          para las dos tablas: son los mismos roles. */}
      <datalist id="rolesSugeridos">
        {['Costalero', 'Acólito', 'Monaguillo', 'Banda', 'Mantilla', 'Diputado de tramo', 'Nazareno', 'Presidencia']
          .map((r) => <option key={r} value={r} />)}
      </datalist>
      <p className="form-hint">
        El <b>rol</b> es opcional: si lo pones, a quien saque aquí su papeleta se le asigna solo
        mientras la tenga, y se le quita si la anula. Sirve para mandar un comunicado solo a los
        costaleros de este año sin ir marcándolos uno a uno. No da ningún permiso en el panel.
      </p>
      <p className="form-hint">
        Define los tramos de cada cuerpo, cuántos hermanos caben y <b>cómo se llena cada uno</b>:
        «Por número» es el reparto automático clásico de los cirios (la app coloca a los hermanos
        por su número, en cascada de un tramo al siguiente del mismo tipo); «Por solicitud» es
        para los puestos que se piden (cruz de guía, insignias, varas, presidencia…) y se los
        queda el de menor número. El orden de la lista es el orden real de desfile. El «tipo» es
        lo que se porta (cirio, insignia, vara…), texto libre; cada tramo puede tener además su
        propio precio de papeleta.
      </p>

      {aforos.length > 0 && (
        <div className="banner-inline banner-inline--accent">
          Aforo total:{' '}
          {aforos.map((a, i) => (
            <span key={a.cuerpo}>
              {i > 0 && ' · '}
              {a.cuerpo} {a.total}
            </span>
          ))}
          .
        </div>
      )}

      <div className="form-row tramos-precio-base">
        <label htmlFor="precioBase">Precio general de la papeleta</label>
        <div className="opcion-row__importe">
          <input
            id="precioBase"
            type="number"
            min="0"
            step="0.5"
            value={precioBase}
            onChange={(e) => {
              update('precioPapeleta', Number(e.target.value) || 0)
              setTramosSaved(false)
            }}
          />
          <span>€</span>
        </div>
        <p className="form-hint">Se usa en los tramos que no fijan su propio precio.</p>
      </div>

      <div className="tramos-editor">
        {/*
          UNA FICHA POR TRAMO, NO UNA FILA DE DIEZ COLUMNAS.
          ------------------------------------------------------------------
          Esto era una tabla de diez columnas con `min-width: 1020px`: para
          rellenar un tramo había que arrastrar la barra horizontal, y al
          hacerlo se perdían de vista las cabeceras, así que ya no se sabía
          qué era cada casilla. Los títulos, además, iban abreviados
          («Citación», «Rol»), que en una columna estrecha no explican nada.

          Ahora cada tramo es una ficha con sus campos etiquetados uno a uno y
          agrupados por la pregunta que responden: QUÉ ES este tramo, CÓMO SE
          LLENA, y QUÉ PASA EL DÍA DE LA SALIDA. Se lee de arriba abajo y cabe
          en un móvil sin mover nada.
        */}
        {tramos.map((t, i) => (
          <div className="tramo-ficha" key={t.id}>
            <div className="tramo-ficha__head">
              <span className="tramo-ficha__orden">{i + 1}</span>
              <input
                className="tramo-ficha__nombre"
                type="text"
                value={t.nombre}
                onChange={(e) => updateTramo(t.id, 'nombre', e.target.value)}
                placeholder="Ej. Cirio 1º tramo"
                aria-label="Nombre del tramo"
              />
              <span className="tramo-ficha__acciones">
                <button
                  type="button"
                  className="icon-btn"
                  title="Subir: va antes en el cortejo"
                  disabled={i === 0}
                  onClick={() => moveTramo(t.id, -1)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 15 12 9l-6 6" /></svg>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Bajar: va después en el cortejo"
                  disabled={i === tramos.length - 1}
                  onClick={() => moveTramo(t.id, 1)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 9 12 15l6-6" /></svg>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Quitar tramo"
                  onClick={() => removeTramo(t.id)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </span>
            </div>

            <div className="tramo-ficha__grupo">
              <p className="tramo-ficha__titulo">Qué es</p>
              <div className="tramo-ficha__campos">
                <label>
                  <span>Cuerpo</span>
                  <select value={t.cuerpo} onChange={(e) => updateTramo(t.id, 'cuerpo', e.target.value as Cuerpo)}>
                    {(cuerposGuardados.includes(t.cuerpo) ? cuerposGuardados : [t.cuerpo, ...cuerposGuardados]).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Qué se lleva</span>
                  <input
                    type="text"
                    value={t.tipo ?? ''}
                    onChange={(e) => updateTramo(t.id, 'tipo', e.target.value)}
                    placeholder="Cirio, insignia, vara…"
                  />
                </label>
              </div>
            </div>

            <div className="tramo-ficha__grupo">
              <p className="tramo-ficha__titulo">Cómo se llena</p>
              <div className="tramo-ficha__campos">
                <label>
                  <span>Reparto</span>
                  <select
                    value={repartoDe(t)}
                    onChange={(e) => updateTramo(t.id, 'reparto', e.target.value as ModoReparto)}
                  >
                    <option value="numero">Por número de hermano</option>
                    <option value="solicitud">Se pide (gana el más antiguo)</option>
                  </select>
                </label>
                <label>
                  <span>Cuántos caben</span>
                  <input
                    type="number"
                    min="1"
                    value={t.capacidad}
                    onChange={(e) => updateTramo(t.id, 'capacidad', Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  <span>Precio de la papeleta</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={t.precio ?? ''}
                    placeholder={`${precioBase} (el general)`}
                    onChange={(e) => updateTramo(t.id, 'precio', e.target.value === '' ? null : Number(e.target.value) || 0)}
                  />
                </label>
              </div>
            </div>

            <div className="tramo-ficha__grupo">
              <p className="tramo-ficha__titulo">El día de la salida</p>
              <div className="tramo-ficha__campos">
                {/* A qué hora se cita ESTE tramo: cada uno entra a una hora, y
                    es LA pregunta del hermano la semana antes. */}
                <label>
                  <span>Hora de citación</span>
                  <input
                    type="time"
                    value={t.horaCitacion ?? ''}
                    onChange={(e) => updateTramo(t.id, 'horaCitacion', e.target.value)}
                  />
                </label>
                {/* El rol que da ir en este tramo. Se le pone SOLO al hermano
                    mientras tenga aquí su papeleta, y se le quita si la anula. */}
                <label>
                  <span>Rol que da (opcional)</span>
                  <input
                    type="text"
                    value={t.etiqueta ?? ''}
                    onChange={(e) => updateTramo(t.id, 'etiqueta', e.target.value)}
                    placeholder="Costalero, acólito…"
                    list="rolesSugeridos"
                  />
                </label>
              </div>
            </div>
          </div>
        ))}
        {tramos.length === 0 && (
          <p className="form-hint">No hay tramos configurados todavía. Añade el primero.</p>
        )}
      </div>

      {gruposConPrecioMixto.length > 0 && (
        <p className="form-hint form-hint--error">
          Ojo: hay grupos «por número» con precios distintos entre sus tramos ({gruposConPrecioMixto.join(', ')}).
          Al sacar la papeleta se cobra el precio del primer tramo del grupo; iguala los precios para evitar
          sorpresas.
        </p>
      )}

      <div className="settings-actions">
        {tramosSaved && <span className="alert-item alert-item--ok">Tramos guardados</span>}
        {tramosError && <span className="alert-item alert-item--alerta">{tramosError}</span>}
        <button type="button" className="btn btn-primary" onClick={handleSaveTramos}>
          Guardar tramos
        </button>
      </div>
    </section>
      </>
  )
}
