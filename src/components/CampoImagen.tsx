import { useId, useState } from 'react'
import { recibirImagen, esDataUrl } from '../lib/almacenImagenes'
import { pesoDeDataUrl } from '../lib/imagen'

/**
 * SUBIR UNA IMAGEN DESDE EL ORDENADOR, CON SU VISTA PREVIA.
 *
 * Está aquí fuera porque hacía falta en dos sitios a la vez y en los dos el
 * camino anterior era el mismo: un campo de texto donde PEGAR UNA DIRECCIÓN.
 *
 *   · La tienda ya guardaba `fotoUrl` y la web pública ya la pintaba, pero el
 *     único modo de ponerla era escribir «https://…». O sea que para enseñar
 *     una medalla había que subir antes la foto a otro sitio —y tener ese otro
 *     sitio—. Eso no es poder poner la foto del producto: es poder enlazarla.
 *   · Los eventos no tenían imagen de ninguna manera.
 *
 * COMPRIME Y SUBE EN UN PASO, con `recibirImagen`, que es el único sitio del
 * proyecto donde esas dos cosas van juntas y por un buen motivo: cuando
 * estaban separadas, tres pantallas subían la misma clase de imagen de tres
 * maneras distintas y una de ellas se dejaba 800 KB en base64 dentro de una
 * fila que se lee en cada carga.
 *
 * Y SIGUE ACEPTANDO UNA DIRECCIÓN. Quien ya tenga sus fotos en su web no
 * tiene por qué volver a subirlas, así que el campo de texto se queda: lo que
 * se añade es el botón, no se quita la otra puerta.
 *
 * NO FALLA POR NO TENER ALMACÉN. `recibirImagen` devuelve la imagen comprimida
 * cuando no hay a dónde subir (modo demostración, o falta ejecutar
 * `supabase/imagenes.sql`), que es exactamente lo que se guardaba antes.
 */
/** El tamaño dicho de forma que nunca salga «0 kB» por redondeo. */
function peso(dataUrl: string): string {
  const bytes = pesoDeDataUrl(dataUrl)
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function CampoImagen({
  valor,
  onCambiar,
  rotulo = 'Imagen',
  carpeta,
  ayuda,
  nombreCampo,
}: {
  valor: string | undefined
  onCambiar: (valor: string | undefined) => void
  rotulo?: string
  /** Carpeta dentro del almacén: «tienda», «eventos»… */
  carpeta: string
  /** Lo que conviene saber antes de elegir el fichero (tamaño recomendado…). */
  ayuda?: string
  /**
   * Si se pasa, el valor viaja además en un `input` oculto con ese nombre,
   * para los formularios que se leen con `FormData` en el `submit` en vez de
   * llevar el estado campo a campo. Son la mayoría de los de esta aplicación.
   */
  nombreCampo?: string
}) {
  const id = useId()
  const [cargando, setCargando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function elegir(file: File | null) {
    if (!file) return
    setFallo(null)
    setCargando(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const lector = new FileReader()
        lector.onload = () => resolve(String(lector.result))
        lector.onerror = () => reject(lector.error)
        lector.readAsDataURL(file)
      })
      onCambiar(await recibirImagen(dataUrl, { carpeta }))
    } catch {
      /*
       * SE DICE QUE NO HA ENTRADO. Antes de esto, una imagen que no se podía
       * leer dejaba el campo igual que estaba y quien la había elegido se iba
       * convencido de haberla puesto. Es el peor sitio para callarse: la foto
       * no se ve hasta que alguien abre la tienda.
       */
      setFallo('No se ha podido leer esa imagen. Prueba con otra, o pega su dirección aquí abajo.')
    } finally {
      setCargando(false)
    }
  }

  const subida = esDataUrl(valor)

  return (
    <div className="campo-imagen">
      <label htmlFor={`${id}-file`}>{rotulo}</label>
      {valor && (
        <div className="campo-imagen__vista">
          {/* La vista previa es el único modo de saber que se ha subido LA que
              se quería: el nombre del fichero no dice si era la buena. */}
          <img src={valor} alt="" />
          <div className="campo-imagen__datos">
            <span className="table-subtle">
              {/* Redondear a kB daba «0 kB» con una imagen pequeña, que se lee
                  como que no ha entrado nada. */}
              {subida ? `Guardada aquí · ${peso(valor)}` : 'Enlazada desde fuera'}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCambiar(undefined)}>
              Quitar
            </button>
          </div>
        </div>
      )}
      <input
        id={`${id}-file`}
        type="file"
        accept="image/*"
        className="campo-imagen__input"
        onChange={(e) => { void elegir(e.target.files?.[0] ?? null); e.target.value = '' }}
      />
      <div className="campo-imagen__botones">
        <label htmlFor={`${id}-file`} className="btn btn-outline btn-sm">
          {cargando ? 'Procesando…' : valor ? 'Cambiar la imagen' : 'Subir una imagen'}
        </label>
      </div>
      {fallo && <p className="form-hint form-hint--error">{fallo}</p>}
      {ayuda && <p className="form-hint">{ayuda}</p>}
      <details className="campo-imagen__enlace">
        <summary>O pegar la dirección de una que ya esté en internet</summary>
        <input
          type="url"
          value={subida ? '' : valor ?? ''}
          placeholder="https://…"
          onChange={(e) => onCambiar(e.target.value.trim() || undefined)}
        />
      </details>
      {nombreCampo && <input type="hidden" name={nombreCampo} value={valor ?? ''} />}
    </div>
  )
}
