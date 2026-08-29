import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { PACKS, precioPack, etiquetaPeriodo, type Periodo } from '../lib/suscripcion'
import { diasHasta, enCorto, enPalabras, proximaSemanaSanta } from '../lib/semanaSanta'

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

const FEATURES = [
  {
    title: 'Hermanos',
    text: 'Censo, altas y bajas, fichas, familias, antigüedad y certificados. Importa desde Excel o Access en minutos.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3" /><path d="M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M16 8a3 3 0 0 1 0 6M21 21v-2a4 4 0 0 0-3-3.8" /></svg>
    ),
  },
  {
    title: 'Cuotas y recibos',
    text: 'Tipos de cuota, remesas SEPA, fraccionamientos, devueltos y recordatorios automáticos. Cobra sin perseguir a nadie.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
    ),
  },
  {
    title: 'Papeletas de sitio',
    text: 'Renovación por antigüedad, solicitud desde el móvil, pago online y papeleta con QR. La Cuaresma entera sin colas en secretaría.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" /><path d="M10 6v12" strokeDasharray="2 2" /></svg>
    ),
  },
  {
    title: 'Cortejo',
    text: 'Tramos y puestos, cruz de guía, insignias y varales, diputados de tramo, acólitos y costaleros. Listados de salida por tramo y asistencia con QR en la puerta.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v18M6 8v13M18 8v13M4 21h16" /><circle cx="12" cy="3" r="1.4" /></svg>
    ),
  },
  {
    title: 'Tesorería',
    text: 'Ingresos y gastos, cuentas, conciliación, presupuesto y balances. Con pagos online por Redsys, Stripe y Bizum.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h18v12H3z" /><path d="M3 10h18M7 15h4" /></svg>
    ),
  },
  {
    title: 'Comunicados',
    text: 'Email, SMS, WhatsApp y push segmentados. Convocatoria de cabildo, papeletas y avisos de culto, solo a quien toca.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h16v11H8l-4 4z" /><path d="M8 9h8M8 12h5" /></svg>
    ),
  },
  {
    title: 'Cultos y priostía',
    text: 'Quinarios, triduos, besamanos, besapiés y vía crucis en un calendario que alimenta la web. Reparto de tareas de priostía y montaje del altar de cultos.',
    icon: (
      // Un cirio con su llama: es lo que hay encendido en un altar de cultos.
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 3c1.6 1.4 2.4 2.6 2.4 3.8A2.4 2.4 0 0 1 12 9.2a2.4 2.4 0 0 1-2.4-2.4C9.6 5.6 10.4 4.4 12 3Z" />
        <rect x="8.6" y="11" width="6.8" height="10" rx="1.4" /><path d="M6 21h12" />
      </svg>
    ),
  },
  {
    // La novena, y no por cuadrar la rejilla: es el módulo que sostiene todo lo
    // demás —sin secretaría no hay censo que valga— y faltaba en la portada.
    title: 'Secretaría y archivo',
    text: 'Actas de cabildo, certificados de antigüedad, archivo documental y papelera con vuelta atrás. Con el registro de quién hizo cada cosa.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    title: 'Patrimonio y enseres',
    text: 'Orfebrería, textil, túnicas y enseres de culto con su ubicación, su estado de conservación y su valor asegurado. Préstamos y cesiones, controlados.',
    icon: (
      // La cruz de guía, que es la pieza que abre cualquier cortejo.
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 3v16M8 7.5h8" /><path d="M9 21h6" /><circle cx="12" cy="3" r="1.1" />
      </svg>
    ),
  },
]

/**
 * EL AÑO COFRADE, que no es el año natural.
 *
 * Una hermandad no trabaja de enero a diciembre: trabaja de Cuaresma a
 * Cuaresma, y cada tiempo tiene lo suyo. Contarlo así en la portada hace dos
 * cosas a la vez —enseña que Gobergo entiende el oficio, y explica cada módulo
 * en el momento del año en que de verdad se usa— y le habla a quien decide con
 * las palabras que usa esa persona, no con las de un catálogo de software.
 */
