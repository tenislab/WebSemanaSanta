import { useMemo, useRef, useState } from 'react'
import Drawer from './Drawer'
import { descargarArchivo } from '../lib/csv'
import { nuevoId } from '../lib/supabaseSync'
import {
  CAMPOS_IMPORTABLES, aplicar, csvDeErrores, ensayar, leerCsv, pareceBinario, pareceExcel,
  proponerEmparejado, type CampoImportable, type Ensayo,
} from '../lib/importar'
import type { Hermano } from '../data/hermanos'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Traer el censo que la hermandad ya tiene. En cuatro pasos, y **el tercero es
 * el importante**: antes de tocar nada se enseña qué va a pasar exactamente,
 * fila a fila. Importar mil hermanos mal y no poder deshacerlo es un desastre
 * del que no se sale, así que aquí no se aplica nada sin que alguien lo haya
 * visto y lo confirme.
 */
type Paso = 'archivo' | 'columnas' | 'ensayo' | 'hecho'

export default function ImportarCenso({
  abierto, onCerrar, censo, onImportar,
}: {
  abierto: boolean
  onCerrar: () => void
  censo: Hermano[]
  /** Recibe el censo resultante. Guardar es cosa de quien lo usa, con el mecanismo de siempre. */
  onImportar: (censo: Hermano[]) => void
}) {
  const [paso, setPaso] = useState<Paso>('archivo')
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [filas, setFilas] = useState<string[][]>([])
  const [emparejado, setEmparejado] = useState<Record<CampoImportable, number | null>>(
    () => proponerEmparejado([]),
  )
  const [conLosQueYaEstan, setConLosQueYaEstan] = useState<'actualizar' | 'saltar'>('actualizar')
  const [clave, setClave] = useState('cabildo2026')
  const [resultado, setResultado] = useState<{ creados: number; actualizados: number } | null>(null)
  /**
   * El censo tal y como estaba justo antes de importar. Traer mil fichas y no
   * poder volver atrás es el miedo que impide pulsar el botón; con esto se
   * deshace de un clic mientras el panel siga abierto.
   */
  const [censoAnterior, setCensoAnterior] = useState<Hermano[] | null>(null)
  const [deshecho, setDeshecho] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const cabeceras = filas[0] ?? []
  const ensayo: Ensayo | null = useMemo(
    () => (filas.length > 1 ? ensayar(filas, emparejado, censo) : null),
    [filas, emparejado, censo],
  )
  const faltanObligatorios = CAMPOS_IMPORTABLES.filter((c) => c.obligatorio && emparejado[c.id] === null)

  function reiniciar() {
    setPaso('archivo'); setFilas([]); setNombreArchivo(''); setResultado(null); setErrorArchivo('')
    setCensoAnterior(null); setDeshecho(false)
  }

  async function elegirArchivo(f: File | null) {
    if (!f) return
    setErrorArchivo('')
    const texto = await f.text()
    // Lo primero, decirle lo único que necesita saber si ha subido su hoja tal
    // cual. El error de «columnas raras» no ayudaba a nadie.
    if (pareceExcel(texto)) {
      setErrorArchivo(
        'Esto es un archivo de Excel (.xlsx). Ábrelo en Excel y usa Archivo → Guardar como → CSV (delimitado por punto y coma). Luego sube ese archivo.',
      )
      return
    }
    if (pareceBinario(texto)) {
      setErrorArchivo('Este archivo no es texto. Guárdalo como CSV desde el programa donde tengáis el censo.')
      return
    }
    const leidas = leerCsv(texto)
    if (leidas.length < 2) {
      setErrorArchivo('El archivo no tiene filas de datos, solo la cabecera (o está vacío).')
      return
    }
    setNombreArchivo(f.name)
    setFilas(leidas)
    setEmparejado(proponerEmparejado(leidas[0]))
    setPaso('columnas')
  }

  function confirmar() {
    if (!ensayo) return
    setCensoAnterior(censo)
    const r = aplicar(ensayo, censo, { conLosQueYaEstan, clavePorDefecto: clave }, nuevoId)
    onImportar(r.censo)
    setResultado({ creados: r.creados, actualizados: r.actualizados })
    setDeshecho(false)
    setPaso('hecho')
  }

  function deshacer() {
    if (!censoAnterior) return
    onImportar(censoAnterior)
    setDeshecho(true)
  }

  const titulos: Record<Paso, string> = {
    archivo: 'Traer vuestro censo',
    columnas: 'Qué es cada columna',
    ensayo: 'Esto es lo que va a pasar',
    hecho: 'Censo importado',
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
              disabled={faltanObligatorios.length > 0}
              onClick={() => setPaso('ensayo')}
            >
              {faltanObligatorios.length > 0
                ? `Falta decir cuál es ${faltanObligatorios.map((c) => c.etiqueta.toLowerCase()).join(' y ')}`
                : 'Ver qué va a pasar'}
            </button>
          )}
          {paso === 'ensayo' && ensayo && (
            <>
              <button
                className="btn btn-primary"
                disabled={ensayo.nuevos + ensayo.actualizados === 0}
                onClick={confirmar}
              >
                {ensayo.nuevos + ensayo.actualizados === 0
                  ? 'No hay nada que importar'
                  : `Importar ${ensayo.nuevos + (conLosQueYaEstan === 'actualizar' ? ensayo.actualizados : 0)} hermanos`}
              </button>
              <button className="btn btn-ghost" onClick={() => setPaso('columnas')}>Volver a las columnas</button>
            </>
          )}
          {paso === 'hecho' && (
            <>
              <button className="btn btn-primary" onClick={() => { onCerrar(); reiniciar() }}>Cerrar</button>
              {censoAnterior && !deshecho && (
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
          <p className="form-hint">
            Lo que tiene una hermandad casi nunca es una base de datos: es un Excel o un listado de
            un programa antiguo. Guardadlo como <b>CSV</b> (en Excel: Archivo → Guardar como → CSV)
            y subidlo aquí. No se toca nada hasta que veáis qué va a pasar y lo confirméis.
          </p>
          <div className="importar-suelta">
            <input
              ref={inputRef} id="importarArchivo" type="file" accept=".csv,text/csv,text/plain"
              onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="importarArchivo" className="btn btn-primary">Elegir el archivo</label>
          </div>
          {errorArchivo && <p className="aviso-falta__error-suelto">{errorArchivo}</p>}
          <details className="afinar">
            <summary>
              <span className="afinar__titulo">¿Qué columnas hacen falta?</span>
              <span className="afinar__nota">Nombre y DNI</span>
            </summary>
            <p className="form-hint">
              Solo dos son imprescindibles: <b>nombre</b> y <b>DNI</b>. El DNI es lo que identifica a
              cada hermano, y sin él no se pueden detectar los repetidos. Todo lo demás (número,
              antigüedad, correo, teléfono, dirección, cuenta) es bienvenido pero opcional.
            </p>
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
            Hemos reconocido lo que hemos podido por el nombre de la columna. <b>Repasadlo</b>: si
            aquí se cuela el teléfono en la casilla del DNI, se importan mil fichas mal.
          </p>
          <div className="importar-campos">
            {CAMPOS_IMPORTABLES.map((c) => (
              <div className="form-row" key={c.id}>
                <label htmlFor={`col-${c.id}`}>
                  {c.etiqueta}
                  {c.obligatorio && <span className="importar-obligatorio"> · imprescindible</span>}
                </label>
                <select
                  id={`col-${c.id}`}
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
                {emparejado[c.id] !== null && filas[1] && (
                  <p className="importar-ejemplo">
                    En vuestro archivo: <b>{filas[1][emparejado[c.id] as number] || '(vacío)'}</b>
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {paso === 'ensayo' && ensayo && (
        <>
          <div className="importar-resumen">
            <div className="importar-cifra importar-cifra--ok">
              <strong>{ensayo.nuevos}</strong><span>se dan de alta</span>
            </div>
            <div className="importar-cifra">
              <strong>{ensayo.actualizados}</strong><span>ya están en el censo</span>
            </div>
            <div className={`importar-cifra${ensayo.errores > 0 ? ' importar-cifra--mal' : ''}`}>
              <strong>{ensayo.errores}</strong><span>no se pueden importar</span>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="impYaEstan">Con los que ya están en el censo</label>
            <select
              id="impYaEstan" value={conLosQueYaEstan}
              onChange={(e) => setConLosQueYaEstan(e.target.value as 'actualizar' | 'saltar')}
            >
              <option value="actualizar">Actualizar sus datos con los del archivo</option>
              <option value="saltar">Dejarlos como están</option>
            </select>
            <p className="form-hint">
              Al actualizar solo se pisa lo que trae el archivo: si vuestra hoja no tiene columna de
              teléfono, el teléfono que ya tengan en Cabildo no se borra. Su número de hermano
              tampoco se toca.
            </p>
          </div>

          {/* Con Supabase conectado, el acceso del hermano va por cuentas de
              verdad, y esto NO las crea: no se pueden dar de alta mil cuentas
              desde el navegador (ni las que no tienen correo, que son muchas).
              Decirlo aquí evita prometer un acceso que no va a funcionar. */}
          {isSupabaseConfigured && (
            <div className="aviso-falta" role="note">
              <p className="aviso-falta__titulo">
                <span className="aviso-falta__marca" aria-hidden="true" />
                Entrarán en el censo, pero todavía no en su área
              </p>
              <p className="aviso-falta__porque">
                Con la base de datos conectada, el área del hermano usa cuentas de acceso reales, y
                estas no se pueden crear a miles desde aquí (y quien no tenga correo no puede tener
                cuenta). Los hermanos quedan en el censo con todos sus datos, y la secretaría les va
                dando acceso desde su ficha cuando haga falta.
              </p>
            </div>
          )}
          <div className="form-row">
            <label htmlFor="impClave">Contraseña inicial para los que entren nuevos</label>
            <input id="impClave" type="text" value={clave} onChange={(e) => setClave(e.target.value)} />
            <p className="form-hint">
              Con ella entrarán en su área por primera vez, usando su DNI. Decídsela cuando les
              aviséis de que ya pueden entrar.
            </p>
          </div>

          {ensayo.errores > 0 && (
            <div className="aviso-falta" role="note">
              <p className="aviso-falta__titulo">
                <span className="aviso-falta__marca" aria-hidden="true" />
                {ensayo.errores} {ensayo.errores === 1 ? 'fila no se puede importar' : 'filas no se pueden importar'}
              </p>
              {/* El dato que más desconcierta: «¿por qué no entran si están
                  bien?». Porque el mismo DNI aparece dos veces en su hoja. */}
              {ensayo.duplicadosEnArchivo.length > 0 && (
                <p className="aviso-falta__porque">
                  <b>
                    {ensayo.duplicadosEnArchivo.length === 1
                      ? 'Un DNI está repetido'
                      : `${ensayo.duplicadosEnArchivo.length} DNI están repetidos`}
                  </b>{' '}
                  dentro de vuestro propio archivo. Esas filas se quedan fuera las dos: hay que
                  mirarlas para saber cuál vale.
                </p>
              )}
              <p className="aviso-falta__porque">
                El resto sí. Podéis importar ahora y corregir estas aparte, o arreglar el archivo y
                volver a empezar.
              </p>
              <button
                type="button"
                className="aviso-falta__enlace"
                onClick={() =>
                  descargarArchivo(`filas-con-problemas-${nombreArchivo || 'censo'}.csv`, csvDeErrores(ensayo, cabeceras))
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
                <tr><th>Fila</th><th>Hermano</th><th>Qué pasa</th></tr>
              </thead>
              <tbody>
                {ensayo.filas.slice(0, 200).map((f) => (
                  <tr key={f.linea}>
                    <td className="num">{f.linea}</td>
                    <td>
                      <span className="row-person__name">{f.datos.nombre || '(sin nombre)'}</span>
                      <span className="row-person__sub">{f.datos.dni || '(sin DNI)'}</span>
                    </td>
                    <td>
                      {f.queLePasa === 'nuevo' && <span className="pill pill--ok">Se da de alta</span>}
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
          {/* Nunca callarse lo que no se enseña: una tabla cortada en silencio
              se lee como «esto es todo», y no lo es. */}
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
          <b>Importación deshecha.</b> El censo ha vuelto a estar como antes de subir el archivo.
          Puedes corregirlo y volver a intentarlo.
        </p>
      )}
      {paso === 'hecho' && resultado && !deshecho && (
        <>
          <p className="form-hint">
            <b>{resultado.creados} hermanos dados de alta</b>
            {resultado.actualizados > 0 && ` y ${resultado.actualizados} actualizados`}.
          </p>
          <p className="form-hint">
            Ya están en el censo con su número. Lo siguiente que suele hacerse es emitir la cuota del
            ejercicio desde Cuotas, y avisarles de que pueden entrar en su área con su DNI y la
            contraseña que habéis puesto.
          </p>
          {ensayo && ensayo.errores > 0 && (
            <p className="form-hint">
              Quedaron <b>{ensayo.errores}</b> filas sin importar. Corregidlas en el archivo que os
              habéis descargado y volvéis a subirlo: los que ya estén no se duplican.
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
