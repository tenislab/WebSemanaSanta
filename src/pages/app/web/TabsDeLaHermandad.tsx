/**
 * QUIÉNES SOMOS: hazte hermano, historia, junta de gobierno y estación de penitencia.
 *
 * Van juntas porque son la misma cosa desde fuera —lo que una hermandad cuenta
 * de sí misma— y porque ninguna llega a cien líneas: un fichero por cada una
 * sería un índice más largo que el contenido.
 */
import { EditorFotos, EditorParrafos } from '../../../components/EditorContenido'
import { useMoverConElFoco } from '../../../lib/foco'
import { nuevoId } from '../../../lib/supabaseSync'
import {
  GUION_ESTACION,
  GUION_HISTORIA,
  contenidoVacio,
  type EstacionPenitencia,
  type HazteHermano,
  type MiembroJunta,
  type ParadaItinerario,
  type WebPublica,
} from '../../../lib/webPublica'
import { leerImagenMediana, lineas, type EditarFn } from './comun'

export function HazteTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  const h = web.hazte
  function set(c: Partial<HazteHermano>) { editar('hazte', { ...h, ...c }) }
  return (
    <section className="settings-card">
      <div className="settings-card__head"><h2 className="settings-card__title">Hazte hermano</h2></div>
      <p className="form-hint">
        Lo que más se busca en la web de una hermandad después de los cultos. Si está claro qué hace
        falta y cuánto cuesta, la gente se anima; si hay que llamar para enterarse, no llama.
      </p>
      <div className="form-row">
        <label htmlFor="hazteEntradilla">Frase de entrada</label>
        <input
          id="hazteEntradilla" type="text" value={h.entradilla}
          onChange={(e) => set({ entradilla: e.target.value })}
          placeholder="Cualquiera puede ser hermano de esta casa."
        />
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="hazteReq">Qué hace falta</label>
          <textarea
            id="hazteReq" rows={5} value={h.requisitos.join('\n')}
            onChange={(e) => set({ requisitos: lineas(e.target.value) })}
            placeholder={'Estar bautizado\nAceptar las reglas\nLos menores, con firma del tutor'}
          />
          <p className="form-hint">Uno por línea.</p>
        </div>
        <div className="form-row">
          <label htmlFor="haztedPasos">Cómo se hace</label>
          <textarea
            id="haztedPasos" rows={5} value={h.pasos.join('\n')}
            onChange={(e) => set({ pasos: lineas(e.target.value) })}
            placeholder={'Rellena la solicitud\nSecretaría la revisa\nSe te da de alta en el censo'}
          />
          <p className="form-hint">Uno por línea. Salen numerados en orden.</p>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="hazteCuota">La cuota</label>
        <input
          id="hazteCuota" type="text" value={h.cuota}
          onChange={(e) => set({ cuota: e.target.value })}
          placeholder="60 € al año"
        />
      </div>
      <div className="form-row">
        <label htmlFor="hazteBoton">Texto del botón</label>
        <input
          id="hazteBoton" type="text" value={h.textoBoton}
          onChange={(e) => set({ textoBoton: e.target.value })}
          placeholder="Quiero hacerme hermano (vacío = sin botón)"
        />
      </div>
      <label className="checkbox">
        <input
          type="checkbox" checked={web.altaDesdeWeb}
          onChange={(e) => editar('altaDesdeWeb', e.target.checked)}
        />
        <span>
          El botón abre el formulario de alta <b>en la propia web</b>. La solicitud llega a
          Hermanos → Solicitudes de alta, igual que las del área del hermano.
        </span>
      </label>
      {!web.altaDesdeWeb && (
        <label className="checkbox">
          <input type="checkbox" checked={h.alAreaDelHermano} onChange={(e) => set({ alAreaDelHermano: e.target.checked })} />
          <span>
            El botón lleva al área del hermano, donde se pide el alta.
            {!h.alAreaDelHermano && ' Ahora lleva a la sección de contacto.'}
          </span>
        </label>
      )}
    </section>
  )
}

/* -------------------------------- Donativos -------------------------------- */

