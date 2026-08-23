import { Link, useSearchParams } from 'react-router-dom'
import Logo, { LogoMark } from '../components/Logo'
import { decodificarQr, type DatosCarne, type DatosVerificacion } from '../lib/verificacion'
import { aniosDeHermandad } from '../lib/hermanoFicha'
import { distincionDe, siguienteDistincion } from '../lib/distincionHermano'

/**
 * LA PÁGINA QUE SE ABRE AL ESCANEAR UN QR.
 *
 * Los datos viajan dentro del propio enlace, así que se ven desde cualquier
 * móvil sin base de datos y sin tener el censo en ese teléfono. La
 * comprobación reforzada contra el sistema de la hermandad —y marcar
 * «entregada» el día de salida— llegará con Supabase.
 *
 * QUIÉN LA MIRA Y DÓNDE. Un diputado de tramo, en la calle, de noche, con
 * prisa y con el móvil de otro. Tiene tres segundos para saber si quien tiene
 * delante es de la casa. Por eso lo primero y más grande es el nombre y la
 * distinción, y no una lista de campos: la lista se lee después, si hace falta.
 *
 * Y POR ESO EL CARNÉ TIENE MODELOS. Un hermano de cincuenta y dos años en la
 * casa tenía exactamente la misma tarjeta que uno que entró en marzo. En una
 * hermandad los años son lo primero que se dice de alguien, y aquí no se veían
 * por ninguna parte — ver `lib/distincionHermano.ts`.
 */
export default function VerificarPapeleta() {
  const [params] = useSearchParams()
  const leido = decodificarQr(params.get('d'))

  return (
    <div className="verificar">
      <header className="verificar__head">
        <Logo size={32} />
        <Link className="btn btn-outline btn-sm" to="/">
          Ir a Gobergo
        </Link>
      </header>

      <main className="verificar__main">
        {leido?.tipo === 'carne' ? (
          <TarjetaCarne carne={leido.datos} />
        ) : leido?.tipo === 'papeleta' ? (
          <TarjetaPapeleta datos={leido.datos} />
        ) : (
          <article className="verificar__card verificar__card--error">
            <div className="verificar__sello verificar__sello--err" aria-hidden="true">!</div>
            <h1>Código no válido</h1>
            <p className="verificar__nota">
              Este enlace no contiene un carné ni una papeleta legibles. Vuelve a escanear el código.
            </p>
          </article>
        )}
      </main>
    </div>
  )
}

/**
 * EL CARNÉ.
 *
 * Los años se calculan AQUÍ, al escanear, y no van escritos en el código: así
 * un carné impreso hace tres años sigue diciendo la verdad hoy. Es también lo
 * que permite que la distinción cambie sola el día que le tocan las bodas de
 * plata, sin que nadie tenga que reimprimir nada.
 */
function TarjetaCarne({ carne }: { carne: DatosCarne }) {
  const anios = aniosDeHermandad(carne.d)
  const d = distincionDe(anios)
  const proxima = siguienteDistincion(anios)
  const activo = carne.e === 'Activo' || carne.e === 'Nuevo'

  return (
    <article className={`carne-qr carne-qr--${d.modelo}`}>
      {/* La cinta. Es lo que distingue un modelo de otro de un vistazo, antes
          incluso de leer nada. */}
      <p className="carne-qr__cinta">{d.titulo}</p>

      <div className="carne-qr__cuerpo">
        {/*
          La medalla. Los años, en grande — salvo dos casos:

          · Sin antigüedad registrada no se pone «0 años», que sería mentira
            sobre alguien que a lo mejor lleva cuarenta: se pone la marca.
          · Con cero años tampoco: «0 AÑOS» en una medalla parece un suspenso.
            A quien acaba de entrar se le pone el año en que entró, que es lo
            que de verdad tiene que enseñar.
        */}
        <div className="carne-qr__medalla" aria-hidden="true">
          {anios === null ? (
            <LogoMark size={44} />
          ) : anios === 0 ? (
            <>
              <b>{carne.d}</b>
              <span>desde</span>
            </>
          ) : (
            <>
              <b>{anios}</b>
              <span>{anios === 1 ? 'año' : 'años'}</span>
            </>
          )}
        </div>

        <h1>{carne.h}</h1>
        <p className="carne-qr__sub">
          Hermano/a nº {carne.nh > 0 ? carne.nh : '—'} · {carne.hd}
        </p>

        {/*
          El sello de comprobado, PEQUEÑO y al lado del estado. Antes era un
          círculo verde enorme en el centro y dominaba la tarjeta entera, y lo
          que quiere decir es solo «el código se ha leído bien» — que no es lo
          mismo que «esta persona está al corriente», y a ese tamaño lo parecía.
        */}
        <p className={`carne-qr__estado${activo ? '' : ' carne-qr__estado--off'}`}>
          <span aria-hidden="true">{activo ? '✓' : '·'}</span>
          {carne.e}
          {carne.d > 0 && ` desde ${carne.d}`}
        </p>

        {d.detalle && <p className="carne-qr__detalle">{d.detalle}</p>}

        {/*
          Y lo que viene. Es el dato que convierte la tarjeta en algo que se
          enseña: «te faltan tres años para las bodas de plata» es lo que se
          comenta en la casa de hermandad. Solo las distinciones de verdad, las
          que se entregan en cabildo.
        */}
        {proxima && proxima.faltan <= 5 && (
          <p className="carne-qr__proxima">
            {proxima.faltan === 1
              ? `El año que viene, ${proxima.titulo.toLowerCase()}`
              : `Faltan ${proxima.faltan} años para las ${proxima.titulo.toLowerCase()}`}
          </p>
        )}
      </div>

      <p className="verificar__nota">
        Datos leídos del propio código. La comprobación contra el censo de la hermandad estará
        disponible al conectar la base de datos.
      </p>
    </article>
  )
}

/** La papeleta de sitio: aquí lo que importa es el tramo y el número. */
function TarjetaPapeleta({ datos }: { datos: DatosVerificacion }) {
  return (
    <article className="carne-qr carne-qr--papeleta">
      <p className="carne-qr__cinta">Papeleta de sitio · {datos.a}</p>
      <div className="carne-qr__cuerpo">
        <div className="carne-qr__medalla" aria-hidden="true">
          <b>{String(datos.n).padStart(4, '0')}</b>
          <span>papeleta</span>
        </div>
        <h1>{datos.h}</h1>
        <p className="carne-qr__sub">
          Hermano/a nº {datos.nh > 0 ? datos.nh : '—'} · {datos.hd}
        </p>
        {/* El tramo, en grande: es LO que se comprueba en la calle. */}
        <p className="carne-qr__tramo">{datos.t}</p>
      </div>
      <p className="verificar__nota">
        Datos leídos del propio código. La verificación reforzada —comprobar contra el sistema de la
        hermandad y marcar la entrega el día de salida— estará disponible al conectar la base de datos.
      </p>
    </article>
  )
}
