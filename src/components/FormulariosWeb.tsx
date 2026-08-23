import { limpiarDni } from '../lib/dni'
import { useId, useRef, useState, type ReactNode } from 'react'
import {
  enviarMensajeWeb,
  erroresFormulario,
  pareceRobot,
  type MensajeWeb,
  type TipoMensajeWeb,
} from '../lib/mensajesWeb'
import { crearSolicitudPrincipal, type SolicitudAlta } from '../lib/solicitudes'
import { nuevoId } from '../lib/supabaseSync'

/**
 * Los formularios de la web pública: lo único de la web que va en sentido
 * contrario, del visitante a la hermandad. Están aquí y no dentro de
 * `SitioContenido` porque tienen estado propio (lo escrito, los errores, el
 * envío) y ese componente es de pintar.
 *
 * Todos comparten la misma forma: se rellenan, se validan campo a campo antes
 * de mandar nada, y al enviarse dejan un acuse por escrito de lo que pasa
 * después. Un formulario que dice «enviado» y no cuenta qué viene luego deja
 * a la gente llamando por teléfono igualmente, que es lo que se quería evitar.
 *
 * En la vista previa del panel (`interactivo = false`) se pintan igual pero no
 * envían: quien está montando su web no puede acabar con su propio buzón lleno
 * de pruebas.
 */

type Errores = Partial<Record<string, string>>

/** Un campo con su etiqueta, su error debajo y el `aria` que los une. */
function Campo({
  id, etiqueta, error, ayuda, children,
}: {
  id: string
  etiqueta: string
  error?: string
  ayuda?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode
}) {
  const idError = `${id}-error`
  const idAyuda = `${id}-ayuda`
  const describe = [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(' ') || undefined
  return (
    <p className="sitio-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describe })}
      {ayuda && <small id={idAyuda} className="sitio-campo__ayuda">{ayuda}</small>}
      {error && <small id={idError} className="sitio-campo__error">{error}</small>}
    </p>
  )
}

/**
 * Las dos defensas contra el spam automático, juntas: el campo trampa y el
 * reloj desde que se abrió el formulario. Ver `pareceRobot`.
 */
function useAntiRobot() {
  // Cada formulario con su propio id: en la misma página puede haber tres
  // (contacto, donativo y lotería) y dos `id` iguales rompen las etiquetas.
  const id = useId()
  const trampa = useRef('')
  // `useState` con función: se toma la hora UNA vez, al montar, no en cada render.
  const [abiertoEn] = useState(() => Date.now())
  return {
    esRobot: () => pareceRobot(trampa.current, Date.now() - abiertoEn),
    // `aria-hidden` + `tabindex=-1`: quien navega con lector de pantalla o con
    // teclado no se lo encuentra nunca. Solo lo ve quien lee el HTML a pelo.
    campo: (
      <p className="sitio-trampa" aria-hidden="true">
        <label htmlFor={`${id}-trampa`}>No rellenes este campo</label>
        <input
          id={`${id}-trampa`} name="apellido-de-soltera" type="text"
          tabIndex={-1} autoComplete="off"
          onChange={(e) => { trampa.current = e.target.value }}
        />
      </p>
    ),
  }
}

/** El acuse de recibo. Va con `role="status"` para que lo lea el lector de pantalla. */
function Acuse({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="sitio-acuse" role="status">
      <b>{titulo}</b>
      <p>{children}</p>
    </div>
  )
}

/** El aviso de protección de datos, con su casilla. Sin aceptarlo no se envía. */
function Consentimiento({
  id, texto, valor, onChange, error,
}: { id: string; texto: string; valor: boolean; onChange: (v: boolean) => void; error?: string }) {
  return (
    <p className="sitio-consent">
      <label htmlFor={id}>
        <input id={id} type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} />
        <span>{texto}</span>
      </label>
      {error && <small className="sitio-campo__error">{error}</small>}
    </p>
  )
}

/* ---------------------------------------------------------------------------
   Contacto
   --------------------------------------------------------------------------- */

