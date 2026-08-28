/**
 * CAMPAÑAS Y PROYECTOS.
 *
 * Dos cosas que se piden juntas y son distintas:
 *
 *   · UNA CAMPAÑA es dinero con un objetivo: restaurar el paso, el reparto de
 *     Navidad, el tejado. Tiene una barra que se llena.
 *   · UN PROYECTO es trabajo a largo plazo: lo que dura dos años y no cabe en
 *     la agenda de eventos, con sus tareas y su responsable.
 *
 * Van en la misma pantalla porque casi siempre van juntos —el proyecto de
 * restaurar el manto tiene su campaña para pagarlo— y separarlos obligaría a
 * saltar de una pantalla a otra para ver las dos mitades de lo mismo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO RECAUDADO SALE DE TESORERÍA, NO DE UN CONTADOR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La barra se calcula sumando los apuntes del libro que llevan la marca de la
 * campaña. Por eso apuntar un donativo desde aquí ESCRIBE EN TESORERÍA: no es
 * un efecto secundario, es el único sitio donde se guarda.
 *
 * Es la respuesta directa a «el concepto de cuota no se pasa a tesorería».
 * Aquí no puede pasar: si la barra sube, el tesorero lo tiene, porque son el
 * mismo dato. El porqué, entero, en `lib/recaudaciones.ts`.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import AvisoDeCampo from '../../components/AvisoDeCampo'
import { useSupabaseTable, nuevoId } from '../../lib/supabaseSync'
import { CLAVES_DATOS } from '../../lib/persistencia'
import { movimientoToRow, rowToMovimiento } from '../../lib/db/movimientos'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../../data/movimientos'
import { conApunteDeCobro } from '../../lib/apuntes'
import { formatCurrency } from '../../lib/format'
import { hoyIso } from '../../lib/hoy'
import { fechaEs } from '../../lib/leerTabla'
import {
  useRecaudaciones, loRecaudado, cuantasAportaciones, comoVa, loQueFalta,
  comoSeLee, admiteAportaciones, origenDeRecaudacion, type Recaudacion,
} from '../../lib/recaudaciones'
import {
  useProyectos, useTareasProyecto, ordenDeProyectos, tareasDelProyecto,
  comoVaElProyecto, vaTarde, tareaVaTarde, ESTADOS_PROYECTO,
  type Proyecto, type TareaProyecto,
} from '../../lib/proyectos'
import { HERMANOS_INICIALES, type Hermano } from '../../data/hermanos'
import { hermanoToRow, rowToHermano } from '../../lib/db/hermanos'

type Pestana = 'campanas' | 'proyectos'

/** La categoría del libro a la que van los donativos de una campaña. */
const CATEGORIA_CAMPANA = 'Donativos, Ofrendas y Cepillos'

const FORMAS = ['Efectivo', 'Transferencia', 'Bizum', 'Tarjeta'] as const

export default function Campanas() {
  const [pestana, setPestana] = useState<Pestana>('campanas')
  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Campañas</p>
          <h1>Campañas y proyectos</h1>
          <p className="dash-head__lead">
            Las campañas recogen dinero para algo concreto y enseñan cuánto falta. Los proyectos
            son el trabajo largo: lo que dura meses y no cabe en la agenda de{' '}
            <Link to="/app/eventos" className="dash-head__link">Eventos</Link>.
          </p>
        </div>
      </div>

      {/*
        * Los mismos «chips» que filtran en Archivo y en Comunicados, no unas
        * pestañas nuevas: quien ya usa la aplicación reconoce el gesto, y una
        * pestaña que solo existe en una pantalla se lee como otra cosa.
        */}
      <div className="chips" role="tablist" aria-label="Campañas o proyectos">
        <button
          type="button" role="tab" id="tab-campanas" aria-controls="panel-campanas"
          aria-selected={pestana === 'campanas'}
          className={`chip${pestana === 'campanas' ? ' chip--active' : ''}`}
          onClick={() => setPestana('campanas')}
        >
          Campañas
        </button>
        <button
          type="button" role="tab" id="tab-proyectos" aria-controls="panel-proyectos"
          aria-selected={pestana === 'proyectos'}
          className={`chip${pestana === 'proyectos' ? ' chip--active' : ''}`}
          onClick={() => setPestana('proyectos')}
        >
          Proyectos
        </button>
      </div>

      {pestana === 'campanas'
        ? <div id="panel-campanas" role="tabpanel" aria-labelledby="tab-campanas"><PanelCampanas /></div>
        : <div id="panel-proyectos" role="tabpanel" aria-labelledby="tab-proyectos"><PanelProyectos /></div>}
    </div>
  )
}


