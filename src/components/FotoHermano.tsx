import { useId, useRef, useState } from 'react'
import { comprimirImagen, leerArchivo, pesoDeDataUrl, recortarCuadrado } from '../lib/imagen'
import { guardarImagen } from '../lib/almacenImagenes'

/**
 * La foto del hermano. Se recorta en cuadrado al subirla, así que se ve igual
 * en la ficha, en el carné y en el listado del cortejo, que es donde de verdad
 * hace falta: el diputado de tramo busca caras, no números.
 *
 * El **consentimiento va aparte** y es obligatorio antes de guardar nada: una
 * foto es un dato personal de los que la hermandad tiene que poder demostrar
 * que se consintieron. Sin la casilla marcada, el botón de subir ni aparece.
 */
export default function FotoHermano({
  nombre,
  foto,
  consiente,
  onCambiar,
  soloLectura = false,
  tamano = 96,
}: {
  nombre: string
  foto: string | null | undefined
  consiente: boolean | undefined
  /** Recibe la foto ya recortada (o null al quitarla) y el consentimiento. */
  onCambiar: (foto: string | null, consiente: boolean) => void
  /** En la ficha que solo se consulta, sin botones. */
  soloLectura?: boolean
  tamano?: number
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  async function subir(file: File | null) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('Eso no es una imagen. Sube un JPG o un PNG.')
      return
    }
    setCargando(true)
    const crudo = await leerArchivo(file)
    if (!crudo) {
      setCargando(false)
      setError('No se ha podido leer el archivo. Prueba con otro.')
      return
    }
    // Primero se reduce y luego se recorta: recortar una foto de 12 megapíxeles
    // a pelo deja al navegador clavado unos segundos.
    const recortada = await recortarCuadrado(await comprimirImagen(crudo, 1000, 0.85), 400, 0.8)
    /*
     * Y al almacén. Guardada dentro de la ficha, la foto son ~40 kB de texto
     * EN LA PROPIA FILA del hermano, y esa fila viaja entera cada vez que se
     * carga el censo: con seiscientos hermanos con foto son veinticinco megas
     * en cada listado. Aquí lo que se guarda es la dirección.
     *
     * Si no hay almacén devuelve la foto tal cual y todo sigue como antes.
     */
    const guardada = await guardarImagen(recortada, 'hermanos')
    setCargando(false)
    onCambiar(guardada, true)
  }

  return (
    <div className="foto-hermano">
      <span
        className="foto-hermano__marco"
        style={{ width: tamano, height: tamano }}
        aria-hidden={foto ? undefined : true}
      >
        {foto ? (
          <img src={foto} alt={`Foto de ${nombre}`} />
        ) : (
          <span className="foto-hermano__iniciales">{iniciales || '—'}</span>
        )}
      </span>

      {!soloLectura && (
        <div className="foto-hermano__acciones">
          {/* Sin consentimiento no se enseña siquiera el botón de subir: no
              tiene sentido pedir una foto que no se va a poder guardar. */}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!consiente}
              onChange={(e) => onCambiar(e.target.checked ? (foto ?? null) : null, e.target.checked)}
            />
            <span>
              Doy permiso para que la hermandad guarde y use mi foto
              <small className="portal__pref-explica">
                Sale en el carné, en la ficha y en el listado del cortejo. Se puede retirar cuando se
                quiera: al quitar el permiso, la foto se borra.
              </small>
            </span>
          </label>

          {consiente && (
            <>
              <input
                ref={inputRef}
                id={`${id}-file`}
                type="file"
                accept="image/*"
                className="foto-hermano__input"
                onChange={(e) => { subir(e.target.files?.[0] ?? null); e.target.value = '' }}
              />
              <div className="foto-hermano__botones">
                <label htmlFor={`${id}-file`} className="btn btn-outline btn-sm">
                  {cargando ? 'Procesando…' : foto ? 'Cambiar la foto' : 'Subir una foto'}
                </label>
                {foto && (
                  <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => onCambiar(null, true)}>
                    Quitar
                  </button>
                )}
              </div>
              <p className="form-hint">
                Se recorta en cuadrado por el centro y se guarda a 400 px.
                {foto && ` Ocupa ${Math.round(pesoDeDataUrl(foto) / 1024)} kB.`}
              </p>
            </>
          )}
          {error && <p className="aviso-falta__error-suelto">{error}</p>}
        </div>
      )}
    </div>
  )
}
