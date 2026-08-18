import { useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import {
  CLAVES_DATO,
  borrarModeloPapeleta,
  saveModeloPapeleta,
  type CampoModelo,
  type ModeloPapeleta,
} from '../lib/modeloPapeleta'
import { nuevoId } from '../lib/supabaseSync'

/** Definición de un dato colocable (etiqueta que se ve en el selector + ejemplo para la vista previa). */
interface ClaveDefinicion {
  clave: string
  etiqueta: string
  ejemplo: string
}

interface Props {
  /** Modelo actual (o null si aún no hay ninguno). */
  modelo: ModeloPapeleta | null
  /** Se llama cada vez que el modelo cambia y se guarda. */
  onCambio: (modelo: ModeloPapeleta | null) => void
  /** Datos disponibles para colocar. Por defecto, los de la papeleta. */
  claves?: ClaveDefinicion[]
  /** Cómo se guarda/borra el modelo. Por defecto, el almacenamiento de la papeleta. */
  guardar?: (modelo: ModeloPapeleta) => void
  borrar?: () => void
}

const COLOR_DEFECTO = '#1a1a1a'

/** Reduce una imagen grande para que quepa holgadamente en localStorage. */
function comprimirImagen(dataUrl: string, maxLado = 1400): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
      if (escala >= 1) {
        resolve(dataUrl)
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export default function ModeloPapeletaEditor({
  modelo,
  onCambio,
  claves = CLAVES_DATO,
  guardar = saveModeloPapeleta,
  borrar = borrarModeloPapeleta,
}: Props) {
  const lienzoRef = useRef<HTMLDivElement>(null)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  function ejemploDe(clave: string): string {
    return claves.find((c) => c.clave === clave)?.ejemplo ?? ''
  }

  function actualizar(next: ModeloPapeleta | null) {
    if (next) guardar(next)
    else borrar()
    onCambio(next)
  }

  async function subirImagen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const esPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!file.type.startsWith('image/') && !esPdf) {
      setError('Sube una imagen (JPG/PNG) o un PDF del modelo.')
      return
    }
    setError(null)
    try {
      if (esPdf) {
        // Un PDF: se rasteriza su primera página y se usa como imagen del modelo.
        setCargando(true)
        const { pdfPrimeraPaginaAImagen } = await import('../lib/pdfAImagen')
        const imagen = await pdfPrimeraPaginaAImagen(file)
        actualizar({ imagenDataUrl: imagen, campos: modelo?.campos ?? [] })
      } else {
        const lector = new FileReader()
        lector.onload = async () => {
          const comprimida = await comprimirImagen(String(lector.result))
          actualizar({ imagenDataUrl: comprimida, campos: modelo?.campos ?? [] })
        }
        lector.readAsDataURL(file)
      }
    } catch (err) {
      console.error('No se pudo procesar el archivo del modelo:', err)
      setError('No se pudo leer el PDF. Prueba con otro archivo o sube una imagen.')
    } finally {
      setCargando(false)
      e.target.value = ''
    }
  }

  function anadirCampo() {
    if (!modelo) return
    const nuevo: CampoModelo = {
      id: nuevoId(),
      clave: 'nombre',
      xPct: 50,
      yPct: 50,
      tamanoPct: 3.2,
      negrita: false,
      color: COLOR_DEFECTO,
      align: 'left',
    }
    const next = { ...modelo, campos: [...modelo.campos, nuevo] }
    actualizar(next)
    setSeleccion(nuevo.id)
  }

  function editarCampo(id: string, cambios: Partial<CampoModelo>) {
    if (!modelo) return
    actualizar({ ...modelo, campos: modelo.campos.map((c) => (c.id === id ? { ...c, ...cambios } : c)) })
  }

  function borrarCampo(id: string) {
    if (!modelo) return
    actualizar({ ...modelo, campos: modelo.campos.filter((c) => c.id !== id) })
    if (seleccion === id) setSeleccion(null)
  }

  function alMover(e: PointerEvent) {
    if (!arrastrando || !lienzoRef.current) return
    const rect = lienzoRef.current.getBoundingClientRect()
    const xPct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const yPct = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    editarCampo(arrastrando, { xPct: Math.round(xPct * 10) / 10, yPct: Math.round(yPct * 10) / 10 })
  }

  const campoSel = modelo?.campos.find((c) => c.id === seleccion) ?? null

  return (
    <div className="modelo-editor">
      {!modelo ? (
        <div className="modelo-editor__subir">
          <p className="form-hint">
            Sube una <strong>imagen</strong> (JPG/PNG) o un <strong>PDF</strong> de tu modelo (una foto,
            un escaneo o el PDF de la imprenta; da igual el diseño). Después colocas encima los datos
            del hermano y, al imprimir, cada documento sale relleno con los datos reales.
          </p>
          <label className="btn btn-primary">
            {cargando ? 'Procesando…' : 'Subir modelo (imagen o PDF)'}
            <input type="file" accept="image/*,application/pdf" onChange={subirImagen} hidden disabled={cargando} />
          </label>
          {error && <p className="form-hint form-hint--error">{error}</p>}
        </div>
      ) : (
        <>
          <div className="modelo-editor__barra">
            <button type="button" className="btn btn-primary btn-sm" onClick={anadirCampo}>
              + Añadir dato
            </button>
            <label className="btn btn-outline btn-sm">
              {cargando ? 'Procesando…' : 'Cambiar imagen/PDF'}
              <input type="file" accept="image/*,application/pdf" onChange={subirImagen} hidden disabled={cargando} />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm rgpd-borrar"
              onClick={() => {
                if (window.confirm('¿Borrar el modelo de papeleta y todos sus campos?')) actualizar(null)
              }}
            >
              Borrar modelo
            </button>
          </div>

          <p className="form-hint">
            Arrastra cada dato hasta su sitio sobre la imagen. Selecciónalo para cambiar qué dato
            muestra, el tamaño, el color o la alineación. La vista previa usa datos de ejemplo.
          </p>

          <div
            className="modelo-editor__lienzo"
            ref={lienzoRef}
            onPointerMove={alMover}
            onPointerUp={() => setArrastrando(null)}
            onPointerLeave={() => setArrastrando(null)}
          >
            <img src={modelo.imagenDataUrl} alt="Modelo de papeleta" className="modelo-editor__img" draggable={false} />
            {modelo.campos.map((campo) => {
              const seleccionado = seleccion === campo.id
              const onDown = (e: PointerEvent) => {
                e.preventDefault()
                setSeleccion(campo.id)
                setArrastrando(campo.id)
              }
              // El QR se muestra como un recuadro con la etiqueta, del tamaño real,
              // para poder colocarlo; en la papeleta final saldrá el QR de verdad.
              if (campo.clave === 'qr') {
                return (
                  <span
                    key={campo.id}
                    className={`modelo-campo modelo-campo--qr modelo-editor__campo modelo-editor__campo--qr${seleccionado ? ' modelo-editor__campo--sel' : ''}`}
                    style={{ left: `${campo.xPct}%`, top: `${campo.yPct}%`, width: `${campo.tamanoPct * 3.2}cqw` }}
                    onPointerDown={onDown}
                  >
                    QR
                  </span>
                )
              }
              const mostrado = campo.clave === 'textoFijo' ? campo.texto || 'Texto' : ejemploDe(campo.clave)
              return (
                <span
                  key={campo.id}
                  className={`modelo-campo modelo-campo--${campo.align} modelo-editor__campo${seleccionado ? ' modelo-editor__campo--sel' : ''}`}
                  style={{
                    left: `${campo.xPct}%`,
                    top: `${campo.yPct}%`,
                    fontSize: `${campo.tamanoPct}cqw`,
                    fontWeight: campo.negrita ? 700 : 400,
                    color: campo.color,
                  }}
                  onPointerDown={onDown}
                >
                  {mostrado}
                </span>
              )
            })}
          </div>

          {campoSel && (
            <div className="modelo-editor__panel">
              <div className="form-row">
                <label>Dato que muestra</label>
                <select
                  value={campoSel.clave}
                  onChange={(e) => editarCampo(campoSel.id, { clave: e.target.value })}
                >
                  {claves.map((c) => (
                    <option key={c.clave} value={c.clave}>{c.etiqueta}</option>
                  ))}
                </select>
              </div>

              {campoSel.clave === 'textoFijo' && (
                <div className="form-row">
                  <label>Texto</label>
                  <input
                    type="text"
                    value={campoSel.texto ?? ''}
                    placeholder="Ej. Titular:"
                    onChange={(e) => editarCampo(campoSel.id, { texto: e.target.value })}
                  />
                </div>
              )}

              <div className="form-grid-2">
                <div className="form-row">
                  <label>Tamaño</label>
                  <input
                    type="range"
                    min={1.5}
                    max={9}
                    step={0.1}
                    value={campoSel.tamanoPct}
                    onChange={(e) => editarCampo(campoSel.id, { tamanoPct: Number(e.target.value) })}
                  />
                </div>
                <div className="form-row">
                  <label>Color</label>
                  <input
                    type="color"
                    value={campoSel.color}
                    onChange={(e) => editarCampo(campoSel.id, { color: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-row">
                  <label>Alineación</label>
                  <select
                    value={campoSel.align}
                    onChange={(e) => editarCampo(campoSel.id, { align: e.target.value as CampoModelo['align'] })}
                  >
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </div>
                <label className="checkbox" style={{ alignSelf: 'end' }}>
                  <input
                    type="checkbox"
                    checked={campoSel.negrita}
                    onChange={(e) => editarCampo(campoSel.id, { negrita: e.target.checked })}
                  />
                  <span>Negrita</span>
                </label>
              </div>

              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => borrarCampo(campoSel.id)}>
                Quitar este dato
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