export function FormularioContacto({
  interactivo, textoProteccionDatos,
}: { interactivo: boolean; textoProteccionDatos: string }) {
  const base = useId()
  const [datos, setDatos] = useState({ nombre: '', email: '', telefono: '', asunto: '', mensaje: '' })
  const [consiente, setConsiente] = useState(false)
  const [errores, setErrores] = useState<Errores>({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [fallo, setFallo] = useState('')
  const antiRobot = useAntiRobot()
  const set = (k: keyof typeof datos) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [k]: e.target.value }))

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const errs = erroresFormulario({ ...datos, consiente }, { exigeMensaje: true })
    setErrores(errs)
    if (Object.keys(errs).length > 0) return
    // Al robot se le dice que sí y no se guarda nada: si se le enseña el
    // error, reintenta hasta dar con la forma de colarse.
    if (!interactivo || antiRobot.esRobot()) { setEnviado(true); return }
    setEnviando(true)
    setFallo('')
    const r = await enviarMensajeWeb({
      tipo: 'contacto',
      nombre: datos.nombre.trim(),
      email: datos.email.trim(),
      telefono: datos.telefono.trim(),
      asunto: datos.asunto.trim() || 'Mensaje desde la web',
      mensaje: datos.mensaje.trim(),
    })
    setEnviando(false)
    if (r.ok) setEnviado(true)
    else setFallo(r.error ?? 'No se ha podido enviar.')
  }

  if (enviado) {
    return (
      <Acuse titulo="Mensaje enviado">
        Gracias, {datos.nombre.split(' ')[0]}. La hermandad lo recibe en su buzón y te contesta
        a <b>{datos.email}</b>. Si es urgente, llama al teléfono de secretaría.
      </Acuse>
    )
  }

  return (
    <form className="sitio-form" onSubmit={enviar} noValidate>
      <h3>Escríbenos</h3>
      <div className="sitio-form__grid">
        <Campo id={`${base}-nom`} etiqueta="Tu nombre" error={errores.nombre}>
          {(p) => <input {...p} value={datos.nombre} onChange={set('nombre')} autoComplete="name" />}
        </Campo>
        <Campo id={`${base}-mail`} etiqueta="Tu correo" error={errores.email}>
          {(p) => <input {...p} type="email" value={datos.email} onChange={set('email')} autoComplete="email" />}
        </Campo>
        <Campo id={`${base}-tel`} etiqueta="Teléfono (opcional)" error={errores.telefono}>
          {(p) => <input {...p} type="tel" value={datos.telefono} onChange={set('telefono')} autoComplete="tel" />}
        </Campo>
        <Campo id={`${base}-asu`} etiqueta="Asunto">
          {(p) => <input {...p} value={datos.asunto} onChange={set('asunto')} placeholder="Sobre qué escribes" />}
        </Campo>
      </div>
      <Campo id={`${base}-msg`} etiqueta="Tu mensaje" error={errores.mensaje}>
        {(p) => <textarea {...p} rows={5} value={datos.mensaje} onChange={set('mensaje')} />}
      </Campo>
      {antiRobot.campo}
      <Consentimiento
        id={`${base}-rgpd`} texto={textoProteccionDatos} valor={consiente}
        onChange={setConsiente} error={errores.consiente}
      />
      {fallo && <p className="sitio-campo__error" role="alert">{fallo}</p>}
      <button type="submit" className="sitio-btn" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar el mensaje'}
      </button>
      {!interactivo && <small className="sitio-form__previa">Vista previa: aquí no se envía nada.</small>}
    </form>
  )
}

/* ---------------------------------------------------------------------------
   Solicitud de alta como hermano/a
   --------------------------------------------------------------------------- */

