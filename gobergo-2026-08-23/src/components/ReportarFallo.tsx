import { useState, type FormEvent } from 'react'
import Drawer from './Drawer'
import { enlaceDeReserva, mandarReporte, type ContextoDelFallo } from '../lib/reporteFallo'

/**
 * El cajón de «contar un fallo».
 *
 * DOS PREGUNTAS Y NADA MÁS. Un formulario largo se abandona, y lo que de
 * verdad hace falta para arreglar algo no lo escribe quien lo sufre: se
 * adjunta solo (la pantalla, el cargo, el último error de la base).
 *
 * Y si no se puede mandar, no se pierde: sale un enlace con el reporte ya
 * escrito para enviarlo desde su propio correo. Un canal de fallos que falla
 * no sirve de nada.
 */
export default function ReportarFallo({
  abierto,
  onCerrar,
  contexto,
}: {
  abierto: boolean
  onCerrar: () => void
  contexto: ContextoDelFallo
}) {
  const [queHacia, setQueHacia] = useState('')
  const [queFallo, setQueFallo] = useState('')
  const [correo, setCorreo] = useState('')
  const [mandando, setMandando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [fallo, setFallo] = useState<{ error: string; reserva: string } | null>(null)

  function cerrarYLimpiar() {
    onCerrar()
    // Se limpia al cerrar y no al enviar: si algo falló, lo escrito tiene que
    // seguir ahí para poder intentarlo otra vez sin volver a teclearlo.
    setTimeout(() => {
      setQueHacia(''); setQueFallo(''); setCorreo('')
      setEnviado(false); setFallo(null)
    }, 300)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setMandando(true)
    setFallo(null)
    const r = await mandarReporte({ queHacia, queFallo, correoDeQuienLoManda: correo }, contexto)
    setMandando(false)
    if (r.ok) { setEnviado(true); return }
    setFallo({
      error: r.error ?? 'No se ha podido mandar.',
      reserva: r.reserva ?? enlaceDeReserva({ queHacia, queFallo, correoDeQuienLoManda: correo }, contexto),
    })
  }

  return (
    <Drawer
      open={abierto}
      onClose={cerrarYLimpiar}
      title="Contar un fallo"
      subtitle="Soporte de Gobergo"
      footer={
        enviado ? (
          <button className="btn btn-primary" onClick={cerrarYLimpiar}>Cerrar</button>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={cerrarYLimpiar}>Cancelar</button>
            <button className="btn btn-primary" form="form-fallo" type="submit" disabled={mandando}>
              {mandando ? 'Mandando…' : 'Mandar el fallo'}
            </button>
          </>
        )
      }
    >
      {enviado ? (
        <div className="banner banner--ok" role="status">
          <strong>Mandado.</strong> Gracias: con esto se puede mirar de verdad. Si has dejado tu
          correo, te contestarán por ahí.
        </div>
      ) : (
        <form id="form-fallo" className="app-form" onSubmit={enviar}>
          <p className="form-hint">
            Cuéntalo como se lo contarías a alguien por teléfono. Los datos técnicos —en qué
            pantalla estabas, tu cargo y el último error de la base— <b>van solos</b>, no hace falta
            que los busques.
          </p>

          <div className="form-row">
            <label htmlFor="fallo-que">¿Qué estabas haciendo?</label>
            <textarea
              id="fallo-que" rows={2} required
              value={queHacia} onChange={(e) => setQueHacia(e.target.value)}
              placeholder="Ej. Estaba emitiendo una papeleta a un hermano"
            />
          </div>

          <div className="form-row">
            <label htmlFor="fallo-paso">¿Qué esperabas y qué pasó?</label>
            <textarea
              id="fallo-paso" rows={3} required
              value={queFallo} onChange={(e) => setQueFallo(e.target.value)}
              placeholder="Ej. Esperaba que apareciera en el cortejo y el tramo sigue a 0"
            />
          </div>

          <div className="form-row">
            <label htmlFor="fallo-correo">Tu correo, si quieres que te contesten</label>
            <input
              id="fallo-correo" type="email" value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {contexto.ultimoErrorBd && (
            <div className="banner banner--info">
              <strong>Se manda también el último error de la base de datos.</strong> Es el dato que
              más ayuda a encontrar la causa.
            </div>
          )}

          {fallo && (
            /* No se pierde. El enlace lleva el reporte ya escrito: solo hay que
               darle a enviar desde su propio correo. */
            <div className="banner banner--error" role="alert">
              <strong>No se ha podido mandar desde aquí.</strong> {fallo.error}
              <p style={{ margin: '0.6rem 0 0' }}>
                <a className="btn btn-outline btn-sm" href={fallo.reserva}>
                  Mandarlo desde mi correo
                </a>
              </p>
            </div>
          )}
        </form>
      )}
    </Drawer>
  )
}
