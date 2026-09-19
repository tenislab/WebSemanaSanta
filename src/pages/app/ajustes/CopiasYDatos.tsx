import { COPIAS_QUE_SE_GUARDAN, SIN_SABER, diasDesde, estadoDeLasCopias, type EstadoDeLasCopias } from '../../../lib/copiaAutomatica'
import { MINIMO_CONTRASENA, abrirCopiaCifrada, cifrarYComprobar, esCopiaCifrada, revisarContrasena } from '../../../lib/copiaCifrada'
import { crearCopia, esCopiaValida, restaurarCopia, resumirCopia, sePuedeRestaurar } from '../../../lib/backup'
import { descargarArchivo } from '../../../lib/csv'
import { formatDate } from '../../../lib/format'
import { hoyIso } from '../../../lib/hoy'
import { restablecerDatosDeEjemplo } from '../../../lib/persistencia'
import { sePuedeVolcarEnLaBase, volcarCopiaEnLaBase } from '../../../lib/restaurar'
import { type ChangeEvent } from 'react'

/**
 * LAS COPIAS Y LOS DATOS.
 *
 * Descargar la copia de la hermandad —cifrada, con contraseña— y volver a
 * meterla. Es lo que más cuidado lleva de toda la pantalla, porque lo que se
 * descarga es el censo entero: nombres, direcciones, DNI e IBAN.
 *
 * LA CONTRASEÑA SE PIDE DOS VECES, y es lo que más veces va a salvar a alguien
 * de todo esto: una errata no se descubre al descargar —el archivo sale igual
 * de bien— sino el día que hace falta abrirlo, que es el peor día posible y
 * sin remedio.
 *
 * Y SE COMPROBA QUE DESCIFRA ANTES DE ENTREGARLA (`cifrarYComprobar`, no
 * `cifrar` a secas). Una copia que no se puede abrir es peor que no tener
 * copia: la hermandad cree que la tiene y lo descubre cuando hace falta.
 *
 * DOS PROPS: si la sección está abierta, y los ajustes de la hermandad, de
 * donde salen el nombre legal y el resto de lo que va en la copia.
 */
import { useEffect, useRef, useState } from 'react'
import type { HermandadSettings } from '../../../lib/hermandadSettings'

