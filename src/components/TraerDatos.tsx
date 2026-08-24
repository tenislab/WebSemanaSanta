import { useMemo, useState } from 'react'
import ImportarCenso from './ImportarCenso'
import ImportarTabla from './ImportarTabla'
import { ExcelIlegible, leerLibro, pareceXlsx, type Hoja } from '../lib/leerExcel'
import { leerCsv, pareceBinario } from '../lib/leerTabla'
import { hojaQueCuadra, proponerColumnas, faltanColumnas, type CampoDeTabla } from '../lib/importarTabla'
import { hojaDelCenso, CAMPOS_IMPORTABLES, proponerEmparejado } from '../lib/importar'
import { TABLA_CUOTAS, TABLA_MOVIMIENTOS, TABLA_ENSERES } from '../lib/tablasImportables'
import { useContextoDeImportacion } from '../lib/contextoImportacion'
import { useSupabaseTable } from '../lib/supabaseSync'
import { CLAVES_DATOS } from '../lib/persistencia'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'
import { hermanoToRow, rowToHermano } from '../lib/db/hermanos'
import { CUOTAS_INICIALES, type Cuota } from '../data/cuotas'
import { cuotaToRow, rowToCuota } from '../lib/db/cuotas'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../data/movimientos'
import { movimientoToRow, rowToMovimiento } from '../lib/db/movimientos'
import { ENSERES_INICIALES, type Enser } from '../data/enseres'
import { enserToRow, rowToEnser } from '../lib/db/enseres'

/**
 * TRAER LOS DATOS DE LA HERMANDAD, TODOS DESDE EL MISMO SITIO.
 *
 * Antes había que ir pantalla por pantalla: el censo en Hermanos, los recibos
 * en Cuotas, el libro de caja en Tesorería y las piezas en Inventario. Cuatro
 * asistentes idénticos en cuatro sitios distintos, y el mismo archivo buscado
 * cuatro veces en la carpeta de descargas.
 *
 * Y es lo primero que hace una hermandad, el día que se da de alta, antes de
 * conocer la aplicación. Justo cuando menos sabe dónde está cada cosa.
 *
 * Aquí el archivo se sube UNA vez. Se mira qué trae dentro —un libro de Excel
 * con una pestaña por cosa es lo que sale de cualquier programa de gestión— y
 * se ofrece traer cada tabla por separado, cada una con su repaso.
 *
 * LO QUE NO SE HACE: importarlo todo de un botón. Sería un botón que mueve el
 * censo, el dinero y el patrimonio a la vez sin enseñar antes qué va a pasar,
 * y el paso de «esto es lo que va a pasar» es la razón por la que alguien se
 * atreve a pulsar. Se ahorra buscar el archivo cuatro veces, no el repaso.
 */

/** Las cuatro cosas que se pueden traer, en el orden en que hay que traerlas. */
type Cual = 'censo' | 'cuotas' | 'caja' | 'inventario'

interface LoQueSePuedeTraer {
  cual: Cual
  titulo: string
  /** Por qué va en este orden, cuando importa. */
  nota?: string
  /** La pestaña del libro de la que saldría, y cuántas filas trae. */
  hoja: Hoja | null
  filas: number
  /** Columnas obligatorias que no se han encontrado en esa pestaña. */
  faltan: string[]
}

