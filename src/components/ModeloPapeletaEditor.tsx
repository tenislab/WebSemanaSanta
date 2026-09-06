import { useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import {
  CLAVES_DATO,
  borrarModeloPapeleta,
  camposPorDefecto,
  saveModeloPapeleta,
  type CampoModelo,
  type ModeloPapeleta,
} from '../lib/modeloPapeleta'
import { nuevoId } from '../lib/supabaseSync'
import { recibirImagen } from '../lib/almacenImagenes'
import { leerArchivo } from '../lib/imagen'

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
      setCargando(true)
      /*
       * De PDF a imagen si hace falta, y de ahí al camino común: encoger y
       * subir al almacén (`recibirImagen`).
       *
       * Antes esto tenía su PROPIA copia del compresor y no subía nada, así
       * que el modelo escaneado de la papeleta se quedaba en base64 dentro de
       * `hermandad_settings` —la misma fila que se lee entera en cada carga
       * del panel y de la web—. Un escaneo a 1400 px son varios cientos de
       * kilos viajando en cada visita de cada persona.
       */
      const crudo = esPdf
        ? await (await import('../lib/pdfAImagen')).pdfPrimeraPaginaAImagen(file)
        : await leerArchivo(file)
      if (!crudo) {
        setError('No se ha podido leer ese archivo. Prueba con otro.')
        return
      }
      const imagen = await recibirImagen(crudo, { carpeta: 'modelos', maxLado: 1400, calidad: 0.85 })
      actualizar({
        imagenDataUrl: imagen,
        campos: modelo?.campos?.length ? modelo.campos : camposPorDefecto(nuevoId),
      })
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