export default function CopiasYDatos({ abierta, settings }: {
  abierta: boolean
  settings: HermandadSettings
}) {
  const [copiaEstado, setCopiaEstado] = useState<string | null>(null)
  // Cómo están las copias automáticas. Se pregunta al cubo, que es la única
  // verdad: una marca guardada aparte puede decir que hay copia cuando el
  // archivo no llegó a subir.
  const [copias, setCopias] = useState<EstadoDeLasCopias>(SIN_SABER)
  useEffect(() => { void estadoDeLasCopias().then(setCopias) }, [])
  const backupRef = useRef<HTMLInputElement>(null)

  /*
   * ==========================================================================
   * LA CONTRASEÑA DE LA COPIA
   * ==========================================================================
   *
   * Se pide DOS VECES, y es lo que más veces va a salvar a alguien de todo
   * esto: una errata no se descubre al descargar —el archivo sale igual de
   * bien— sino el día que hace falta abrirlo, que es el peor día posible y ya
   * sin remedio.
   *
   * Y se avisa con todas las letras antes: una copia cifrada cuya contraseña
   * se pierde no la abre nadie, tampoco nosotros. Eso hay que decirlo antes y
   * no en la letra pequeña, porque cambia una amenaza por otra.
   */
  const [pidiendoClave, setPidiendoClave] = useState(false)
  const [clave, setClave] = useState('')
  const [claveRepetida, setClaveRepetida] = useState('')
  const revisionClave = revisarContrasena(clave, claveRepetida)

  async function descargarCopia(contrasena?: string) {
    setCopiaEstado('Preparando la copia…')
    try {
      const copia = await crearCopia()
      const fecha = hoyIso()
      const slug = (settings.nombreLegal || 'hermandad').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (contrasena) {
        /*
         * SE COMPRUEBA QUE DESCIFRA ANTES DE DARLA. Una copia que no se puede
         * abrir es peor que no tener copia: la hermandad cree que la tiene y
         * lo descubre el día que hace falta.
         */
        const r = await cifrarYComprobar(JSON.stringify(copia), contrasena, {
          hermandad: settings.nombreLegal || 'Hermandad',
          fecha,
        })
        if ('error' in r) {
          setCopiaEstado(r.error)
          setTimeout(() => setCopiaEstado(null), 12000)
          return
        }
        /*
         * OTRA EXTENSIÓN, y no es cosmético: `.json` invita a abrirlo con
         * cualquier cosa y a que alguien lo dé por corrupto al ver que no se
         * entiende. `.gobergo` dice que hace falta la aplicación.
         */
        descargarArchivo(
          `copia-cabildo-${slug}-${fecha}.gobergo`,
          JSON.stringify(r.copia),
          'application/octet-stream',
        )
        setPidiendoClave(false)
        setClave('')
        setClaveRepetida('')
        setCopiaEstado('Copia cifrada descargada. Guarda la contraseña: sin ella no se puede abrir.')
        setTimeout(() => setCopiaEstado(null), 9000)
        return
      }
      descargarArchivo(`copia-cabildo-${slug}-${fecha}.json`, JSON.stringify(copia), 'application/json;charset=utf-8;')
      // Si alguna tabla no se pudo traer, se dice. Una copia a la que le falta
      // algo y no lo cuenta se descubre el día que hace falta, que ya es tarde.
      const fallos = copia.fallos ?? []
      setCopiaEstado(
        fallos.length > 0
          ? `Copia descargada, pero NO se pudo traer: ${fallos.join(', ')}. Vuelve a intentarlo.`
          : 'Copia descargada.',
      )
    } catch {
      setCopiaEstado('No se pudo crear la copia.')
    }
    setTimeout(() => setCopiaEstado(null), 4000)
  }

  async function restaurarDesdeArchivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCopiaEstado('Leyendo la copia…')
    try {
      let texto = await file.text()
      let obj = JSON.parse(texto)
      /*
       * SI VIENE CIFRADA, SE PIDE LA CONTRASEÑA.
       *
       * Y se reconoce por su marca, no por la extensión: quien renombre el
       * archivo —que pasa— se encontraría si no con «esto no es una copia de
       * Gobergo», que es mentira y le manda a buscar el problema donde no está.
       */
      if (esCopiaCifrada(obj)) {
        const deQuien = obj.hermandad ? ` de ${obj.hermandad}` : ''
        const deCuando = obj.fecha ? ` del ${obj.fecha}` : ''
        const dicha = window.prompt(
          `Esta copia${deQuien}${deCuando} está cifrada.\n\n`
          + 'Escribe la contraseña con la que se descargó:',
        )
        if (dicha === null) {                    // le dio a cancelar
          setCopiaEstado(null)
          return
        }
        const claro = await abrirCopiaCifrada(obj, dicha)
        /*
         * Y SI NO ES, SE DICE POR SU NOMBRE. «Archivo no válido» aquí sería
         * cruel y falso: el archivo está perfectamente, lo que falla es la
         * contraseña, y hay que decirlo para que se vuelva a intentar en vez
         * de dar la copia por perdida.
         */
        if (claro === null) {
          setCopiaEstado(
            'Esa contraseña no abre la copia. El archivo está bien; vuelve a intentarlo. '
            + 'Si no la recuerdas, esta copia no se puede abrir: no hay forma de recuperarla.',
          )
          setTimeout(() => setCopiaEstado(null), 12000)
          return
        }
        texto = claro
        obj = JSON.parse(claro)
      }
      if (!esCopiaValida(obj)) {
        setCopiaEstado('El archivo no es una copia de Gobergo válida.')
        setTimeout(() => setCopiaEstado(null), 4000)
        return
      }
      // Se pregunta DESPUÉS de leerla, con lo que trae delante: antes se
      // confirmaba a ciegas, sin saber siquiera de qué día era la copia.
      const r = resumirCopia(obj)
      if (r.masNueva) {
        setCopiaEstado(
          'Esta copia la hizo una versión de Gobergo más nueva que la que tenéis. Restaurarla podría perder datos: actualizad Gobergo antes.',
        )
        setTimeout(() => setCopiaEstado(null), 9000)
        return
      }
      const cuando = r.fecha ? `del ${r.fecha}` : 'sin fecha'
      const trae = `${r.bloques} bloques de datos${r.archivos > 0 ? ` y ${r.archivos} archivos adjuntos` : ''}`
      if (!window.confirm(
        `Vas a restaurar una copia ${cuando}, con ${trae}.\n\n` +
        'Esto sustituirá TODOS los datos actuales de la hermandad por los del archivo.\n\n' +
        (sePuedeRestaurar()
          ? '¿Continuar?'
          : 'Se borrarán de la base de datos los hermanos, cuotas, papeletas, tesorería y todo lo '
            + 'demás, y se meterán los del archivo en su lugar. Antes se te descargará una copia de '
            + 'lo que hay ahora, por si acaso.\n\n¿Continuar?'),
      )) {
        setCopiaEstado(null)
        return
      }
      /*
       * DOS CAMINOS, Y NO SON INTERCAMBIABLES.
       *
       * · SIN base de datos (demostración, o Supabase sin configurar): se
       *   restaura en el navegador, que es donde viven los datos. Es lo que
       *   había desde siempre.
       *
       * · CON base de datos: hay que vaciar y volver a llenar las TABLAS.
       *   Escribir en el navegador no restaura nada — la base lo machaca al
       *   recargar—, y por eso este botón estuvo desactivado tanto tiempo. El
       *   detalle entero está en `lib/restaurar.ts`.
       */
      if (sePuedeRestaurar()) {
        setCopiaEstado('Restaurando…')
        await restaurarCopia(obj)
        setCopiaEstado('Copia restaurada. Recargando…')
        setTimeout(() => window.location.reload(), 800)
        return
      }

      /*
       * ANTES DE BORRAR NADA, UNA COPIA DE LO QUE HAY. Y SI FALLA, NO SE SIGUE.
       *
       * Este es el paso que no se puede saltar. Restaurar es exactamente el
       * momento en el que alguien puede haberse equivocado de archivo, y sin
       * esto no habría marcha atrás de la marcha atrás: los datos de hoy
       * habrían desaparecido para siempre entre el vaciado y el llenado.
       *
       * Se descarga al disco de quien lo lanza, no al cubo de copias: hace
       * falta que exista AUNQUE la base de datos sea justo lo que está
       * fallando.
       */
      setCopiaEstado('Guardando antes una copia de lo que hay ahora…')
      const antes = await crearCopia()
      const marca = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      descargarArchivo(
        `antes-de-restaurar-${marca}.json`,
        JSON.stringify(antes),
        'application/json;charset=utf-8;',
      )

      setCopiaEstado('Volcando la copia en la base de datos…')
      const r2 = await volcarCopiaEnLaBase(obj)
      const total = Object.values(r2.metidas).reduce((a, b) => a + b, 0)
      if (r2.fallos.length > 0) {
        /*
         * No se recarga cuando algo ha fallado: el mensaje es lo único que dice
         * QUÉ tabla se ha quedado fuera, y recargar se lo llevaría por delante.
         */
        setCopiaEstado(
          `Restauración incompleta: han entrado ${total} filas, pero ha fallado ${r2.fallos.join(' · ')}. `
          + 'Tienes en Descargas el archivo «antes-de-restaurar»: no lo borres.',
        )
        return
      }
      setCopiaEstado(`Copia restaurada: ${total} filas. Recargando…`)
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      // El mensaje de la restauración explica qué ha pasado y si se ha
      // cambiado algo; genérico solo si el archivo ni siquiera se pudo leer.
      setCopiaEstado(e instanceof Error && e.message ? e.message : 'No se pudo leer el archivo.')
      setTimeout(() => setCopiaEstado(null), 7000)
    }
  }

  if (!abierta) return null
  return (
      <>
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Copia de seguridad</h2>
      </div>
      <p className="form-hint">
        {sePuedeRestaurar()
          ? 'Todos los datos viven en este navegador. Descarga una copia (un solo archivo, con hermanos, cuotas, papeletas, tesorería, documentos y sus adjuntos) para no perderla al cambiar de ordenador o limpiar el navegador, y restáurala en otro equipo cuando quieras.'
          : 'Descarga un archivo con todo lo que tenéis en la base de datos —hermanos, cuotas, papeletas, tesorería, documentos y sus adjuntos— para guardarlo fuera. Si al traer algo falla, se dice aquí mismo.'}
      </p>
      {/* Con base de datos conectada, restaurar desde aquí no restaura: se
          escribiría en el navegador y la base de datos lo sobreescribiría al
          recargar. Antes el botón estaba, decía «Copia restaurada» y no
          había hecho nada. */}
      {/*
        Aquí ponía «Restaurar está desactivado», y era verdad: restaurar
        escribía en el navegador y la base de datos lo machacaba al recargar,
        así que el botón salía apagado antes que mentir.

        Ya no. Ahora se vacía la hermandad en la base y se vuelven a meter sus
        filas (`lib/restaurar.ts` y `supabase/restaurar-copia.sql`). Lo que se
        dice aquí es lo que hay que saber ANTES de pulsarlo, que es distinto
        de lo que se dice al confirmar: esto se lee sin prisa, aquello se lee
        con el dedo encima.
      */}
      {!sePuedeRestaurar() && sePuedeVolcarEnLaBase() && (
        <p className="form-hint form-hint--alerta">
          <b>Restaurar sustituye lo que hay en la base de datos</b>, no solo en este navegador:
          borra los hermanos, cuotas, papeletas y tesorería de la hermandad y mete los del archivo.
          Solo puede hacerlo quien figura como titular, se descarga antes una copia de lo que haya
          en ese momento, y queda escrito en el registro de actividad.
        </p>
      )}
      {/*
        LO QUE HAY GUARDADO, y el aviso si lleva demasiado.
        El botón de descargar seguía ahí y la hermandad no tenía forma de
        saber si alguien lo había pulsado alguna vez. Ahora se dice de cuándo
        es la última y, si lleva más de un mes —o no hay ninguna—, se dice en
        rojo: cuatro semanas sin copia ya no es «esta semana no ha entrado
        nadie», es que algo no funciona.
      */}
      {copias.seSabe && (
        <div className={`banner-inline banner-inline--${copias.hayQueAvisar ? 'alerta' : 'accent'}`}>
          <span>
            {copias.ultima === null ? (
              <>
                <b>Todavía no hay ninguna copia guardada.</b> Si falta ejecutar{' '}
                <code>supabase/copias.sql</code> en Supabase, es por eso.
              </>
            ) : (
              <>
                Última copia automática: <b>{formatDate(copias.ultima)}</b>
                {' '}({diasDesde(copias.ultima) === 0 ? 'hoy' : `hace ${diasDesde(copias.ultima)} días`}).
                {' '}Se guardan las {COPIAS_QUE_SE_GUARDAN} últimas; ahora hay {copias.cuantas}.
                {copias.hayQueAvisar && (
                  <> <b>Lleva más de un mes sin hacerse.</b> Descarga una a mano y avísanos.</>
                )}
              </>
            )}
          </span>
        </div>
      )}
      <div className="settings-actions">
        {copiaEstado && <span className="alert-item alert-item--ok">{copiaEstado}</span>}
        <input
          ref={backupRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={restaurarDesdeArchivo}
        />
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!sePuedeRestaurar() && !sePuedeVolcarEnLaBase()}
          title={
            sePuedeRestaurar() || sePuedeVolcarEnLaBase()
              ? undefined
              : 'No hay ni datos en este navegador ni base de datos conectada'
          }
          onClick={() => backupRef.current?.click()}
        >
          Restaurar copia
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setPidiendoClave(true)}>
          Descargar copia
        </button>
      </div>

      {/*
        ==================================================================
        LA CONTRASEÑA DE LA COPIA
        ==================================================================

        POR QUÉ CIFRAR ES LO SUYO: este archivo lleva las cuatrocientas
        fichas con su DNI, su dirección, su teléfono y sus IBAN. Y acaba en
        un pendrive, en un adjunto o en el WhatsApp de la junta, que es lo
        que la gente hace con un archivo llamado «copia de seguridad».

        Y POR QUÉ NO SE OBLIGA: una copia cifrada cuya contraseña se pierde
        es una copia que ya no existe. No hay «recuperar contraseña» que
        valga —si lo hubiera, el cifrado no serviría— y el censo es justo el
        dato que no se puede volver a escribir. Esto cambia una amenaza por
        otra, y la segunda pasa más a menudo.

        Así que se recomienda, se avisa con todas las letras, y se deja la
        otra puerta abierta para quien sepa lo que hace.
      */}
      {pidiendoClave && (
        <div className="assign-box" style={{ marginTop: '0.9rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Proteger la copia con contraseña</h3>
          <p className="form-hint" style={{ marginTop: 0 }}>
            La copia lleva dentro el censo entero: nombres, DNI, direcciones, teléfonos e IBAN.
            Cifrarla es lo suyo si va a salir de este ordenador.
          </p>
          <div className="banner-inline banner-inline--warn" style={{ marginBottom: '0.7rem' }}>
            <span>
              <b>Apunta la contraseña donde no se pierda.</b> Si se pierde, esta copia no la abre
              nadie — tampoco nosotros. No hay forma de recuperarla.
            </span>
          </div>
          <div className="form-row">
            <label htmlFor="claveCopia">Contraseña</label>
            <input
              id="claveCopia" type="password" autoComplete="new-password"
              value={clave} onChange={(e) => setClave(e.target.value)}
              placeholder={`Al menos ${MINIMO_CONTRASENA} caracteres`}
            />
          </div>
          <div className="form-row">
            <label htmlFor="claveCopia2">Repítela</label>
            {/*
              SE PIDE DOS VECES, y es la comprobación que más veces va a
              salvar a alguien: una errata no se descubre al descargar —el
              archivo sale igual de bien— sino el día que hace falta abrirlo.
            */}
            <input
              id="claveCopia2" type="password" autoComplete="new-password"
              value={claveRepetida} onChange={(e) => setClaveRepetida(e.target.value)}
            />
          </div>
          {clave !== '' && !revisionClave.puede && (
            <p className="form-hint" style={{ color: 'var(--peligro, #b91c1c)' }}>{revisionClave.motivo}</p>
          )}
          <div className="settings-actions" style={{ marginTop: '0.7rem' }}>
            <button
              type="button" className="btn btn-primary"
              disabled={!revisionClave.puede}
              onClick={() => { void descargarCopia(clave) }}
            >
              Descargar cifrada
            </button>
            {/*
              LA OTRA PUERTA, y va marcada como lo que es. Hay quien guarda su
              copia en un disco cifrado y no quiere otra contraseña más; y hay
              quien prefiere el riesgo de que se lea al riesgo de perderla.
              Decidirlo por ellos sería peor que explicárselo.
            */}
            <button
              type="button" className="btn btn-ghost"
              onClick={() => { setPidiendoClave(false); void descargarCopia() }}
            >
              Descargar sin cifrar
            </button>
            <button
              type="button" className="btn btn-ghost"
              onClick={() => { setPidiendoClave(false); setClave(''); setClaveRepetida('') }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>

    <section className="settings-card settings-card--peligro">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Restablecer datos</h2>
      </div>
      <p className="form-hint">
        Si quieres empezar de cero con los datos de ejemplo, puedes restablecerlos aquí. Se borra
        todo lo guardado en este navegador. Esta acción no se puede deshacer.
      </p>
      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            if (window.confirm('¿Borrar todos los datos guardados y volver a los de ejemplo?')) {
              restablecerDatosDeEjemplo()
            }
          }}
        >
          Restablecer datos de ejemplo
        </button>
      </div>
    </section>
      </>
  )
}