export function FormularioAlta({
  interactivo, textoProteccionDatos, onCerrar,
}: { interactivo: boolean; textoProteccionDatos: string; onCerrar?: () => void }) {
  const base = useId()
  const [datos, setDatos] = useState({ nombre: '', dni: '', email: '', telefono: '', clave: '' })
  const [consiente, setConsiente] = useState(false)
  const [errores, setErrores] = useState<Errores>({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [fallo, setFallo] = useState('')
  const antiRobot = useAntiRobot()
  const set = (k: keyof typeof datos) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [k]: e.target.value }))

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const errs: Errores = erroresFormulario({ ...datos, consiente }, { exigeTelefono: true })
    // El DNI y la contraseña son de este formulario, no del genérico: con ellos
    // la persona podrá entrar en su área en cuanto secretaría la dé de alta.
    if (datos.dni.trim().length < 8) errs.dni = 'Escribe tu DNI o NIE completo.'
    if (datos.clave.length < 6) errs.clave = 'Elige una contraseña de 6 caracteres o más.'
    setErrores(errs)
    if (Object.keys(errs).length > 0) return
    // Al robot se le dice que sí y no se guarda nada: si se le enseña el
    // error, reintenta hasta dar con la forma de colarse.
    if (!interactivo || antiRobot.esRobot()) { setEnviado(true); return }
    setEnviando(true)
    setFallo('')
    const solicitud: SolicitudAlta = {
      id: nuevoId(),
      nombre: datos.nombre.trim(),
      // Limpio desde el primer momento: si entra con puntos, no coincidirá
      // con nada después —ni con el censo, ni con su propio acceso—.
      dni: limpiarDni(datos.dni),
      email: datos.email.trim(),
      telefono: datos.telefono.trim(),
      clavePropuesta: datos.clave,
      fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      estado: 'Pendiente',
    }
    const r = await crearSolicitudPrincipal(solicitud)
    setEnviando(false)
    if (r.ok) setEnviado(true)
    else setFallo(r.error ?? 'No se ha podido enviar.')
  }

  if (enviado) {
    return (
      <Acuse titulo="Solicitud enviada">
        Gracias, {datos.nombre.split(' ')[0]}. La secretaría la revisa y te avisa a <b>{datos.email}</b>.
        Cuando te den de alta, entrarás en tu área con tu DNI y la contraseña que acabas de elegir.
      </Acuse>
    )
  }

  return (
    <form className="sitio-form" onSubmit={enviar} noValidate>
      <h3>Solicitar el alta</h3>
      <p className="sitio-form__lead">
        Rellena estos datos y la secretaría se pone en contacto contigo. No se te da de alta hasta
        que la hermandad lo aprueba.
      </p>
      <div className="sitio-form__grid">
        <Campo id={`${base}-nom`} etiqueta="Nombre y apellidos" error={errores.nombre}>
          {(p) => <input {...p} value={datos.nombre} onChange={set('nombre')} autoComplete="name" />}
        </Campo>
        <Campo id={`${base}-dni`} etiqueta="DNI o NIE" error={errores.dni}>
          {(p) => <input {...p} value={datos.dni} onChange={set('dni')} autoComplete="off" />}
        </Campo>
        <Campo id={`${base}-mail`} etiqueta="Correo" error={errores.email}>
          {(p) => <input {...p} type="email" value={datos.email} onChange={set('email')} autoComplete="email" />}
        </Campo>
        <Campo id={`${base}-tel`} etiqueta="Teléfono" error={errores.telefono}>
          {(p) => <input {...p} type="tel" value={datos.telefono} onChange={set('telefono')} autoComplete="tel" />}
        </Campo>
      </div>
      <Campo
        id={`${base}-clave`} etiqueta="Contraseña para tu área" error={errores.clave}
        ayuda="La usarás para entrar en tu área de hermano cuando te den de alta."
      >
        {(p) => <input {...p} type="password" value={datos.clave} onChange={set('clave')} autoComplete="new-password" />}
      </Campo>
      {antiRobot.campo}
      <Consentimiento
        id={`${base}-rgpd`} texto={textoProteccionDatos} valor={consiente}
        onChange={setConsiente} error={errores.consiente}
      />
      {fallo && <p className="sitio-campo__error" role="alert">{fallo}</p>}
      <div className="sitio-form__botones">
        <button type="submit" className="sitio-btn" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar la solicitud'}
        </button>
        {onCerrar && (
          <button type="button" className="sitio-btn sitio-btn--fantasma" onClick={onCerrar}>
            Ahora no
          </button>
        )}
      </div>
      {!interactivo && <small className="sitio-form__previa">Vista previa: aquí no se envía nada.</small>}
    </form>
  )
}

/* ---------------------------------------------------------------------------
   Aviso de donativo y reserva de lotería
   --------------------------------------------------------------------------- */

/**
 * Lo común de las dos cosas que se «piden» desde la web y se pagan fuera de
 * ella: quién eres y cómo localizarte. Lo propio de cada una (cuánto donas,
 * cuántas participaciones quieres) lo pone quien lo usa, con sus errores.
 */