/* ══════════════════════════════════════════════════════════════════════════ */
/*  CAMPAÑAS                                                                  */
/* ══════════════════════════════════════════════════════════════════════════ */

function PanelCampanas() {
  const [campanas, setCampanas] = useRecaudaciones()
  const [movimientos, setMovimientos] = useSupabaseTable<Movimiento>(
    'movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES,
    movimientoToRow, rowToMovimiento,
  )
  const [editando, setEditando] = useState<Recaudacion | null>(null)
  const [creando, setCreando] = useState(false)
  const [aportandoA, setAportandoA] = useState<Recaudacion | null>(null)

  // Las abiertas primero: son las que se miran. Las cerradas quedan de consulta.
  const ordenadas = useMemo(() => [...campanas].sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === 'abierta' ? -1 : 1
    return b.fechaInicio.localeCompare(a.fechaInicio)
  }), [campanas])

  function guardar(r: Recaudacion) {
    setCampanas(campanas.some((c) => c.id === r.id)
      ? campanas.map((c) => (c.id === r.id ? r : c))
      : [r, ...campanas])
    setEditando(null)
    setCreando(false)
  }

  return (
    <>
      <div className="dash-head__actions objetivos__acciones">
        <button type="button" className="btn btn-primary" onClick={() => setCreando(true)}>
          + Nueva campaña
        </button>
      </div>

      {ordenadas.length === 0 && (
        <p className="objetivos__vacio">
          Todavía no hay ninguna campaña. Una campaña es dinero para algo concreto —el paso, el
          reparto de Navidad, el tejado— con una cifra a la que llegar.
        </p>
      )}

      <div className="objetivos">
        {ordenadas.map((c) => (
          <TarjetaCampana
            key={c.id}
            campana={c}
            movimientos={movimientos}
            onEditar={() => setEditando(c)}
            onAportar={() => setAportandoA(c)}
          />
        ))}
      </div>

      {(creando || editando) && (
        <FormularioCampana
          campana={editando}
          onGuardar={guardar}
          onCerrar={() => { setEditando(null); setCreando(false) }}
        />
      )}

      {aportandoA && (
        <FormularioAportacion
          campana={aportandoA}
          onCerrar={() => setAportandoA(null)}
          onApuntar={(datos) => {
            setMovimientos(conApunteDeCobro(movimientos, datos))
            setAportandoA(null)
          }}
        />
      )}
    </>
  )
}

