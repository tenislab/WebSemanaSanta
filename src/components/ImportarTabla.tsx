import { useMemo, useRef, useState } from 'react'
import Drawer from './Drawer'
import { descargarArchivo } from '../lib/csv'
import { nuevoId } from '../lib/supabaseSync'
import { leerCsv, pareceBinario } from '../lib/leerTabla'
import {
  aplicarTabla, csvDeProblemas, ensayarTabla, faltanColumnas, proponerColumnas,
  type ContextoDeTabla, type Emparejado, type EnsayoDeTabla, type TablaImportable,
} from '../lib/importarTabla'
import { ExcelIlegible, leerXlsx, pareceXlsx } from '../lib/leerExcel'

/**
 * Traer una tabla que la hermandad ya tiene: el historial de cuotas, el libro
 * de caja o el inventario.
 *
 * Es el mismo asistente de cuatro pasos del censo (`ImportarCenso.tsx`), y **el
 * tercero sigue siendo el importante**: antes de tocar nada se enseña qué va a
 * pasar exactamente, fila a fila. Aquí lo que se trae es dinero y patrimonio,
 * así que importar mal y no poder deshacerlo sería todavía peor.
 *
 * Lo que cambia de una tabla a otra —qué columnas hay, cómo se lee una fila,
 * cómo se reconoce lo que ya está— lo pone el descriptor. Esta pantalla no sabe
 * qué es una cuota ni qué es un enser.
 */
type Paso = 'archivo' | 'columnas' | 'ensayo' | 'hecho'

