import { useEffect, useMemo, useRef, useState } from 'react'
import Drawer from './Drawer'
import { descargarArchivo } from '../lib/csv'
import { nuevoId } from '../lib/supabaseSync'
import { leerCsv, pareceBinario, textoDelArchivo } from '../lib/leerTabla'
import {
  aplicarTabla, csvDeProblemas, ensayarTabla, faltanColumnas, hojaQueCuadra, proponerColumnas, sinPreambulo,
  type ContextoDeTabla, type Emparejado, type EnsayoDeTabla, type TablaImportable,
} from '../lib/importarTabla'
import { ExcelIlegible, leerLibro, pareceXlsx, type Hoja } from '../lib/leerExcel'

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
  abierto, onCerrar, tabla, existentes, ctx, onImportar, libroInicial,
}: {
  abierto: boolean
  onCerrar: () => void
  tabla: TablaImportable<T>
  existentes: T[]
  ctx: ContextoDeTabla
  /** Recibe la lista resultante. Guardar es cosa de quien lo usa, con el mecanismo de siempre. */
  onImportar: (lista: T[]) => void
  /**
   * UN ARCHIVO YA LEÍDO, para no volver a pedirlo.
   *
   * Lo usa «Traer vuestros datos» (Ajustes): allí se sube el libro UNA vez y
   * desde ahí se traen las cuatro tablas. Pedir el mismo archivo cuatro veces
   * —una por pantalla, buscándolo cada vez en la carpeta de descargas— es el
   * paso donde una hermandad se cansa y lo deja.
   *
   * Solo se salta el paso de elegir archivo. Los otros tres siguen enteros, y
   * el tercero —«esto es lo que va a pasar»— es el que no se puede tocar: aquí
   * se traen recibos y patrimonio.
   */
  libroInicial?: { nombre: string; hojas: Hoja[] } | null
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
  /**
   * Las pestañas del libro, cuando trae más de una. Se guardan para poder
   * cambiar de hoja sin volver a subir el archivo: la elegida se acierta casi
   * siempre, pero «casi» no vale cuando el libro trae las cuotas de 2025 y las
   * de 2026 en dos pestañas con las mismas columnas.
   */
  const [hojas, setHojas] = useState<Hoja[]>([])
  const [hojaElegida, setHojaElegida] = useState(0)
  /*
   * Cuántas filas de encabezado se han dejado arriba: el título de la hoja, la
   * fecha del listado, la línea en blanco. Se guardan para poder seguir
   * diciendo «la línea 47» refiriéndose a la 47 de SU archivo.
   */
  const [saltadas, setSaltadas] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  /*
   * ARRANCAR CON UN ARCHIVO YA LEÍDO.
   *
   * Se salta el paso de elegir archivo y se entra directamente en el de
   * columnas, con la pestaña que cuadra. El cuerpo va aquí dentro y no llama a
   * `empezarCon` a propósito: esa función se crea nueva en cada pintado, y
   * como dependencia del efecto lo dispararía en bucle.
   */
  useEffect(() => {
    if (!abierto || !libroInicial) return
    /*
     * SOLO DESDE EL PRINCIPIO, y esto no es una precaución de más.
     *
     * Sin esta línea, el efecto devolvía al paso de columnas CADA VEZ que se
     * repintaba el panel de quien lo abre. Y se repinta justo en el peor
     * momento: al terminar de importar, porque la lista nueva entra en su
     * estado. Se veía «ya está importado» un instante y aparecía otra vez el
     * emparejador de columnas, como si no se hubiera guardado nada.
     */
    if (paso !== 'archivo') return
    const cual = hojaQueCuadra(libroInicial.hojas, tabla.campos)
    const hoja = libroInicial.hojas[cual]
    if (!hoja || hoja.filas.length < 2) return
    const corte = sinPreambulo(hoja.filas, tabla.campos)
    setHojas(libroInicial.hojas)
    setHojaElegida(cual)
    setNombreArchivo(libroInicial.nombre)
    setFilas(corte.filas)
    setSaltadas(corte.saltadas)
    setEmparejado(proponerColumnas(tabla.campos, corte.filas[0]))
    setPaso('columnas')
  }, [abierto, libroInicial, tabla, paso])

  const cabeceras = filas[0] ?? []
  const ensayo: EnsayoDeTabla<T> | null = useMemo(
    () => (filas.length > 1 ? ensayarTabla(filas, emparejado, existentes, tabla, ctx, saltadas) : null),
    [filas, emparejado, existentes, tabla, ctx, saltadas],
  )
  const faltan = faltanColumnas(tabla.campos, emparejado)
  const otroMotivo = filas.length > 1 ? (tabla.faltaAlgo?.(emparejado) ?? null) : null

  function reiniciar() {
    setPaso('archivo'); setFilas([]); setNombreArchivo(''); setResultado(null); setErrorArchivo('')
    setListaAnterior(null); setDeshecho(false); setEmparejado({})
    setHojas([]); setHojaElegida(0); setSaltadas(0)
  }

  async function elegirArchivo(f: File | null) {
    if (!f) return
    setErrorArchivo('')

    // El Excel se LEE, no se manda convertir: ver el comentario largo en
    // ImportarCenso.tsx. Y se mira el CONTENIDO, no la extensión.
    const bytes = new Uint8Array(await f.arrayBuffer())
    if (pareceXlsx(bytes)) {
      let libro: Hoja[]
      try {
        libro = await leerLibro(bytes)
      } catch (e) {
        setErrorArchivo(
          e instanceof ExcelIlegible
            ? e.message
            : 'No se ha podido abrir el archivo de Excel. Guárdalo otra vez desde Excel y vuelve a subirlo.',
        )
        return
      }
      /*
       * LA PESTAÑA SE ELIGE POR LAS COLUMNAS, no por ser la primera.
       *
       * Una hermandad saca UN libro de su programa viejo —censo, cuotas y caja,
       * cada cosa en su pestaña— y lo sube cuatro veces, una por pantalla.
       * Leyendo siempre la primera hoja, importar cuotas desde ese libro decía
       * «faltan columnas obligatorias» mientras miraba el censo, y no había
       * manera de saber por qué: el archivo era el bueno.
       */
      const cual = hojaQueCuadra(libro, tabla.campos)
      if (libro[cual].filas.length < 2) {
        setErrorArchivo(
          libro.length === 1
            ? 'La hoja del Excel no tiene filas de datos, solo la cabecera (o está vacía).'
            : 'Ninguna de las hojas del Excel tiene filas de datos, solo cabeceras.',
        )
        return
      }
      setHojas(libro)
      setHojaElegida(cual)
      empezarCon(libro[cual].filas, f.name)
      return
    }

    const texto = textoDelArchivo(bytes)
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

  /** Cambiar de pestaña sin volver a subir el archivo. */
  function cambiarDeHoja(i: number) {
    const corte = sinPreambulo(hojas[i].filas, tabla.campos)
    setHojaElegida(i)
    setFilas(corte.filas)
    setSaltadas(corte.saltadas)
    setEmparejado(proponerColumnas(tabla.campos, corte.filas[0] ?? []))
  }

  /**
   * Ya tenemos las filas, vengan del Excel o del CSV: el resto es igual.
   *
   * Aquí se corta el encabezado de la hoja. La cabecera casi nunca es la
   * primera fila en un archivo de hermandad —encima suele haber un título y la
   * fecha del listado— y suponerlo dejaba la pantalla diciendo «— no está en el
   * archivo —» en todas las columnas, con el archivo bueno delante.
   */
  function empezarCon(leidas: string[][], nombre: string) {
    const corte = sinPreambulo(leidas, tabla.campos)
    setNombreArchivo(nombre)
    setFilas(corte.filas)
    setSaltadas(corte.saltadas)
    setEmparejado(proponerColumnas(tabla.campos, corte.filas[0]))
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
          {/*
            EL LIBRO TRAE VARIAS PESTAÑAS Y HEMOS ELEGIDO UNA. Se dice cuál, y
            se deja cambiarla: acertar por las columnas falla justo cuando dos
            pestañas tienen las mismas —las cuotas de 2025 y las de 2026—, y
            ahí solo lo sabe quien hizo el archivo.
          */}
          {hojas.length > 1 && (
            <div className="form-row">
              <label htmlFor={`hoja-${tabla.id}`}>Pestaña del Excel</label>
              <select
                id={`hoja-${tabla.id}`}
                value={hojaElegida}
                onChange={(e) => cambiarDeHoja(Number(e.target.value))}
              >
                {hojas.map((h, i) => (
                  <option key={h.nombre + i} value={i}>
                    {h.nombre} · {Math.max(0, h.filas.length - 1)} fila
                    {h.filas.length - 1 === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
              <p className="form-hint">
                El archivo trae {hojas.length} pestañas y hemos cogido «{hojas[hojaElegida]?.nombre}»
                porque es la que tiene estas columnas. Si no es esa, cambiadla aquí.
              </p>
            </div>
          )}
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