export function EstacionTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  const e = web.estacion
  function set(c: Partial<EstacionPenitencia>) { editar('estacion', { ...e, ...c }) }
  function setParada(id: string, c: Partial<ParadaItinerario>) {
    set({ itinerario: e.itinerario.map((x) => (x.id === id ? { ...x, ...c } : x)) })
  }
  // Que el botón no se vaya con la fila: ver `useMoverConElFoco`.
  const conFoco = useMoverConElFoco('itinerario')
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= e.itinerario.length) return
    const lista = [...e.itinerario]
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    set({ itinerario: lista })
    conFoco.movida(e.itinerario[i].id, dir)
  }
  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">El día grande</h2></div>
        <p className="form-hint">
          La hora de salida y el itinerario son EL dato que se busca en Semana Santa. Mientras esté
          vacío, la sección no sale ni en la web ni en el menú.
        </p>
        {!e.dia.trim() && !e.horaSalida.trim() && e.itinerario.length === 0 && (
          <div className="banner-inline banner-inline--accent">
            <span>Te dejamos un itinerario de ejemplo con sus horas para que solo tengas que cambiar las calles.</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => editar('estacion', { ...GUION_ESTACION, itinerario: GUION_ESTACION.itinerario.map((x) => ({ ...x, id: nuevoId() })) })}
            >
              Rellenar con un guion
            </button>
          </div>
        )}
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="estDia">Día</label>
            <input id="estDia" type="text" value={e.dia} onChange={(x) => set({ dia: x.target.value })} placeholder="Viernes Santo" />
          </div>
          <div className="form-row">
            <label htmlFor="estAnio">Año</label>
            <input id="estAnio" type="text" value={e.anio} onChange={(x) => set({ anio: x.target.value })} placeholder="2027" />
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="estSalida">Hora de salida</label>
            <input id="estSalida" type="text" value={e.horaSalida} onChange={(x) => set({ horaSalida: x.target.value })} placeholder="17:30" />
          </div>
          <div className="form-row">
            <label htmlFor="estEntrada">Hora de entrada</label>
            <input id="estEntrada" type="text" value={e.horaEntrada} onChange={(x) => set({ horaEntrada: x.target.value })} placeholder="01:15" />
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="estDesde">Desde dónde sale</label>
          <input id="estDesde" type="text" value={e.salidaDesde} onChange={(x) => set({ salidaDesde: x.target.value })} placeholder="Parroquia de San Juan" />
        </div>
        <div className="form-row">
          <label htmlFor="estFecha">Fecha exacta de la salida</label>
          <input id="estFecha" type="date" value={e.fechaSalida ?? ''} onChange={(x) => set({ fechaSalida: x.target.value })} />
          <p className="form-hint">
            Solo para la cuenta atrás de la portada: con «Viernes Santo» no se pueden contar los
            días. En la web se sigue leyendo lo que hayas escrito arriba.
          </p>
        </div>
        <div className="form-row">
          <label htmlFor="estNota">Recomendaciones</label>
          <textarea id="estNota" rows={3} value={e.nota} onChange={(x) => set({ nota: x.target.value })} placeholder="Dónde se ve mejor, qué llevar, a qué hora conviene estar…" />
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Itinerario</h2>
          <button
            type="button" className="btn btn-outline btn-sm"
            onClick={() => set({ itinerario: [...e.itinerario, { id: nuevoId(), lugar: '', hora: '', destacada: false }] })}
          >
            + Añadir parada
          </button>
        </div>
        <p className="form-hint">
          Calle a calle, con su hora de paso. Marca como hito la salida, la carrera oficial y la
          entrada: salen resaltadas.
        </p>
        {e.itinerario.length === 0 && <p className="form-hint">Todavía no hay ninguna parada.</p>}
        <div className="opciones-editor">
          {e.itinerario.map((par, i) => (
            <div className="opcion-row opcion-row--parada" key={par.id}>
              <input
                type="text" value={par.hora} placeholder="18:40" aria-label="Hora de paso"
                onChange={(x) => setParada(par.id, { hora: x.target.value })}
              />
              <input
                type="text" value={par.lugar} placeholder="Calle o plaza" aria-label="Lugar"
                onChange={(x) => setParada(par.id, { lugar: x.target.value })}
              />
              <label className="checkbox" title="Resaltar esta parada">
                <input type="checkbox" checked={par.destacada} onChange={(x) => setParada(par.id, { destacada: x.target.checked })} />
                <span>Hito</span>
              </label>
              <span className="seccion-item__orden">
                <button type="button" className="icon-btn" {...conFoco.boton(par.id, -1)} onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">▲</button>
                <button type="button" className="icon-btn" {...conFoco.boton(par.id, 1)} onClick={() => mover(i, 1)} disabled={i === e.itinerario.length - 1} aria-label="Bajar">▼</button>
              </span>
              <button
                type="button" className="icon-btn" title="Quitar parada"
                onClick={() => set({ itinerario: e.itinerario.filter((x) => x.id !== par.id) })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

/* --------------------------- Junta de gobierno --------------------------- */
const CARGOS_JUNTA = [
  'Hermano Mayor', 'Teniente de Hermano Mayor', 'Secretario/a', 'Tesorero/a',
  'Fiscal', 'Mayordomo/a', 'Prioste', 'Diputado/a Mayor de Gobierno',
  'Diputado/a de Caridad', 'Diputado/a de Cultos',
]

export function JuntaTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function set(id: string, c: Partial<MiembroJunta>) {
    editar('junta', (xs) => xs.map((m) => (m.id === id ? { ...m, ...c } : m)))
  }
  const conFoco = useMoverConElFoco('junta')
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.junta.length) return
    const lista = [...web.junta]
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    editar('junta', lista)
    conFoco.movida(web.junta[i].id, dir)
  }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Junta de gobierno</h2>
        <button
          type="button" className="btn btn-outline btn-sm"
          onClick={() => editar('junta', (xs) => [...xs, { id: nuevoId(), cargo: CARGOS_JUNTA[xs.length] ?? '', nombre: '' }])}
        >
          + Añadir cargo
        </button>
      </div>
      <p className="form-hint">
        Los cargos y quién los ocupa. Es lo que pide cualquier visita institucional, y hoy había que
        meterlo a mano en una página de texto.
      </p>
      {web.junta.length === 0 && <p className="form-hint">Sin cargos, la sección no sale en la web.</p>}
      <div className="opciones-editor">
        {web.junta.map((m, i) => (
          <div className="opcion-row opcion-row--junta" key={m.id}>
            <input
              type="text" value={m.cargo} placeholder="Cargo" aria-label="Cargo" list="cargos-junta"
              onChange={(e) => set(m.id, { cargo: e.target.value })}
            />
            <input
              type="text" value={m.nombre} placeholder="Nombre y apellidos" aria-label="Nombre"
              onChange={(e) => set(m.id, { nombre: e.target.value })}
            />
            <span className="seccion-item__orden">
              <button type="button" className="icon-btn" {...conFoco.boton(m.id, -1)} onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">▲</button>
              <button type="button" className="icon-btn" {...conFoco.boton(m.id, 1)} onClick={() => mover(i, 1)} disabled={i === web.junta.length - 1} aria-label="Bajar">▼</button>
            </span>
            <button
              type="button" className="icon-btn" title="Quitar cargo"
              onClick={() => editar('junta', (xs) => xs.filter((x) => x.id !== m.id))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        ))}
      </div>
      <datalist id="cargos-junta">
        {CARGOS_JUNTA.map((c) => <option key={c} value={c} />)}
      </datalist>
    </section>
  )
}

/* ------------------------------- Historia ------------------------------- */
export function HistoriaTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  return (
    <section className="settings-card">
      <div className="settings-card__head"><h2 className="settings-card__title">Historia</h2></div>
      <p className="form-hint">
        Se publica como una sección con formato: una entradilla, los párrafos que quieras (con su
        subtítulo) y fotos.
      </p>
      {contenidoVacio(web.historia) && (
        <div className="banner-inline banner-inline--accent">
          <span>¿No sabes por dónde empezar? Te dejamos un guion con los cuatro apartados de siempre.</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => editar('historia', { ...GUION_HISTORIA, parrafos: GUION_HISTORIA.parrafos.map((x) => ({ ...x, id: nuevoId() })) })}
          >
            Rellenar con un guion
          </button>
        </div>
      )}
      <div className="form-row">
        <label htmlFor="historiaEntradilla">Entradilla</label>
        <input
          id="historiaEntradilla"
          type="text"
          value={web.historia.entradilla}
          onChange={(e) => editar('historia', (h) => ({ ...h, entradilla: e.target.value }))}
          placeholder="Una frase que resuma la historia de la hermandad"
        />
      </div>
      <EditorParrafos
        parrafos={web.historia.parrafos}
        onChange={(parrafos) => editar('historia', (h) => ({ ...h, parrafos }))}
        ayuda="Por ejemplo: «Fundación», «Los titulares», «La sede», «Hoy»."
      />
      <EditorFotos
        fotos={web.historia.fotos}
        onChange={(fotos) => editar('historia', (h) => ({ ...h, fotos: typeof fotos === 'function' ? fotos(h.fotos) : fotos }))}
        onSubir={leerImagenMediana}
        titulo="Fotos de la sección"
      />
    </section>
  )
}

/* --------------------------- Titulares (en Diseño) --------------------------- */