export default function ImportarTabla<T extends { id: string; numero: number }>({
  abierto, onCerrar, tabla, existentes, ctx, onImportar,
}: {
  abierto: boolean
  onCerrar: () => void
  tabla: TablaImportable<T>
  existentes: T[]
  ctx: ContextoDeTabla
  /** Recibe la lista resultante. Guardar es cosa de quien lo usa, con el mecanismo de siempre. */
  onImportar: (lista: T[]) => void
}) {
  const [paso, setPaso] = useState<Paso>('archivo')
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [filas, setFilas] = useState<string[][]>([])
  const [emparejado, setEmparejado] = useState<Emparejado>({})
  const [conLosQueYaEstan, setConLosQueYaEstan] = useState<'actualizar' | 'saltar'>('actualizar')
  const [resultado, setResultado] = useState<{ creados: number; actualizados: number } | null>(null)
  /**
   * La lista tal y como estaba justo antes de importar. Traer tres mil recibos
   * y no poder volver atrás es el miedo que impide pulsar el botón; con esto se
   * deshace de un clic mientras el panel siga abierto.
   */
  const [listaAnterior, setListaAnterior] = useState<T[] | null>(null)
  const [deshecho, setDeshecho] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const cabeceras = filas[0] ?? []
  const ensayo: EnsayoDeTabla<T> | null = useMemo(
    () => (filas.length > 1 ? ensayarTabla(filas, emparejado, existentes, tabla, ctx) : null),
    [filas, emparejado, existentes, tabla, ctx],
  )
  const faltan = faltanColumnas(tabla.campos, emparejado)
  const otroMotivo = filas.length > 1 ? (tabla.faltaAlgo?.(emparejado) ?? null) : null

  function reiniciar() {
    setPaso('archivo'); setFilas([]); setNombreArchivo(''); setResultado(null); setErrorArchivo('')
    setListaAnterior(null); setDeshecho(false); setEmparejado({})
  }

  async function elegirArchivo(f: File | null) {
    if (!f) return
    setErrorArchivo('')

    // El Excel se LEE, no se manda convertir: ver el comentario largo en
    // ImportarCenso.tsx. Y se mira el CONTENIDO, no la extensión.
    const bytes = new Uint8Array(await f.arrayBuffer())
    if (pareceXlsx(bytes)) {
      let delExcel: string[][]
      try {
        delExcel = await leerXlsx(bytes)
      } catch (e) {
        setErrorArchivo(
          e instanceof ExcelIlegible
            ? e.message
            : 'No se ha podido abrir el archivo de Excel. Guárdalo otra vez desde Excel y vuelve a subirlo.',
        )
        return
      }
      if (delExcel.length < 2) {
        setErrorArchivo('La primera hoja del Excel no tiene filas de datos, solo la cabecera (o está vacía).')
        return
      }
      empezarCon(delExcel, f.name)
      return
    }

    const texto = new TextDecoder('utf-8').decode(bytes)
    if (pareceBinario(texto)) {
      setErrorArchivo(
        'Este archivo no es texto ni una hoja de Excel moderna. Si es un .xls de los antiguos, '
        + 'ábrelo en Excel y usa Archivo → Guardar como → Libro de Excel (.xlsx).',
      )
      return
    }
    const leidas = leerCsv(texto)
    if (leidas.length < 2) {
      setErrorArchivo('El archivo no tiene filas de datos, solo la cabecera (o está vacío).')
      return
    }
    empezarCon(leidas, f.name)
  }

  /** Ya tenemos las filas, vengan del Excel o del CSV: el resto es igual. */
  function empezarCon(leidas: string[][], nombre: string) {
    setNombreArchivo(nombre)
    setFilas(leidas)
    setEmparejado(proponerColumnas(tabla.campos, leidas[0]))
    setPaso('columnas')
  }

  function confirmar() {
    if (!ensayo) return
    setListaAnterior(existentes)
    const r = aplicarTabla(ensayo, existentes, tabla, { conLosQueYaEstan }, nuevoId)
    onImportar(r.lista)
    setResultado({ creados: r.creados, actualizados: r.actualizados })
    setDeshecho(false)
    setPaso('hecho')
  }

  function deshacer() {
    if (!listaAnterior) return
    onImportar(listaAnterior)
    setDeshecho(true)
  }

  const aImportar = ensayo ? ensayo.nuevos + (conLosQueYaEstan === 'actualizar' ? ensayo.actualizados : 0) : 0
  // Concordancia: «1 pieza importada», no «1 pieza importado». Lo pone el
  // descriptor porque el género es de cada tabla, no de esta pantalla.
  const a = tabla.genero === 'f' ? 'a' : 'o'
  const cuantos = (n: number) => `${n} ${n === 1 ? tabla.singular : tabla.plural}`
  const titulos: Record<Paso, string> = {
    archivo: tabla.titulo,
    columnas: 'Qué es cada columna',
    ensayo: 'Esto es lo que va a pasar',
    hecho: 'Ya está importado',
  }

  return (
    <Drawer
      open={abierto}
      onClose={() => { onCerrar(); reiniciar() }}
      title={titulos[paso]}
      subtitle={nombreArchivo || undefined}
      footer={
        <>
          {paso === 'columnas' && (
            <button
              className="btn btn-primary"
              disabled={faltan.length > 0 || otroMotivo !== null}
              onClick={() => setPaso('ensayo')}
            >
              {faltan.length > 0
                ? `Falta decir cuál es ${faltan.map((c) => c.etiqueta.toLowerCase()).join(' y ')}`
                : otroMotivo ?? 'Ver qué va a pasar'}
            </button>
          )}
          {paso === 'ensayo' && ensayo && (
            <>
              <button className="btn btn-primary" disabled={aImportar === 0} onClick={confirmar}>
                {aImportar === 0 ? 'No hay nada que importar' : `Importar ${cuantos(aImportar)}`}
              </button>
              <button className="btn btn-ghost" onClick={() => setPaso('columnas')}>Volver a las columnas</button>
            </>
          )}
          {paso === 'hecho' && (
            <>
              <button className="btn btn-primary" onClick={() => { onCerrar(); reiniciar() }}>Cerrar</button>
              {listaAnterior && !deshecho && (
                <button className="btn btn-ghost rgpd-borrar" onClick={deshacer}>
                  Deshacer esta importación
                </button>
              )}
            </>
          )}
        </>
      }
    >
      {/* ---------------------------------------------------------------- */}
      {paso === 'archivo' && (
        <>
          <p className="form-hint">{tabla.explicacion}</p>
          <p className="form-hint">
            Subid el <b>Excel tal cual</b> (.xlsx) o un CSV — se lee igual. No se toca nada hasta
            que veáis qué va a pasar y lo confirméis.
          </p>
          <div className="importar-suelta">
            {/* Sin `accept` a propósito: con la lista de tipos puesta, el cuadro
                del sistema grisea archivos que sí valen y se lee como que la
                aplicación está rota. Ver el comentario largo en ImportarCenso. */}
            <input
              ref={inputRef} id={`importarArchivo-${tabla.id}`} type="file"
              onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
            />
            <label htmlFor={`importarArchivo-${tabla.id}`} className="btn btn-primary">
              Elegir el archivo
            </label>
          </div>
          {errorArchivo && <p className="aviso-falta__error-suelto">{errorArchivo}</p>}
          <details className="afinar">
            <summary>
              <span className="afinar__titulo">¿Qué columnas hacen falta?</span>
              <span className="afinar__nota">{tabla.imprescindibles}</span>
            </summary>
            <p className="form-hint">{tabla.ayudaColumnas}</p>
            <p className="form-hint">
              Da igual cómo se llamen vuestras columnas: en el paso siguiente decís qué es cada una.
            </p>
          </details>
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {paso === 'columnas' && (
        <>
          <p className="form-hint">
            Hemos reconocido lo que hemos podido por el nombre de la columna. <b>Repasadlo</b>:
            aquí es donde se cuela un importe en la casilla del año.
          </p>
          <div className="importar-campos">
            {tabla.campos.map((c) => (
              <div className="form-row" key={c.id}>
                <label htmlFor={`col-${tabla.id}-${c.id}`}>
                  {c.etiqueta}
                  {c.obligatorio && <span className="importar-obligatorio"> · imprescindible</span>}
                </label>
                <select
                  id={`col-${tabla.id}-${c.id}`}
                  value={emparejado[c.id] ?? ''}
                  onChange={(e) =>
                    setEmparejado((prev) => ({
                      ...prev,
                      [c.id]: e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                >
                  <option value="">— no está en el archivo —</option>
                  {cabeceras.map((h, i) => (
                    <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>
                  ))}
                </select>
                {c.ayuda && <p className="form-hint">{c.ayuda}</p>}
                {/* Un ejemplo de la propia hoja: es lo que de verdad delata un
                    emparejado mal hecho, mucho más que el nombre de la columna. */}
                {emparejado[c.id] !== null && emparejado[c.id] !== undefined && filas[1] && (
                  <p className="importar-ejemplo">
                    En vuestro archivo: <b>{filas[1][emparejado[c.id] as number] || '(vacío)'}</b>
                  </p>
                )}
              </div>
            ))}
          </div>
          {otroMotivo && (
            <div className="aviso-falta" role="note">
              <p className="aviso-falta__titulo">
                <span className="aviso-falta__marca" aria-hidden="true" />
                {otroMotivo}
              </p>
            </div>
          )}
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {paso === 'ensayo' && ensayo && (
        <>
          <div className="importar-resumen">
            <div className="importar-cifra importar-cifra--ok">
              <strong>{ensayo.nuevos}</strong><span>entran nuev{a}s</span>
            </div>
            <div className="importar-cifra">
              <strong>{ensayo.actualizados}</strong><span>ya estaban</span>
            </div>
            <div className={`importar-cifra${ensayo.errores > 0 ? ' importar-cifra--mal' : ''}`}>
              <strong>{ensayo.errores}</strong><span>no se pueden importar</span>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor={`yaEstan-${tabla.id}`}>Con los que ya están</label>
            <select
              id={`yaEstan-${tabla.id}`} value={conLosQueYaEstan}
              onChange={(e) => setConLosQueYaEstan(e.target.value as 'actualizar' | 'saltar')}
            >
              <option value="actualizar">Actualizarlos con los datos del archivo</option>
              <option value="saltar">Dejarlos como están</option>
            </select>
            <p className="form-hint">
              Al actualizar solo se pisa lo que trae el archivo: una columna que vuestra hoja no
              tiene no borra lo que ya estuviera guardado en Gobergo.
            </p>
          </div>

          {ensayo.avisos.length > 0 && (
            <div className="banner banner--warn" role="note" style={{ marginTop: '0.8rem' }}>
              <div>
                <strong>Antes de importar, mirad esto</strong>
                <ul style={{ margin: '0.4rem 0 0 1rem', lineHeight: 1.6 }}>
                  {ensayo.avisos.slice(0, 8).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                {/* Nunca callarse lo que no se enseña: una lista cortada en
                    silencio se lee como «esto es todo», y no lo es. */}
                {ensayo.avisos.length > 8 && (
                  <p className="form-hint" style={{ marginTop: '0.3rem' }}>
                    Y {ensayo.avisos.length - 8} avisos más.
                  </p>
                )}
              </div>
            </div>
          )}

          {ensayo.errores > 0 && (
            <div className="aviso-falta" role="note">
              <p className="aviso-falta__titulo">
                <span className="aviso-falta__marca" aria-hidden="true" />
                {ensayo.errores} {ensayo.errores === 1 ? 'fila no se puede importar' : 'filas no se pueden importar'}
              </p>
              <p className="aviso-falta__porque">
                El resto sí. Podéis importar ahora y corregir estas aparte, o arreglar el archivo y
                volver a empezar: lo que ya esté no se duplica.
              </p>
              <button
                type="button"
                className="aviso-falta__enlace"
                onClick={() =>
                  descargarArchivo(
                    `filas-con-problemas-${tabla.id}.csv`,
                    csvDeProblemas(ensayo, cabeceras),
                  )
                }
              >
                Descargar las filas con problemas →
              </button>
            </div>
          )}

          <h3 className="importar-tabla__titulo">Fila a fila</h3>
          <div className="table-card">
            <table>
              <thead>
                <tr><th>Fila</th><th>Qué es</th><th>Qué pasa</th></tr>
              </thead>
              <tbody>
                {ensayo.filas.slice(0, 200).map((f) => (
                  <tr key={f.linea}>
                    <td className="num">{f.linea}</td>
                    <td>
                      <span className="row-person__name">{f.titulo}</span>
                      <span className="row-person__sub">{f.sub}</span>
                    </td>
                    <td>
                      {f.queLePasa === 'nuevo' && <span className="pill pill--ok">Entra nuev{a}</span>}
                      {f.queLePasa === 'actualiza' && <span className="pill pill--warn">Ya está · se actualiza</span>}
                      {f.queLePasa === 'error' && (
                        <>
                          <span className="pill pill--err">No se importa</span>
                          <span className="importar-problema">{f.problemas.join('. ')}</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ensayo.filas.length > 200 && (
            <p className="form-hint">
              Se enseñan las 200 primeras de {ensayo.filas.length}. Se importarán todas.
            </p>
          )}
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {paso === 'hecho' && resultado && deshecho && (
        <p className="form-hint">
          <b>Importación deshecha.</b> Todo ha vuelto a estar como antes de subir el archivo.
          Podéis corregirlo y volver a intentarlo.
        </p>
      )}
      {paso === 'hecho' && resultado && !deshecho && (
        <>
          <p className="form-hint">
            <b>{cuantos(resultado.creados)} importad{a}{resultado.creados === 1 ? '' : 's'}</b>
            {resultado.actualizados > 0 && ` y ${resultado.actualizados} actualizad${a}${resultado.actualizados === 1 ? '' : 's'}`}.
          </p>
          {ensayo && ensayo.errores > 0 && (
            <p className="form-hint">
              Quedaron <b>{ensayo.errores}</b> filas sin importar. Corregidlas en el archivo que os
              habéis descargado y volvéis a subirlo: lo que ya está no se duplica.
            </p>
          )}
          <p className="form-hint">
            Si algo no ha salido como esperabais, podéis <b>deshacerlo</b> aquí abajo mientras esta
            ventana siga abierta.
          </p>
        </>
      )}
    </Drawer>
  )
}