const ANIO_COFRADE = [
  {
    tiempo: 'Cuaresma',
    cuando: 'del Miércoles de Ceniza al Domingo de Ramos',
    que: 'Quinario o triduo al Titular, besamanos, besapiés y vía crucis. Y el reparto de papeletas de sitio, que es lo que llena la secretaría todas las tardes.',
    voces: ['Papeletas de sitio', 'Quinario', 'Besamanos', 'Vía crucis'],
    gobergo: 'La papeleta se pide y se renueva desde el móvil, se reparte por antigüedad y sale con su código QR.',
  },
  {
    tiempo: 'La estación de penitencia',
    cuando: 'de Ramos a Resurrección',
    que: 'El cortejo, tramo a tramo: cruz de guía, insignias y varales, diputados de tramo, acólitos, y los costaleros debajo del paso.',
    voces: ['Cortejo', 'Tramos', 'Insignias', 'Capataz y costaleros'],
    gobergo: 'Los tramos montados con sus puestos, el listado de salida de cada diputado y el control de asistencia en la puerta.',
  },
  {
    tiempo: 'Después de la salida',
    cuando: 'primavera y verano',
    que: 'Cabildo general de cuentas, memoria del ejercicio, altas y bajas del año, y la lista de lo que hay que restaurar antes de la siguiente.',
    voces: ['Cabildo de cuentas', 'Memoria', 'Altas y bajas'],
    gobergo: 'El estado de cuentas sale hecho, con las partidas que pide la diócesis. Las actas y los acuerdos, en el archivo.',
  },
  {
    tiempo: 'El resto del año',
    cuando: 'de otoño a Adviento',
    que: 'Función principal de instituto, cultos de gloria y sacramentales, la bolsa de caridad, la priostía y el inventario, convivencias y formación.',
    voces: ['Cultos de gloria', 'Caridad', 'Priostía', 'Patrimonio'],
    gobergo: 'El calendario de cultos alimenta la web pública, y el inventario lleva el valor asegurado de cada enser.',
  },
]

/**
 * Las tres cosas por las que una hermandad se acerca a esto. No son «los
 * módulos»: son lo que se dice cuando alguien pregunta para qué sirve.
 */
const AUDIENCE = [
  {
    n: '01',
    title: 'Hermandades y cofradías de penitencia',
    text: 'Censo, papeletas de sitio, cortejo y cultos de Semana Santa en un mismo sitio.',
  },
  {
    n: '02',
    title: 'Hermandades de gloria y sacramentales',
    text: 'Cuotas, patrimonio, agenda de cultos y comunicación con los hermanos todo el año.',
  },
  {
    n: '03',
    title: 'Juntas de gobierno y secretarías',
    text: 'Permisos por cargo, actas, archivo documental e informes listos para el cabildo.',
  },
  {
    n: '04',
    title: 'Cada hermano, desde su móvil',
    text: 'Portal personal para pagar cuotas, sacar su papeleta y confirmar asistencia.',
  },
]