export default function TraerDatos() {
  const [hermanos, setHermanos] = useSupabaseTable<Hermano>(
    'hermanos', CLAVES_DATOS.hermanos, HERMANOS_INICIALES, hermanoToRow, rowToHermano, 'numero',
  )
  const [cuotas, setCuotas] = useSupabaseTable<Cuota>(
    'cuotas', CLAVES_DATOS.cuotas, CUOTAS_INICIALES, cuotaToRow, rowToCuota,
  )
  const [movimientos, setMovimientos] = useSupabaseTable<Movimiento>(
    'movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES, movimientoToRow, rowToMovimiento,
  )
  const [enseres, setEnseres] = useSupabaseTable<Enser>(
    'enseres', CLAVES_DATOS.enseres, ENSERES_INICIALES, enserToRow, rowToEnser,
  )

  const [hojas, setHojas] = useState<Hoja[]>([])
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [errorArchivo, setErrorArchivo] = useState('')
  const [abierto, setAbierto] = useState<Cual | null>(null)

  /*
   * EL CENSO QUE VE EL ASISTENTE DE CUOTAS ES EL RECIÉN IMPORTADO.
   *
   * Se trae el censo, se trae después el historial, y los recibos enganchan
   * por DNI con los hermanos que acaban de entrar. Con un censo congelado al
   * montar la pantalla, el asistente diría «no hay ningún hermano con el DNI
   * …» en las mil filas, sobre un censo que sí está — y aquí las dos cosas
   * pasan seguidas, en la misma pantalla y sin recargar.
   */
  const ctx = useContextoDeImportacion(hermanos)

  async function elegirArchivo(f: File | null) {
    if (!f) return
    setErrorArchivo('')
    setHojas([])

    const bytes = new Uint8Array(await f.arrayBuffer())
    // Se mira el CONTENIDO y no la extensión: hay programas de gestión que
    // sueltan un .xlsx llamándolo .csv.
    if (pareceXlsx(bytes)) {
      try {
        setHojas(await leerLibro(bytes))
      } catch (e) {
        setErrorArchivo(
          e instanceof ExcelIlegible
            ? e.message
            : 'No se ha podido abrir el archivo de Excel. Guárdalo otra vez desde Excel y vuelve a subirlo.',
        )
        return
      }
      setNombreArchivo(f.name)
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
    const filas = leerCsv(texto)
    if (filas.length < 2) {
      setErrorArchivo('El archivo no tiene filas de datos, solo la cabecera (o está vacío).')
      return
    }
    // Un CSV es una tabla y ya está: se trata como un libro de una sola hoja
    // para que a partir de aquí todo sea igual.
    setHojas([{ nombre: f.name, filas }])
    setNombreArchivo(f.name)
  }

  /** Qué se puede sacar del archivo que se ha subido. */
  const sePuedeTraer: LoQueSePuedeTraer[] = useMemo(() => {
    if (hojas.length === 0) return []

    const deTabla = (cual: Cual, titulo: string, campos: CampoDeTabla[], nota?: string): LoQueSePuedeTraer => {
      const i = hojaQueCuadra(hojas, campos)
      const hoja = hojas[i]
      if (!hoja || hoja.filas.length < 2) return { cual, titulo, nota, hoja: null, filas: 0, faltan: [] }
      const emparejado = proponerColumnas(campos, hoja.filas[0])
      return {
        cual, titulo, nota, hoja,
        filas: hoja.filas.length - 1,
        faltan: faltanColumnas(campos, emparejado).map((c) => c.etiqueta ?? c.id),
      }
    }

    /*
     * El censo va por su propio emparejador y no por `deTabla`: conoce
     * sinónimos que el genérico no («Nº de cuenta» es un IBAN, «¿está de
     * baja?» significa lo contrario que activo…). Son los mismos que usa el
     * asistente de Hermanos, y tienen que serlo: si esta pantalla dijera «no
     * hay pestaña de censo» y la otra sí la encontrara, no se sabría a cuál
     * creer.
     */
    const iCenso = hojaDelCenso(hojas)
    const hojaCenso = hojas[iCenso]
    const empCenso = hojaCenso ? proponerEmparejado(hojaCenso.filas[0] ?? []) : null
    const faltanCenso = CAMPOS_IMPORTABLES
      .filter((c) => c.obligatorio && (empCenso?.[c.id] ?? null) === null)
      .map((c) => c.etiqueta)

    return [
      {
        cual: 'censo',
        titulo: 'El censo de hermanos',
        nota: 'Empezad por aquí: los recibos se enganchan a los hermanos por el DNI.',
        hoja: hojaCenso && hojaCenso.filas.length > 1 ? hojaCenso : null,
        filas: hojaCenso ? Math.max(0, hojaCenso.filas.length - 1) : 0,
        faltan: faltanCenso,
      },
      deTabla('cuotas', 'El historial de cuotas', TABLA_CUOTAS.campos, 'Después del censo, para que cada recibo encuentre a su hermano.'),
      deTabla('caja', 'El libro de caja', TABLA_MOVIMIENTOS.campos),
      deTabla('inventario', 'El inventario', TABLA_ENSERES.campos),
    ]
  }, [hojas])

  const cuantasHojas = hojas.length

  /*
   * EL ARCHIVO LEÍDO, MEMORIZADO.
   *
   * Escrito como objeto suelto en el JSX era uno NUEVO en cada pintado, y como
   * los asistentes lo tienen de dependencia, su efecto se disparaba sin parar.
   * Ellos ya se protegen mirando en qué paso están; esto es la otra mitad del
   * arreglo, y la que evita el trabajo inútil.
   */
  const libro = useMemo(() => ({ nombre: nombreArchivo, hojas }), [nombreArchivo, hojas])

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Traer vuestros datos</h2>
      </div>
      <p className="form-hint">
        El censo, el historial de cuotas, el libro de caja y el inventario que ya tenéis. Subid el
        archivo <b>una vez</b> y desde aquí se trae cada cosa, con su repaso antes de tocar nada.
      </p>
      <p className="form-hint">
        Vale un Excel (.xlsx) o un CSV. Si es un libro con varias pestañas —una por cosa, que es lo
        que suelta cualquier programa de gestión— se reconoce cada una por sus columnas.
      </p>

      <div className="importar-suelta">
        {/* Sin `accept` a propósito: con la lista de tipos puesta, el cuadro del
            sistema grisea archivos que sí valen y se lee como que la aplicación
            está rota. Ver el comentario largo en ImportarCenso. */}
        <input
          id="traerDatosArchivo"
          type="file"
          onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
        />
        <label htmlFor="traerDatosArchivo" className="btn btn-primary">
          {cuantasHojas > 0 ? 'Cambiar el archivo' : 'Elegir el archivo'}
        </label>
      </div>
      {nombreArchivo && cuantasHojas > 0 && (
        <p className="form-hint">
          <b>{nombreArchivo}</b> · {cuantasHojas} pestaña{cuantasHojas === 1 ? '' : 's'}:{' '}
          {hojas.map((h) => `«${h.nombre}» ${Math.max(0, h.filas.length - 1)}`).join(' · ')}
        </p>
      )}

      {errorArchivo && <p className="aviso-falta__error-suelto">{errorArchivo}</p>}

      {cuantasHojas > 0 && (
        <div className="importar-campos">
          {sePuedeTraer.map((x) => {
            const listo = x.hoja !== null && x.faltan.length === 0
            return (
              <div className="assign-box" key={x.cual}>
                <h4 className="assign-box__title">{x.titulo}</h4>
                {listo ? (
                  <p className="form-hint">
                    De la pestaña <b>«{x.hoja!.nombre}»</b>, {x.filas} fila{x.filas === 1 ? '' : 's'}.
                    {x.nota ? ` ${x.nota}` : ''}
                  </p>
                ) : (
                  /*
                   * DECIR QUÉ FALTA, y no solo que no se puede.
                   *
                   * «No se ha encontrado» sobre un archivo que la hermandad
                   * sabe que trae sus cuotas se lee como que la aplicación no
                   * sirve. Nombrando la columna que falta, se arregla en Excel
                   * en un minuto.
                   */
                  <p className="form-hint">
                    {x.hoja === null
                      ? 'No hay ninguna pestaña con estos datos en el archivo.'
                      : `Falta decir cuál es ${x.faltan.join(' y ')}. Se puede ajustar a mano al traerlo.`}
                  </p>
                )}
                <button
                  type="button"
                  className={listo ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                  disabled={x.hoja === null}
                  onClick={() => setAbierto(x.cual)}
                >
                  {listo ? 'Traer' : 'Repasar las columnas'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/*
        Los mismos asistentes de siempre, los de cada pantalla. Se les pasa el
        archivo ya leído para que empiecen en el paso de columnas: lo único que
        se salta es volver a buscarlo.
      */}
      <ImportarCenso
        abierto={abierto === 'censo'}
        onCerrar={() => setAbierto(null)}
        censo={hermanos}
        onImportar={setHermanos}
        libroInicial={abierto === 'censo' ? libro : null}
      />
      <ImportarTabla
        abierto={abierto === 'cuotas'}
        onCerrar={() => setAbierto(null)}
        tabla={TABLA_CUOTAS}
        existentes={cuotas}
        ctx={ctx}
        onImportar={setCuotas}
        libroInicial={abierto === 'cuotas' ? libro : null}
      />
      <ImportarTabla
        abierto={abierto === 'caja'}
        onCerrar={() => setAbierto(null)}
        tabla={TABLA_MOVIMIENTOS}
        existentes={movimientos}
        ctx={ctx}
        onImportar={setMovimientos}
        libroInicial={abierto === 'caja' ? libro : null}
      />
      <ImportarTabla
        abierto={abierto === 'inventario'}
        onCerrar={() => setAbierto(null)}
        tabla={TABLA_ENSERES}
        existentes={enseres}
        ctx={ctx}
        onImportar={setEnseres}
        libroInicial={abierto === 'inventario' ? libro : null}
      />
    </section>
  )
}