function BaseBreve({
  titulo, lead, textoBoton, interactivo, textoProteccionDatos,
  campos, errorPropio, valida, valores, acuse, tipo,
}: {
  titulo: string
  lead: string
  textoBoton: string
  interactivo: boolean
  textoProteccionDatos: string
  /** Los campos propios, que van dentro de la misma rejilla que los comunes. */
  campos: ReactNode
  /** Error del campo propio, ya calculado por quien lo usa. */
  errorPropio?: string
  /** Se llama al enviar: devuelve el error del campo propio, o nada. */
  valida: () => string | undefined
  /** Lo que este formulario aporta al mensaje además de los datos de contacto. */
  valores: () => Pick<MensajeWeb, 'importe' | 'participaciones' | 'metodo' | 'causa'>
  acuse: (nombre: string) => ReactNode
  tipo: Exclude<TipoMensajeWeb, 'contacto'>
}) {
  const base = useId()
  const [datos, setDatos] = useState({ nombre: '', email: '', telefono: '', mensaje: '' })
  const [consiente, setConsiente] = useState(false)
  const [errores, setErrores] = useState<Errores>({})
  const [propio, setPropio] = useState<string | undefined>(undefined)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [fallo, setFallo] = useState('')
  const antiRobot = useAntiRobot()
  const set = (k: keyof typeof datos) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [k]: e.target.value }))

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const errs = erroresFormulario({ ...datos, consiente })
    const err = valida()
    setPropio(err)
    setErrores(errs)
    if (err || Object.keys(errs).length > 0) return
    if (!interactivo || antiRobot.esRobot()) { setEnviado(true); return }
    setEnviando(true)
    setFallo('')
    const r = await enviarMensajeWeb({
      tipo,
      nombre: datos.nombre.trim(),
      email: datos.email.trim(),
      telefono: datos.telefono.trim(),
      asunto: titulo,
      mensaje: datos.mensaje.trim(),
      ...valores(),
    })
    setEnviando(false)
    if (r.ok) setEnviado(true)
    else setFallo(r.error ?? 'No se ha podido enviar.')
  }

  if (enviado) return <Acuse titulo="Recibido">{acuse(datos.nombre)}</Acuse>

  return (
    <form className="sitio-form" onSubmit={enviar} noValidate>
      <h3>{titulo}</h3>
      <p className="sitio-form__lead">{lead}</p>
      <div className="sitio-form__grid">
        <Campo id={`${base}-nom`} etiqueta="Tu nombre" error={errores.nombre}>
          {(p) => <input {...p} value={datos.nombre} onChange={set('nombre')} autoComplete="name" />}
        </Campo>
        <Campo id={`${base}-mail`} etiqueta="Tu correo" error={errores.email}>
          {(p) => <input {...p} type="email" value={datos.email} onChange={set('email')} autoComplete="email" />}
        </Campo>
        <Campo id={`${base}-tel`} etiqueta="Teléfono (opcional)" error={errores.telefono}>
          {(p) => <input {...p} type="tel" value={datos.telefono} onChange={set('telefono')} autoComplete="tel" />}
        </Campo>
        {campos}
      </div>
      {(propio ?? errorPropio) && <small className="sitio-campo__error">{propio ?? errorPropio}</small>}
      <Campo id={`${base}-msg`} etiqueta="¿Quieres decirnos algo? (opcional)">
        {(p) => <textarea {...p} rows={3} value={datos.mensaje} onChange={set('mensaje')} />}
      </Campo>
      {antiRobot.campo}
      <Consentimiento
        id={`${base}-rgpd`} texto={textoProteccionDatos} valor={consiente}
        onChange={setConsiente} error={errores.consiente}
      />
      {fallo && <p className="sitio-campo__error" role="alert">{fallo}</p>}
      <button type="submit" className="sitio-btn" disabled={enviando}>
        {enviando ? 'Enviando…' : textoBoton}
      </button>
      {!interactivo && <small className="sitio-form__previa">Vista previa: aquí no se envía nada.</small>}
    </form>
  )
}