function TarjetaCampana({ campana, movimientos, onEditar, onAportar }: {
  campana: Recaudacion
  movimientos: Movimiento[]
  onEditar: () => void
  onAportar: () => void
}) {
  const recaudado = loRecaudado(movimientos, campana.id)
  const cuantas = cuantasAportaciones(movimientos, campana.id)
  const pct = comoVa(recaudado, campana.objetivo)
  const falta = loQueFalta(recaudado, campana.objetivo)

  return (
    <article className={`panel campana ${campana.estado === 'cerrada' ? 'campana--cerrada' : ''}`}>
      <header className="campana__cabecera">
        <div>
          <h2 className="campana__titulo">{campana.nombre}</h2>
          <p className="campana__estado">{comoSeLee(campana, recaudado)}</p>
        </div>
        <div className="campana__pills">
          {campana.enLaWeb && <span className="pill pill--ok">En la web</span>}
          {campana.estado === 'cerrada' && <span className="pill pill--off">Cerrada</span>}
        </div>
      </header>

      {campana.descripcion && <p className="campana__texto">{campana.descripcion}</p>}

      {campana.objetivo > 0 ? (
        <>
          {/*
            * La barra se para en el 100 %, pero el número de arriba no: una
            * campaña que ha pasado del objetivo es la mejor noticia que puede
            * dar esta pantalla y recortarla la escondería.
            */}
          <div
            className="campana__barra"
            role="progressbar"
            aria-valuenow={Math.round(Math.min(100, pct))}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${campana.nombre}: ${Math.round(pct)} % del objetivo`}
          >
            <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
          </div>
          <p className="campana__cifras">
            <b>{formatCurrency(recaudado)}</b>
            <span className="campana__de"> de {formatCurrency(campana.objetivo)}</span>
            {falta > 0 && <span className="campana__falta">Faltan {formatCurrency(falta)}</span>}
          </p>
        </>
      ) : (
        <p className="campana__cifras">
          <b>{formatCurrency(recaudado)}</b>
          <span className="campana__de"> recogidos (sin objetivo fijado)</span>
        </p>
      )}

      <p className="campana__gente">
        {cuantas === 0
          ? 'Todavía no ha aportado nadie.'
          : cuantas === 1 ? 'Una aportación.' : `${cuantas} aportaciones.`}
        {campana.fechaFin && ` Hasta el ${fechaEs(campana.fechaFin)}.`}
      </p>

      <footer className="campana__acciones">
        <button
          type="button" className="btn btn-primary btn-sm"
          onClick={onAportar}
          disabled={!admiteAportaciones(campana)}
          title={admiteAportaciones(campana)
            ? undefined
            : 'La campaña está cerrada. Ábrela otra vez si todavía llega dinero.'}
        >
          Apuntar una aportación
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onEditar}>Editar</button>
      </footer>
    </article>
  )
}

function FormularioCampana({ campana, onGuardar, onCerrar }: {
  campana: Recaudacion | null
  onGuardar: (r: Recaudacion) => void
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState(campana?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(campana?.descripcion ?? '')
  const [objetivo, setObjetivo] = useState(String(campana?.objetivo ?? ''))
  const [fechaInicio, setFechaInicio] = useState(campana?.fechaInicio || hoyIso())
  const [fechaFin, setFechaFin] = useState(campana?.fechaFin ?? '')
  const [estado, setEstado] = useState(campana?.estado ?? 'abierta')
  const [enLaWeb, setEnLaWeb] = useState(campana?.enLaWeb ?? false)
  const [error, setError] = useState<string | null>(null)

  /*
   * Una campaña que acaba antes de empezar es una errata, y la base la
   * rechazaría con un mensaje de Postgres que no dice nada. Se caza aquí, con
   * las fechas comparadas COMO TEXTO —en ISO el orden alfabético es el
   * cronológico y no entra en juego ninguna zona horaria—.
   */
  const fechasAlReves = fechaFin !== '' && fechaFin < fechaInicio

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('Ponle un nombre: es lo que va a ver la gente.'); return }
    if (fechasAlReves) { setError('La fecha de cierre es anterior a la de apertura.'); return }
    const cifra = Number(objetivo.replace(',', '.'))
    if (objetivo.trim() !== '' && !(Number.isFinite(cifra) && cifra >= 0)) {
      setError('El objetivo tiene que ser una cantidad en euros, o quedarse vacío.')
      return
    }
    onGuardar({
      id: campana?.id ?? nuevoId(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      objetivo: objetivo.trim() === '' ? 0 : cifra,
      fechaInicio,
      fechaFin: fechaFin || undefined,
      estado,
      enLaWeb,
      creadaEn: campana?.creadaEn ?? new Date().toISOString(),
    })
  }

  return (
    <Drawer open onClose={onCerrar} title={campana ? 'Editar la campaña' : 'Nueva campaña'}>
      <form className="app-form" onSubmit={enviar}>
        <div className="form-row">
          <label htmlFor="campNombre">Nombre</label>
          <input
            id="campNombre" value={nombre} maxLength={120}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Restauración del paso de palio"
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="campDesc">Para qué es</label>
          <textarea
            id="campDesc" rows={3} value={descripcion} maxLength={600}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Lo que se le cuenta a quien va a dar dinero: qué se va a hacer y por qué hace falta."
          />
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="campObjetivo">Objetivo (€)</label>
            <input
              id="campObjetivo" type="number" min="0" step="0.01" inputMode="decimal"
              value={objetivo} onChange={(e) => setObjetivo(e.target.value)}
              placeholder="Déjalo vacío si no hay cifra"
            />
            <p className="form-hint">Sin objetivo no hay barra, solo el total recogido.</p>
          </div>
          <div className="form-row">
            <label htmlFor="campEstado">Estado</label>
            <select id="campEstado" value={estado} onChange={(e) => setEstado(e.target.value as Recaudacion['estado'])}>
              <option value="abierta">Abierta</option>
              <option value="cerrada">Cerrada</option>
            </select>
            <p className="form-hint">Una campaña cerrada no admite más aportaciones.</p>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="campInicio">Desde</label>
            <input id="campInicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div className="form-row">
            <label htmlFor="campFin">Hasta (opcional)</label>
            <input id="campFin" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            <AvisoDeCampo texto={fechasAlReves ? 'Esta fecha es anterior a la de apertura.' : null} />
          </div>
        </div>
        <div className="form-row form-row--check">
          <label htmlFor="campWeb">
            <input
              id="campWeb" type="checkbox" checked={enLaWeb}
              onChange={(e) => setEnLaWeb(e.target.checked)}
            />
            {' '}Enseñarla en la web pública, con su barra
          </label>
          <p className="form-hint">
            Sale el nombre, para qué es y cuánto lleva. Quién ha dado y cuánto NO sale nunca.
          </p>
        </div>
        <AvisoDeCampo texto={error} />
        <div className="assign-box__row">
          <button type="submit" className="btn btn-primary">Guardar</button>
          <button type="button" className="btn btn-outline" onClick={onCerrar}>Cancelar</button>
        </div>
      </form>
    </Drawer>
  )
}

/**
 * APUNTAR UNA APORTACIÓN.
 *
 * Esto NO guarda nada en la campaña: escribe un apunte en Tesorería con la
 * marca de la campaña, y la barra lo cuenta de ahí. Un donativo apuntado aquí
 * está en el libro desde el primer segundo, y el tesorero se lo encuentra al
 * conciliar como cualquier otro ingreso.
 */
function FormularioAportacion({ campana, onApuntar, onCerrar }: {
  campana: Recaudacion
  onApuntar: (datos: Parameters<typeof conApunteDeCobro>[1]) => void
  onCerrar: () => void
}) {
  const [importe, setImporte] = useState('')
  const [deQuien, setDeQuien] = useState('')
  const [forma, setForma] = useState<string>(FORMAS[0])
  const [fecha, setFecha] = useState(hoyIso())
  const [error, setError] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const cifra = Number(importe.replace(',', '.'))
    if (!(Number.isFinite(cifra) && cifra > 0)) {
      setError('Pon cuánto ha entrado. Un donativo de cero no se apunta.')
      return
    }
    onApuntar({
      // Una marca por aportación: la campaña se identifica por el trozo de en
      // medio, así que se pueden apuntar veinte donativos sin que se pisen.
      origen: origenDeRecaudacion(campana.id, nuevoId()),
      concepto: deQuien.trim()
        ? `${campana.nombre} — ${deQuien.trim()}`
        : `${campana.nombre} — donativo`,
      categoria: CATEGORIA_CAMPANA,
      importe: cifra,
      fecha,
      metodo: forma,
    })
  }

  return (
    <Drawer open onClose={onCerrar} title={`Aportación a «${campana.nombre}»`}>
      <form className="app-form" onSubmit={enviar}>
        <p className="form-hint">
          Esto se apunta en Tesorería como un ingreso más, con la marca de la campaña. La barra
          cuenta desde ahí: no hay dos sitios donde mirar.
        </p>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="apImporte">Cuánto (€)</label>
            <input
              id="apImporte" type="number" min="0.01" step="0.01" inputMode="decimal"
              value={importe} onChange={(e) => setImporte(e.target.value)} required
            />
          </div>
          <div className="form-row">
            <label htmlFor="apFecha">Cuándo</label>
            <input id="apFecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="apQuien">De quién (opcional)</label>
          <input
            id="apQuien" value={deQuien} maxLength={120}
            onChange={(e) => setDeQuien(e.target.value)}
            placeholder="Se escribe en el concepto del apunte"
          />
          <p className="form-hint">Si lo dejas vacío, el apunte dice solo «donativo».</p>
        </div>
        <div className="form-row">
          <label htmlFor="apForma">Cómo ha entrado</label>
          <select id="apForma" value={forma} onChange={(e) => setForma(e.target.value)}>
            {FORMAS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <p className="form-hint">
            El efectivo va a Caja y lo demás al banco. Importa para conciliar: buscar en el
            extracto un pago que fue en mano es tiempo perdido.
          </p>
        </div>
        <AvisoDeCampo texto={error} />
        <div className="assign-box__row">
          <button type="submit" className="btn btn-primary">Apuntar</button>
          <button type="button" className="btn btn-outline" onClick={onCerrar}>Cancelar</button>
        </div>
      </form>
    </Drawer>
  )
}


/* ══════════════════════════════════════════════════════════════════════════ */
/*  PROYECTOS                                                                 */
/* ══════════════════════════════════════════════════════════════════════════ */

function PanelProyectos() {
  const [proyectos, setProyectos] = useProyectos()
  const [tareas, setTareas] = useTareasProyecto()
  const [campanas] = useRecaudaciones()
  const [movimientos] = useSupabaseTable<Movimiento>(
    'movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES,
    movimientoToRow, rowToMovimiento,
  )
  const [editando, setEditando] = useState<Proyecto | null>(null)
  const [creando, setCreando] = useState(false)

  const hoy = hoyIso()
  const ordenados = useMemo(() => ordenDeProyectos(proyectos, hoy), [proyectos, hoy])

  function guardar(p: Proyecto) {
    setProyectos(proyectos.some((x) => x.id === p.id)
      ? proyectos.map((x) => (x.id === p.id ? p : x))
      : [p, ...proyectos])
    setEditando(null)
    setCreando(false)
  }

  return (
    <>
      <div className="dash-head__actions objetivos__acciones">
        <button type="button" className="btn btn-primary" onClick={() => setCreando(true)}>
          + Nuevo proyecto
        </button>
      </div>

      {ordenados.length === 0 && (
        <p className="objetivos__vacio">
          Todavía no hay ningún proyecto. Sirven para lo que dura meses: restaurar el manto,
          arreglar la casa de hermandad, sacar el libro del centenario. También para lo que
          todavía es solo una idea de un cabildo — así no se pierde.
        </p>
      )}

      <div className="objetivos">
        {ordenados.map((p) => (
          <TarjetaProyecto
            key={p.id}
            proyecto={p}
            tareas={tareasDelProyecto(tareas, p.id)}
            campana={campanas.find((c) => c.id === p.recaudacionId) ?? null}
            movimientos={movimientos}
            hoy={hoy}
            onEditar={() => setEditando(p)}
            onCambiarTareas={setTareas}
            todasLasTareas={tareas}
          />
        ))}
      </div>

      {(creando || editando) && (
        <FormularioProyecto
          proyecto={editando}
          campanas={campanas}
          onGuardar={guardar}
          onCerrar={() => { setEditando(null); setCreando(false) }}
        />
      )}
    </>
  )
}

function TarjetaProyecto({ proyecto, tareas, campana, movimientos, hoy, onEditar, onCambiarTareas, todasLasTareas }: {
  proyecto: Proyecto
  tareas: TareaProyecto[]
  campana: Recaudacion | null
  movimientos: Movimiento[]
  hoy: string
  onEditar: () => void
  onCambiarTareas: (t: TareaProyecto[]) => void
  todasLasTareas: TareaProyecto[]
}) {
  const [nueva, setNueva] = useState('')
  const avance = comoVaElProyecto(tareas)
  const tarde = vaTarde(proyecto, hoy)

  function marcar(t: TareaProyecto) {
    onCambiarTareas(todasLasTareas.map((x) => (x.id === t.id ? { ...x, hecha: !x.hecha } : x)))
  }

  function anadir(e: FormEvent) {
    e.preventDefault()
    const titulo = nueva.trim()
    if (!titulo) return
    onCambiarTareas([...todasLasTareas, {
      id: nuevoId(),
      proyectoId: proyecto.id,
      titulo,
      hecha: false,
      creadaEn: new Date().toISOString(),
    }])
    setNueva('')
  }

  return (
    <article className={`panel proyecto ${tarde ? 'proyecto--tarde' : ''}`}>
      <header className="proyecto__cabecera">
        <div>
          <h2 className="proyecto__titulo">{proyecto.nombre}</h2>
          <p className="proyecto__meta">
            <span className={`pill pill--${proyecto.estado === 'hecho' ? 'ok' : proyecto.estado === 'parado' ? 'warn' : 'off'}`}>
              {proyecto.estado}
            </span>
            {proyecto.responsableNombre && <> · {proyecto.responsableNombre}</>}
            {proyecto.fechaObjetivo && (
              <> · {tarde ? 'tenía que estar el' : 'para el'} {fechaEs(proyecto.fechaObjetivo)}</>
            )}
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={onEditar}>Editar</button>
      </header>

      {proyecto.descripcion && <p className="proyecto__texto">{proyecto.descripcion}</p>}

      {proyecto.presupuesto > 0 && (
        <p className="proyecto__dinero">
          Presupuesto: <b>{formatCurrency(proyecto.presupuesto)}</b>
          {campana && (
            <> · lleva recogido <b>{formatCurrency(loRecaudado(movimientos, campana.id))}</b> en «{campana.nombre}»</>
          )}
        </p>
      )}

      {tareas.length > 0 && (
        <>
          <div
            className="proyecto__barra"
            role="progressbar"
            aria-valuenow={avance.pct} aria-valuemin={0} aria-valuemax={100}
            aria-label={`${proyecto.nombre}: ${avance.hechas} de ${avance.total} tareas`}
          >
            <span style={{ width: `${avance.pct}%` }} />
          </div>
          <p className="proyecto__avance">{avance.hechas} de {avance.total} hechas</p>
        </>
      )}

      <ul className="proyecto__tareas">
        {tareas.map((t) => (
          <li key={t.id} className={tareaVaTarde(t, hoy) ? 'is-tarde' : ''}>
            <label>
              <input type="checkbox" checked={t.hecha} onChange={() => marcar(t)} />
              {' '}
              <span className={t.hecha ? 'is-hecha' : ''}>{t.titulo}</span>
            </label>
            {t.fechaLimite && <small> · {fechaEs(t.fechaLimite)}</small>}
            {t.hermanoNombre && <small> · {t.hermanoNombre}</small>}
          </li>
        ))}
      </ul>

      <form className="proyecto__nueva" onSubmit={anadir}>
        <label className="sr-only" htmlFor={`tarea-${proyecto.id}`}>Nueva tarea</label>
        <input
          id={`tarea-${proyecto.id}`} value={nueva} maxLength={200}
          onChange={(e) => setNueva(e.target.value)}
          placeholder="Añadir una tarea…"
        />
        <button type="submit" className="btn btn-outline btn-sm" disabled={!nueva.trim()}>Añadir</button>
      </form>
    </article>
  )
}

function FormularioProyecto({ proyecto, campanas, onGuardar, onCerrar }: {
  proyecto: Proyecto | null
  campanas: Recaudacion[]
  onGuardar: (p: Proyecto) => void
  onCerrar: () => void
}) {
  const [hermanos] = useSupabaseTable<Hermano>(
    'hermanos', CLAVES_DATOS.hermanos, HERMANOS_INICIALES,
    hermanoToRow, rowToHermano, 'numero',
  )
  const [nombre, setNombre] = useState(proyecto?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(proyecto?.descripcion ?? '')
  const [estado, setEstado] = useState(proyecto?.estado ?? 'idea')
  const [responsableId, setResponsableId] = useState(proyecto?.responsableId ?? '')
  const [fechaObjetivo, setFechaObjetivo] = useState(proyecto?.fechaObjetivo ?? '')
  const [presupuesto, setPresupuesto] = useState(String(proyecto?.presupuesto ?? ''))
  const [recaudacionId, setRecaudacionId] = useState(proyecto?.recaudacionId ?? '')
  const [error, setError] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('Ponle un nombre.'); return }
    const cifra = Number(presupuesto.replace(',', '.'))
    if (presupuesto.trim() !== '' && !(Number.isFinite(cifra) && cifra >= 0)) {
      setError('El presupuesto tiene que ser una cantidad en euros, o quedarse vacío.')
      return
    }
    // El nombre se guarda ADEMÁS del identificador: si ese hermano se da de
    // baja dentro de dos años, el proyecto no se queda sin responsable en el
    // papel. Ver `lib/db/proyectos.ts`.
    const elegido = hermanos.find((h) => h.id === responsableId)
    onGuardar({
      id: proyecto?.id ?? nuevoId(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      estado,
      responsableId: responsableId || undefined,
      responsableNombre: elegido?.nombre ?? proyecto?.responsableNombre,
      fechaObjetivo: fechaObjetivo || undefined,
      presupuesto: presupuesto.trim() === '' ? 0 : cifra,
      recaudacionId: recaudacionId || undefined,
      creadoEn: proyecto?.creadoEn ?? new Date().toISOString(),
    })
  }

  return (
    <Drawer open onClose={onCerrar} title={proyecto ? 'Editar el proyecto' : 'Nuevo proyecto'}>
      <form className="app-form" onSubmit={enviar}>
        <div className="form-row">
          <label htmlFor="proNombre">Nombre</label>
          <input
            id="proNombre" value={nombre} maxLength={120}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Restaurar el manto de salida"
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="proDesc">En qué consiste</label>
          <textarea
            id="proDesc" rows={3} value={descripcion} maxLength={1000}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="proEstado">Estado</label>
            <select id="proEstado" value={estado} onChange={(e) => setEstado(e.target.value as Proyecto['estado'])}>
              {ESTADOS_PROYECTO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="form-hint">
              «Idea» es para lo que se habló en un cabildo y no se ha empezado. Sin un sitio donde
              ponerlo se pierde entre un acta y la siguiente.
            </p>
          </div>
          <div className="form-row">
            <label htmlFor="proResp">Responsable</label>
            <select id="proResp" value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
              <option value="">Sin responsable</option>
              {hermanos.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
            </select>
            <p className="form-hint">Lo que dura dos años y no es de nadie, se muere.</p>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="proFecha">Para cuándo (opcional)</label>
            <input id="proFecha" type="date" value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} />
            <p className="form-hint">Es un objetivo, no una cita. Puede quedarse vacío.</p>
          </div>
          <div className="form-row">
            <label htmlFor="proPresu">Presupuesto (€)</label>
            <input
              id="proPresu" type="number" min="0" step="0.01" inputMode="decimal"
              value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)}
              placeholder="Déjalo vacío si aún no se ha cifrado"
            />
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="proCampana">Campaña que lo paga</label>
          <select id="proCampana" value={recaudacionId} onChange={(e) => setRecaudacionId(e.target.value)}>
            <option value="">Ninguna</option>
            {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <p className="form-hint">
            Enlazarla enseña aquí cuánto lleva recogido. Lo recaudado se cuenta desde Tesorería,
            no se copia: un dato, un sitio.
          </p>
        </div>
        <AvisoDeCampo texto={error} />
        <div className="assign-box__row">
          <button type="submit" className="btn btn-primary">Guardar</button>
          <button type="button" className="btn btn-outline" onClick={onCerrar}>Cancelar</button>
        </div>
      </form>
    </Drawer>
  )
}
