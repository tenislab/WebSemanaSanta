/** La obra social: cifras, con quién y cómo ayudar. */
import { EditorFotos, EditorParrafos } from '../../../components/EditorContenido'
import { nuevoId } from '../../../lib/supabaseSync'
import { GUION_CARIDAD, type CaridadWeb, type WebPublica } from '../../../lib/webPublica'
import { leerImagenMediana, lineas, type EditarFn } from './comun'

export function CaridadTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  const c = web.caridad
  function set(cambios: Partial<CaridadWeb>) { editar('caridad', { ...c, ...cambios }) }
  const vacia = !c.entradilla.trim() && c.cifras.length === 0
    && !c.parrafos.some((p) => p.texto.trim()) && c.comoAyudar.length === 0

  return (
    <section className="settings-card">
      <div className="settings-card__head"><h2 className="settings-card__title">Caridad y obra social</h2></div>
      <p className="form-hint">
        Lo que la hermandad hace durante todo el año, no solo el día de la salida. Es lo que más se
        pregunta desde fuera y lo que convence a quien duda si hacerse hermano.
      </p>
      {vacia && (
        <div className="banner-inline banner-inline--accent">
          <span>¿No sabes por dónde empezar? Te dejamos un guion con cifras de ejemplo para cambiar.</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => editar('caridad', {
              ...GUION_CARIDAD,
              cifras: GUION_CARIDAD.cifras.map((x) => ({ ...x, id: nuevoId() })),
              parrafos: GUION_CARIDAD.parrafos.map((x) => ({ ...x, id: nuevoId() })),
            })}
          >
            Rellenar con un guion
          </button>
        </div>
      )}
      <div className="form-row">
        <label htmlFor="caridadEntradilla">Frase de entrada</label>
        <input
          id="caridadEntradilla" type="text" value={c.entradilla}
          onChange={(e) => set({ entradilla: e.target.value })}
          placeholder="Lo que la hermandad hace durante todo el año."
        />
      </div>

      <div className="form-row">
        <div className="settings-card__head" style={{ padding: 0, marginBottom: '0.5rem' }}>
          <label>Las cifras</label>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={c.cifras.length >= 4}
            onClick={() => set({ cifras: [...c.cifras, { id: nuevoId(), cifra: '', concepto: '' }] })}
          >
            + Añadir cifra
          </button>
        </div>
        {/* Cuatro como mucho: con seis dejan de ser cifras y son una tabla, y
            en el móvil se convierten en una columna interminable. */}
        <p className="form-hint">
          Tres o cuatro, no más. Una obra social contada solo con adjetivos no convence a nadie;
          «142 familias, todas las semanas, desde 2011» sí.
        </p>
        {c.cifras.map((x) => (
          <div key={x.id} className="form-grid-2" style={{ alignItems: 'end', marginBottom: '0.6rem' }}>
            <div className="form-row">
              <label htmlFor={`cifra-${x.id}`}>El número</label>
              <input
                id={`cifra-${x.id}`} type="text" value={x.cifra}
                onChange={(e) => set({ cifras: c.cifras.map((y) => (y.id === x.id ? { ...y, cifra: e.target.value } : y)) })}
                placeholder="142 · 3.400 kg · 12.000 €"
              />
            </div>
            <div className="form-row">
              <label htmlFor={`concepto-${x.id}`}>De qué</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id={`concepto-${x.id}`} type="text" value={x.concepto}
                  onChange={(e) => set({ cifras: c.cifras.map((y) => (y.id === x.id ? { ...y, concepto: e.target.value } : y)) })}
                  placeholder="familias atendidas cada semana"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm rgpd-borrar"
                  onClick={() => set({ cifras: c.cifras.filter((y) => y.id !== x.id) })}
                  aria-label={`Quitar la cifra ${x.cifra || 'sin número'}`}
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <EditorParrafos
        parrafos={c.parrafos}
        onChange={(parrafos) => set({ parrafos })}
        titulo="El texto"
        ayuda="A quién ayudáis, cómo se accede, de dónde sale el dinero."
      />

      <EditorFotos
        fotos={c.fotos}
        onChange={(fotos) => set({ fotos: typeof fotos === 'function' ? fotos(c.fotos) : fotos })}
        onSubir={leerImagenMediana}
        titulo="Fotos"
      />

      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="caridadComo">Cómo ayudar</label>
          <textarea
            id="caridadComo" rows={4} value={c.comoAyudar.join('\n')}
            onChange={(e) => set({ comoAyudar: lineas(e.target.value) })}
            placeholder={'Aportación mensual a la bolsa de caridad\nEntrega de alimentos en la casa de hermandad\nVoluntariado en el reparto de los sábados'}
          />
          <p className="form-hint">Una por línea.</p>
        </div>
        <div className="form-row">
          <label htmlFor="caridadCon">Con quién trabajáis</label>
          <textarea
            id="caridadCon" rows={4} value={c.conQuien.join('\n')}
            onChange={(e) => set({ conQuien: lineas(e.target.value) })}
            placeholder={'Cáritas parroquial\nBanco de alimentos'}
          />
          <p className="form-hint">Una por línea. Decir con quién colaboráis es lo que da confianza.</p>
        </div>
      </div>

      <div className="form-row">
        <label htmlFor="caridadCorreo">Correo de la diputación de caridad</label>
        <input
          id="caridadCorreo" type="email" value={c.correo}
          onChange={(e) => set({ correo: e.target.value })}
          placeholder="caridad@tuhermandad.es (vacío = el correo de contacto de la web)"
        />
        {/* El correo, en la propia sección: quien acaba de leer esto es justo
            el que quiere escribir, y mandarlo al formulario del final es
            perderlo por el camino. */}
        <p className="form-hint">Sale al final de «Cómo ayudar», que es donde está quien quiere escribir.</p>
      </div>
    </section>
  )
}

/* ------------------------------ Boletines ------------------------------ */
