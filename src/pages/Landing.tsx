import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'

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
    text: 'Tramos, puestos e insignias, asignación por antigüedad, túnicas y enseres. Organiza la cofradía y genera listados con QR.',
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
  return (
    <div className="landing">
      <header className="site-header">
        <div className="wrap nav-row">
          <Logo size={34} />
          <nav className="nav-links">
            <a href="#funciones">Funciones</a>
            <a href="#audiencia">Para quién es</a>
            <a href="#precios">Precios</a>
          </nav>
          <div className="nav-cta">
            <ThemeToggle />
            <Link className="link-login" to="/login">
              Iniciar sesión
            </Link>
            <Link className="btn btn-primary btn-sm" to="/registro">
              Empieza gratis
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
            <ul className="bullets">
              <li><Check /> Censo de hermanos siempre al día</li>
              <li><Check /> Cobro de cuotas y papeletas online</li>
              <li><Check /> Portal propio para cada hermano</li>
            </ul>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/registro">
                Crea tu hermandad gratis
              </Link>
              <Link className="btn btn-outline" to="/login">
                Iniciar sesión
              </Link>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="glass-card">
              <div className="glass-card__head">
                <span className="glass-dot" />
                <span className="glass-dot" />
                <span className="glass-dot" />
              </div>
              <div className="glass-stat">
                <span className="glass-stat__label">Papeletas emitidas</span>
                <span className="glass-stat__value">812</span>
              </div>
              <div className="glass-rows">
                <div className="glass-row"><span>Cuotas al corriente</span><b>94%</b></div>
                <div className="glass-row"><span>Recaudado</span><b>18.420 €</b></div>
                <div className="glass-row"><span>Hermanos activos</span><b>1.204</b></div>
              </div>
              <div className="glass-bar"><span style={{ width: '94%' }} /></div>
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
              Da igual si sois cincuenta hermanos o cinco mil: Cabildo se adapta a tu forma de
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

      <section className="cta-band" id="precios">
        <div className="wrap cta-inner">
          <p className="eyebrow eyebrow--gold">Empieza hoy</p>
          <h2>Lleva tu hermandad al día en una tarde</h2>
          <Link className="btn btn-gold" to="/registro">
            Crea tu hermandad gratis
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <Logo size={32} />
            <p className="footer-about">
              El software para gestionar hermandades y cofradías. Hecho por y para el mundo
              cofrade.
            </p>
          </div>
          <div>
            <h4>Producto</h4>
            <ul>
              <li><a href="#funciones">Funciones</a></li>
              <li><a href="#precios">Precios</a></li>
              <li><a href="#">Novedades</a></li>
            </ul>
          </div>
          <div>
            <h4>Recursos</h4>
            <ul>
              <li><a href="#">Ayuda y tutoriales</a></li>
              <li><a href="#">Migrar desde Excel</a></li>
              <li><a href="#">Soporte técnico</a></li>
            </ul>
          </div>
          <div>
            <h4>Acceso</h4>
            <ul>
              <li><Link to="/login">Iniciar sesión</Link></li>
              <li><Link to="/registro">Crear hermandad</Link></li>
            </ul>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© 2026 Cabildo · Todos los derechos reservados</span>
          <span>Hecho con cariño para el mundo cofrade</span>
        </div>
      </footer>
    </div>
  )
}