export function FormularioDonativo({
  interactivo, textoProteccionDatos, importes, causas,
}: { interactivo: boolean; textoProteccionDatos: string; importes: number[]; causas: string[] }) {
  const base = useId()
  const [importe, setImporte] = useState('')
  const [causa, setCausa] = useState('')
  const [metodo, setMetodo] = useState<'Bizum' | 'Transferencia'>('Bizum')
  const cifra = Number((importe || '').replace(',', '.'))

  return (
    <BaseBreve
      tipo="donativo"
      interactivo={interactivo}
      textoProteccionDatos={textoProteccionDatos}
      titulo="Avísanos de tu donativo"
      lead="Si ya lo has hecho, dínoslo y la tesorería lo identifica sin tener que buscarlo."
      textoBoton="Avisar del donativo"
      valida={() => (cifra > 0 ? undefined : 'Dinos cuánto has dado.')}
      valores={() => ({ importe: cifra, causa: causa || undefined, metodo })}
      acuse={(nombre) => (
        <>Gracias{nombre.trim() ? `, ${nombre.split(' ')[0]}` : ''}. La tesorería lo cuadra con el
        ingreso y te confirma por correo. Tu donativo sostiene la caridad de esta casa.</>
      )}
      campos={
        <>
          <Campo id={`${base}-imp`} etiqueta="Cuánto (€)">
            {(p) => (
              <input {...p} type="number" min="1" step="1" inputMode="decimal"
                value={importe} onChange={(e) => setImporte(e.target.value)} />
            )}
          </Campo>
          <Campo id={`${base}-met`} etiqueta="Por dónde">
            {(p) => (
              <select {...p} value={metodo} onChange={(e) => setMetodo(e.target.value as 'Bizum' | 'Transferencia')}>
                <option value="Bizum">Bizum</option>
                <option value="Transferencia">Transferencia</option>
              </select>
            )}
          </Campo>
          {causas.length > 0 && (
            <Campo id={`${base}-cau`} etiqueta="Para qué (opcional)">
              {(p) => (
                <select {...p} value={causa} onChange={(e) => setCausa(e.target.value)}>
                  <option value="">Lo que más falta haga</option>
                  {causas.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </Campo>
          )}
          {importes.length > 0 && (
            <p className="sitio-form__sugeridos">
              {importes.map((i) => (
                <button key={i} type="button" className="sitio-chip" onClick={() => setImporte(String(i))}>
                  {i} €
                </button>
              ))}
            </p>
          )}
        </>
      }
    />
  )
}

export function FormularioLoteria({
  interactivo, textoProteccionDatos, maximo, precio, dondeRecoger,
}: {
  interactivo: boolean
  textoProteccionDatos: string
  maximo: number
  precio: number
  dondeRecoger: string
}) {
  const base = useId()
  const [cuantas, setCuantas] = useState('1')
  const n = Number(cuantas)

  return (
    <BaseBreve
      tipo="loteria"
      interactivo={interactivo}
      textoProteccionDatos={textoProteccionDatos}
      titulo="Reservar participaciones"
      lead={dondeRecoger.trim()
        ? `Te las apartamos y las recoges en ${dondeRecoger}.`
        : 'Te las apartamos y te decimos cómo recogerlas.'}
      textoBoton="Reservar"
      valida={() => {
        if (!Number.isFinite(n) || n < 1) return 'Dinos cuántas quieres.'
        if (maximo > 0 && n > maximo) return `Como mucho ${maximo} por persona.`
        return undefined
      }}
      valores={() => ({ participaciones: n })}
      acuse={(nombre) => (
        <>Apuntado{nombre.trim() ? `, ${nombre.split(' ')[0]}` : ''}. Te apartamos
        {n === 1 ? ' la participación' : ` las ${n} participaciones`} y te avisamos para
        recogerlas. Suerte.</>
      )}
      campos={
        <Campo
          id={`${base}-n`}
          etiqueta="Cuántas participaciones"
          ayuda={precio > 0 && Number.isFinite(n) && n > 0 ? `Son ${n * precio} €` : undefined}
        >
          {(p) => (
            <input {...p} type="number" min="1" max={maximo > 0 ? maximo : undefined} step="1"
              inputMode="numeric" value={cuantas} onChange={(e) => setCuantas(e.target.value)} />
          )}
        </Campo>
      }
    />
  )
}

export { Campo as CampoWeb }
