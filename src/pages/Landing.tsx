import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { PACKS, precioPack, etiquetaPeriodo, type Periodo } from '../lib/suscripcion'

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
    text: 'Solicitud, asignación, pago online, código QR e impresión. La campaña completa, sin colas en secretaría.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" /><path d="M10 6v12" strokeDasharray="2 2" /></svg>
    ),
  },
  {
    title: 'Cortejo',
    text: 'Tramos, puestos e insignias, reparto automático por número de hermano, túnicas y enseres. Organiza la cofradía y genera listados con QR.',
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
    text: 'Email, SMS, WhatsApp y push segmentados. Convocatorias de cabildo y avisos de cultos con confirmación de lectura.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h16v11H8l-4 4z" /><path d="M8 9h8M8 12h5" /></svg>
    ),
  },
]

/**
 * Las tres cosas por las que una hermandad se acerca a esto. No son «los
 * módulos»: son lo que se dice cuando alguien pregunta para qué sirve.
 */
const CLAVES = [
  {
    titulo: 'Censo de hermanos',
    sub: 'siempre al día',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M3.5 9h17M8 4v16" />
      </svg>
    ),
  },
  {
    titulo: 'Cuotas y papeletas',
    sub: 'cobradas sin perseguir a nadie',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M2.5 10h19" /><path d="M6 14.5h4" />
      </svg>
    ),
  },
  {
    titulo: 'Área propia',
    sub: 'para cada hermano',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4" /><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
      </svg>
    ),
  },
]

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
            <h1>
              Gestiona tu hermandad <em>desde un solo lugar</em>
            </h1>
            <p className="lede">
              Hermanos, cuotas, papeletas de sitio, cortejo, tesorería y comunicaciones. Todo lo
              que antes vivía en carpetas y hojas de cálculo, ordenado en una única plataforma.
            </p>
            {/*
              LAS TRES COSAS, en tarjetas y no en una lista de tres rayitas.
              Son lo que decide si una hermandad sigue leyendo, y una lista de
              puntos se salta con la vista.
            */}
            <ul className="hero-claves">
              {CLAVES.map((c) => (
                <li className="hero-clave" key={c.titulo}>
                  <span className="hero-clave__ic">{c.icon}</span>
                  <b>{c.titulo}</b>
                  <span>{c.sub}</span>
                </li>
              ))}
            </ul>
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

      <div className="trust">
        <div className="wrap">
          <p>Hermandades y cofradías que ya lo usan</p>
          <div className="trust-names">
            <span>Vera-Cruz</span>
            <span>La Esperanza</span>
            <span>El Nazareno</span>
            <span>Ntra. Sra. del Rosario</span>
            <span>La Soledad</span>
          </div>
        </div>
      </div>

      <section className="section" id="funciones">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Un módulo para cada tarea</p>
            <h2>Toda la vida de la hermandad, ordenada</h2>
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