export default function Landing() {
  const [periodo, setPeriodo] = useState<Periodo>('mensual')
  /*
   * LA SEMANA SANTA QUE VIENE, calculada. Ver `lib/semanaSanta.ts`: no se
   * puede escribir a mano porque se mueve más de un mes de un año a otro, y
   * una portada que anuncia el Domingo de Ramos en la fecha equivocada se
   * descalifica sola delante de un cofrade.
   */
  const semana = proximaSemanaSanta()
  const jalones = [
    { que: 'Miércoles de Ceniza', iso: semana.ceniza },
    { que: 'Domingo de Ramos', iso: semana.ramos },
    { que: 'Jueves Santo', iso: semana.juevesSanto },
    { que: 'Viernes Santo', iso: semana.viernesSanto },
    { que: 'Resurrección', iso: semana.pascua },
  ]
  // Durante la propia Semana Santa la cuenta atrás ya no cuenta: dice lo que
  // pasa. «Faltan −3 días» sería justo lo que no hay que enseñar el Jueves
  // Santo, que es el día del año con más gente mirando.
  const cuenta = semana.faltan > 1
    ? { cifra: String(semana.faltan), pie: 'días' }
    : semana.faltan === 1
      ? { cifra: 'Mañana', pie: 'Domingo de Ramos' }
      : semana.faltan === 0
        ? { cifra: 'Hoy', pie: 'Domingo de Ramos' }
        : { cifra: 'Ya', pie: 'está en la calle' }
  return (
    <div className="landing-glass">
      <div className="landing-bg" aria-hidden="true">
        <span className="orb orb--gold" />
        <span className="orb orb--violet" />
        <span className="orb orb--plum" />
        <span className="auth-grain" />
      </div>

      <header className="site-header">
        <div className="wrap nav-row">
          <Logo light size={34} />
          <nav className="nav-links">
            <a href="#funciones">Funciones</a>
            <a href="#ano">El año cofrade</a>
            <a href="#audiencia">Para quién es</a>
            <a href="#precios">Precios</a>
          </nav>
          <div className="nav-cta">
            <Link className="btn btn-outline btn-sm" to="/entrar">
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">El software para hermandades y cofradías</p>
            {/* En VERSALES, y el reparto en renglones lo hace `text-wrap:
                balance`, no un salto a mano. Con el titular anterior, más
                corto, el salto iba puesto aquí; este es de 55 caracteres y
                cualquier salto fijo se descuadra en cuanto cambia el ancho de
                la ventana —a 1440 px salían tres renglones, uno de ellos de
                dos palabras—. La cursiva de antes bajaba el tono justo en la
                frase que tiene que sonar rotunda. */}
            <h1>
              Toda la vida de tu hermandad, organizada y bajo control
            </h1>
            <p className="lede">
              Menos papeles, más hermandad. Gestiona el día a día sin complicaciones, ahorra
              tiempo a la Junta y crea un vínculo más fuerte con los hermanos para seguir sumando.
            </p>
            {/*
              TODOS LOS MÓDULOS, Y NO TRES.

              Aquí había tres tarjetas —censo, cuotas, área del hermano—, y tres
              tarjetas en la portada no se leen como «tres ejemplos»: se leen
              como «esto es lo que hace». Una hermandad que necesita llevar el
              cortejo o la priostía cerraba la página creyendo que esto no le
              servía.

              Y ponerlos los nueve en tarjeta tampoco: el hero es lo que decide
              si alguien sigue bajando, y nueve cajas tapan el titular y los
              botones. Así que van todos, pero en una tira callada. Se lee «hay
              muchas cosas» de un vistazo, sin quitarle sitio a nada, y quien
              quiera el detalle lo tiene una pantalla más abajo.

              SALEN DE `FEATURES`, que es la lista de verdad de los módulos. Una
              copia a mano aquí se quedaría vieja el día que se añada uno, y
              entonces la portada prometería de menos sin que nadie se entere.
            */}
            <ul className="hero-modulos" aria-label="Módulos incluidos">
              {FEATURES.map((f) => <li key={f.title}>{f.title}</li>)}
            </ul>
            <p className="hero-modulos__pie">
              Todo incluido, sin módulos aparte ni precio por función.{' '}
              <a href="#funciones">Ver qué hace cada uno</a>
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-glass-dynamic" to="/registro">
                <span>Crear mi hermandad</span>
              </Link>
              <Link className="btn btn-outline" to="/entrar">
                Entrar
              </Link>
            </div>
          </div>

          {/*
            EL PANEL, con la pinta que tiene de verdad.
            Es la única forma de enseñar de qué se está hablando sin pedirle a
            nadie que se registre para verlo. Los números son de ejemplo y no
            hay ninguno que prometa nada: son el tamaño de una hermandad
            mediana.
          */}
          <div className="hero-visual" aria-hidden="true">
            <div className="panel-demo">
              <div className="panel-demo__head">
                <span className="panel-demo__label">Papeletas emitidas</span>
                <span className="panel-demo__puntos"><i /><i /><i /></span>
              </div>
              <div className="panel-demo__cifra">812</div>

              <div className="panel-demo__rejilla">
                <div className="panel-demo__mini">
                  <span className="panel-demo__label">Cuotas al corriente</span>
                  {/* La línea del año: sube en Cuaresma, que es cuando se paga. */}
                  <svg className="panel-demo__linea" viewBox="0 0 120 40" preserveAspectRatio="none">
                    <path d="M2 32 L16 27 L30 30 L44 20 L58 24 L72 14 L86 17 L100 8 L114 6" />
                    <circle cx="114" cy="6" r="3.2" />
                  </svg>
                </div>
                <div className="panel-demo__mini">
                  <span className="panel-demo__label">Recaudado</span>
                  <div className="panel-demo__aguja">
                    <svg viewBox="0 0 100 54">
                      <path d="M8 50a42 42 0 0 1 84 0" className="panel-demo__aguja-fondo" />
                      <path d="M8 50a42 42 0 0 1 84 0" className="panel-demo__aguja-valor" />
                    </svg>
                    <b>18.420 €</b>
                  </div>
                </div>
                <div className="panel-demo__mini panel-demo__mini--ancha">
                  <span className="panel-demo__label">Hermanos activos</span>
                  <div className="panel-demo__fila-valor">
                    <b>1.204</b>
                    <span className="panel-demo__pastilla">94% al día</span>
                  </div>
                </div>
              </div>

              <div className="panel-demo__listas">
                <div className="panel-demo__lista">
                  <span className="panel-demo__label">Avisos recientes</span>
                  <p><b>Cabildo de cuentas</b><small>hace 2 min</small></p>
                  <p><b>Reparto de papeletas</b><small>ayer</small></p>
                </div>
                <div className="panel-demo__lista">
                  <span className="panel-demo__label">Próximos cultos</span>
                  <p><b>Triduo al Titular</b><small>12 mar</small></p>
                  <p><b>Besamanos</b><small>21 mar</small></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*
        EL BOTÓN QUE SIGUE AHÍ AL BAJAR.
        La página es larga —funciones, para quién es, precios— y quien se
        convence en el tercer bloque tenía que subir hasta arriba del todo para
        encontrar por dónde empezar.
      */}
      <a className="flota-cta" href="/registro">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Empezar ahora
      </a>

      {/*
        LA SEMANA SANTA QUE VIENE, con sus fechas de verdad.
        Es el detalle que dice, sin decirlo, que esto lo ha hecho alguien que
        conoce el oficio: cualquier hermano sabe que la fecha se mueve cada
        año, y ver la suya bien puesta vale más que un párrafo de promesas.
        Además coloca los módulos en el momento del año en que se usan.
      */}
      <section className="cofrade-banda" aria-labelledby="cofrade-banda-titulo">
        <div className="wrap">
          <div className="cofrade-banda__fila">
            <div className="cofrade-banda__que">
              <p className="eyebrow eyebrow--gold">Semana Santa de {semana.anio}</p>
              <h2 id="cofrade-banda-titulo">
                {semana.faltan >= 0
                  ? <>Domingo de Ramos, {enPalabras(semana.ramos)}</>
                  : <>Ya es Semana Santa</>}
              </h2>
              <p className="cofrade-banda__lede">
                Gobergo cuenta los mismos días que tu hermandad: la campaña de papeletas se abre en
                Cuaresma, el cortejo se cierra la semana antes y el cabildo de cuentas llega después.
              </p>
            </div>
            <p className="cofrade-cuenta">
              <b>{cuenta.cifra}</b>
              <span>{cuenta.pie}</span>
            </p>
          </div>
          <ol className="cofrade-jalones">
            {jalones.map((j) => (
              // Los que ya han pasado se apagan: así se lee de un vistazo por
              // dónde va el año sin tener que comparar fechas con la de hoy.
              // En febrero el Miércoles de Ceniza ya cuenta como pasado aunque
              // la Semana Santa esté por venir: cada jalón mira SU fecha.
              <li key={j.que} className={diasHasta(j.iso) < 0 ? 'es-pasado' : ''}>
                <b>{j.que}</b>
                <span>{enCorto(j.iso)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/*
        AQUÍ HABÍA CINCO NOMBRES DE HERMANDADES «que ya lo usan», y no lo usaba
        ninguna: eran los de los datos de ejemplo —Vera-Cruz, La Esperanza, El
        Nazareno…— colados en la portada comercial. Eso no es una licencia de
        marketing, es publicidad engañosa, y en un producto que le pide a una
        hermandad su censo entero es lo último que uno puede permitirse.

        Lo que se dice ahora es lo que hay: que se está haciendo con
        hermandades, dónde, y que todavía no hay ninguna funcionando. Poner
        nombres de verdad, cuando los haya y con su permiso por escrito.
      */}
      <div className="trust">
        <div className="wrap">
          <p>En colaboración con hermandades de Granada y Cádiz</p>
          <p className="trust-nota">
            Se está construyendo con ellas, escuchando cómo trabajan de verdad: la secretaría, la
            tesorería y el cortejo.
          </p>
        </div>
      </div>

      <section className="section" id="funciones">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Un módulo para cada tarea</p>
            <h2>Qué hace cada módulo</h2>
            <p className="section-lead">
              Desde el censo hasta la estación de penitencia. Cada área tiene su sitio, y todo
              conecta entre sí.
            </p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <article className="feature" key={f.title}>
                <span className="feature__ic">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section anio-cofrade" id="ano">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow eyebrow--gold">El año cofrade</p>
            <h2>Una hermandad no va de enero a diciembre</h2>
            <p className="section-lead">
              Va de Cuaresma a Cuaresma, y cada tiempo tiene lo suyo. Gobergo está montado igual:
              cada módulo aparece cuando de verdad hace falta.
            </p>
          </div>
          <div className="anio-grid">
            {ANIO_COFRADE.map((t) => (
              <article className="anio-card" key={t.tiempo}>
                <p className="anio-card__cuando">{t.cuando}</p>
                <h3>{t.tiempo}</h3>
                <p className="anio-card__que">{t.que}</p>
                <ul className="anio-card__voces">
                  {t.voces.map((v) => <li key={v}>{v}</li>)}
                </ul>
                <p className="anio-card__gobergo">
                  <span>En Gobergo</span>
                  {t.gobergo}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section audience" id="audiencia">
        <div className="wrap audience-grid">
          <div className="audience-panel">
            <p className="eyebrow eyebrow--gold">Para quién es</p>
            <h2>Pensado para cualquier corporación, del tamaño que sea</h2>
            <p>
              Da igual si sois cincuenta hermanos o cinco mil: Gobergo se adapta a tu forma de
              trabajar, no al revés.
            </p>
          </div>
          <ul className="audience-list">
            {AUDIENCE.map((a) => (
              <li key={a.n}>
                <span className="audience-n">{a.n}</span>
                <span>
                  <b>{a.title}</b>
                  <span className="audience-text">{a.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section pricing" id="precios">
        <div className="wrap">
          <div className="section-head section-head--center">
            <p className="eyebrow eyebrow--gold">Precios</p>
            <h2>Elige solo lo que necesitas</h2>
            <p className="section-lead">
              Cuatro packs, sin coste por hermano y sin permanencia: solo la gestión interna, solo la
              web pública, las dos juntas, o todo con los extras premium. Da igual el tamaño de la
              corporación: el precio es el mismo.
            </p>
          </div>

          <div className="pricing-periodo">
            <button
              type="button"
              className={`pricing-periodo__btn${periodo === 'mensual' ? ' is-active' : ''}`}
              onClick={() => setPeriodo('mensual')}
            >
              Mensual
            </button>
            <button
              type="button"
              className={`pricing-periodo__btn${periodo === 'anual' ? ' is-active' : ''}`}
              onClick={() => setPeriodo('anual')}
            >
              Anual
            </button>
          </div>

          <div className="pricing-packs">
            {PACKS.map((p) => (
              <article
                key={p.id}
                className={`price-card${p.destacado ? ' price-card--featured' : ''}`}
              >
                {p.destacado && <span className="price-card__badge">Recomendado</span>}
                <span className="price-card__tag">{p.nombre}</span>
                <p className="price-card__amount">
                  <b>{precioPack(p, periodo).replace(' €', '')}</b>{' '}
                  <span className="price-card__cur">€</span>
                  <span className="price-card__per">{etiquetaPeriodo(periodo)}</span>
                </p>
                <p className="price-card__note">{p.resumen}</p>
                <ul className="price-card__list">
                  {p.incluye.map((linea) => (
                    <li key={linea}><Check /> {linea}</li>
                  ))}
                </ul>
                <Link
                  className={`btn btn-block ${p.destacado ? 'btn-primary btn-glass-dynamic' : 'btn-outline'}`}
                  to="/registro"
                >
                  {p.destacado ? <span>Crear mi hermandad</span> : 'Elegir este pack'}
                </Link>
              </article>
            ))}
          </div>

          <p className="pricing-foot">
            Precios provisionales. Crear la cuenta no cuesta nada: eliges tu pack al entrar por
            primera vez. Sin permanencia: cambia de pack o cancela cuando quieras desde el panel.
          </p>
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap">
          <div className="cta-inner">
            <p className="eyebrow eyebrow--gold">Empieza hoy</p>
            <h2>Lleva tu hermandad al día en una tarde</h2>
            <Link className="btn btn-primary btn-glass-dynamic" to="/registro">
              <span>Crear mi hermandad</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        {/* Los tres grupos del pie son h3, no h4: vienen detrás de los h2 de
            las secciones y saltar un nivel rompe el índice que usa quien
            navega la página con un lector de pantalla. */}
        <div className="wrap footer-grid">
          <div>
            <Logo light size={32} />
            <p className="footer-about">
              El software para gestionar hermandades y cofradías. Hecho por y para el mundo
              cofrade.
            </p>
          </div>
          <div>
            <h3>Producto</h3>
            <ul>
              <li><a href="#funciones">Funciones</a></li>
              <li><a href="#ano">El año cofrade</a></li>
              <li><a href="#audiencia">Para quién es</a></li>
              <li><a href="#precios">Precios</a></li>
            </ul>
          </div>
          <div>
            <h3>Acceso</h3>
            <ul>
              <li><Link to="/login">Iniciar sesión</Link></li>
              <li><Link to="/registro">Crear hermandad</Link></li>
              <li><Link to="/hermano">Área del hermano</Link></li>
            </ul>
          </div>
          <div>
            <h3>Legal</h3>
            <ul>
              <li><Link to="/legal/aviso-legal">Aviso legal</Link></li>
              <li><Link to="/legal/privacidad">Política de privacidad</Link></li>
              <li><Link to="/legal/condiciones">Condiciones de uso</Link></li>
              <li><Link to="/legal/cookies">Política de cookies</Link></li>
            </ul>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© 2026 Gobergo · Todos los derechos reservados</span>
          <span>Versión del {__BUILD_TIME__} · Hecho con cariño para el mundo cofrade</span>
        </div>
      </footer>

      <Link className="floating-cta btn btn-primary btn-glass-dynamic" to="/registro">
        <span>+ Empezar ahora</span>
      </Link>
    </div>
  )
}
