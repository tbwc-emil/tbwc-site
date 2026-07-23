// sections.jsx — homepage sections for TBWC modernized site

const Arrow = ({ size = 14 }) => (
  <svg className="arrow" width={size} height={size} viewBox="0 0 14 14" fill="none">
    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowDiag = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <path d="M4 10L10 4M5 4h5v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── NAV ────────────────────────────────────────────────────────────────────
function Nav({ onPortalClick }) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  return (
    <nav className="nav" data-scrolled={scrolled ? '1' : '0'}>
      <div className="wrap nav__inner">
        <a href="#" className="brand" aria-label="TBWC — home">
          <span className="brand__quad" aria-hidden="true">
            <span>T</span><span>B</span><span>W</span><span className="brand__quad-c">C</span>
          </span>
          <span className="brand__lockup">
            <span>Technology</span>
          </span>
        </a>
        <div className="nav__links">
          <a className="nav__link" href="#products">Products</a>
          <a className="nav__link" href="#reps">Representatives</a>
          <a className="nav__link" href="#about">About</a>
          <a className="nav__link" href="#contact">Contact</a>
        </div>
        <div className="nav__cta-group">
          <button className="btn btn--ghost btn--sm" onClick={onPortalClick}>
            Sign in
          </button>
          <button className="btn btn--primary btn--sm" onClick={onPortalClick}>
            Rep Portal <Arrow size={12} />
          </button>
          <button className="nav__burger" aria-label="Menu" onClick={() => setMobileOpen(v => !v)} data-open={mobileOpen ? '1' : '0'}>
            <span /><span /><span />
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="nav__mobile">
          <a href="#products" onClick={() => setMobileOpen(false)}>Products</a>
          <a href="#reps" onClick={() => setMobileOpen(false)}>Representatives</a>
          <a href="#about" onClick={() => setMobileOpen(false)}>About</a>
          <a href="#contact" onClick={() => setMobileOpen(false)}>Contact</a>
        </div>
      )}
    </nav>
  );
}

// ── HERO ───────────────────────────────────────────────────────────────────
function Hero({ variant, onPortalClick }) {
  const headlineA = (
    <h1 className="display">
      Submetering &amp; energy management,<br />
      <em>stocked</em>, spec'd, and supported.
    </h1>
  );
  const headlineB = (
    <h1 className="display">
      The partner<br />
      for <em>building</em> intelligence.
    </h1>
  );
  const headlineC = (
    <h1 className="display" style={{ textAlign: 'center' }}>
      One portal.<br />
      <em>Every</em> account.
    </h1>
  );
  const headline = variant === 'B' ? headlineB : variant === 'C' ? headlineC : headlineA;

  const lede = variant === 'B'
    ? "TBWC distributes submeters, CTs, smart meters, and energy management hardware through a curated network of authorized representatives — domestically compliant, in stock, backed by engineers who built the products."
    : variant === 'C'
    ? "Quote, order, and resolve — one workspace for the modern manufacturer's rep agency."
    : "We're the seller of meters, CTs, and energy management hardware that power submetering projects across North America — backed by real engineers and stocked stateside.";

  const products = [
    { id: 'hero-meter-1', label: 'DI-Meter · single-element smart meter', tag: 'Smart Meter' },
    { id: 'hero-meter-2', label: 'E-Mon class 3400 polyphase meter',       tag: 'Polyphase' },
    { id: 'hero-ct-1',    label: 'Split-core current transformer',         tag: 'CT' },
    { id: 'hero-optergy', label: 'Optergy Proton building controller',     tag: 'Controller' },
  ];

  return (
    <section className="hero">
      <div className="wrap">
        <div className="hero__grid">
          <div className="hero__copy">
            <div className="hero__eyebrow eyebrow">
              <span className="hero__eyebrow-dot" />
              <span>Authorized distribution · Since 2002</span>
            </div>
            {headline}
            <p className="lede" style={{ marginTop: 22 }}>{lede}</p>
            <div className="hero__cta-row">
              <button className="btn btn--primary" onClick={onPortalClick}>
                Take me to the Rep Portal <Arrow />
              </button>
              <a className="btn btn--ghost" href="#products">
                Browse the catalog
              </a>
            </div>
            <div className="hero__trust">
              <div><span className="mono num">24+</span><span>Years distributing</span></div>
              <div><span className="mono num">15</span><span>Authorized reps</span></div>
              <div><span className="mono num">BAA</span><span>·TAA·BABA compliant</span></div>
            </div>
          </div>

          <div className="hero__products">
            {products.map((p) => (
              <figure className="hero__prod" key={p.id}>
                <image-slot
                  id={p.id}
                  shape="rounded"
                  radius="14"
                  placeholder={`Drop a photo: ${p.label}`}
                  style={{ width: '100%', height: '100%' }}
                />
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── STATS ─────────────────────────────────────────────────────────────────
function Stats() {
  const items = [
    { n: '180', sup: '+',  l: 'Authorized rep agencies' },
    { n: '4.2k', sup: '',  l: 'SKUs across active brands' },
    { n: '2',    sup: '',  l: 'U.S. service centers' },
  ];
  return (
    <section className="row--tight">
      <div className="wrap">
        <div className="stats">
          {items.map((it, i) => (
            <div className="stat" key={i}>
              <div className="stat__num">
                {it.n}
                {it.sup && <sup>{it.sup}</sup>}
              </div>
              <div className="stat__label">{it.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── PRODUCTS / RESOURCES ──────────────────────────────────────────────────
const TBWC = 'https://tbwctechnology.com';
const UP = `${TBWC}/wp-content/uploads`;
const RESOURCE_GROUPS = [
  {
    n: '01',
    title: 'Catalogs & Documentation',
    desc: 'Print-ready overviews and product reference for every line we carry.',
    href: `${TBWC}/resources/`,
    items: [
      { label: 'Catalogs & Brochures',                                       href: `${TBWC}/brochures/`,        type: 'Page' },
      { label: 'Product Cutsheets',                                          href: `${TBWC}/cutsheets/`,        type: 'Page' },
      { label: 'User & Owner Manuals',                                       href: `${TBWC}/users-manuals/`,    type: 'Page' },
      { label: 'DI-SA Single Element Smart Meter Part Number Configurator',  href: `${UP}/DI-SA-Single-Element-Smart-Meter-Part-Number-Configurator-R05-0225B.pdf`, type: 'PDF' },
      { label: 'Cross Reference for all E-Mon Meters',                       href: `${UP}/Dent-by-TBWC-to-E-Mon-Cross-Reference-R11-2024.xlsx`,                    type: 'XLSX' },
    ],
  },
  {
    n: '02',
    title: 'Engineering & Submittals',
    desc: 'For specifying engineers and submittal packages on active projects.',
    href: `${TBWC}/resources/`,
    items: [
      { label: 'Engineer Specifications',                  href: `${TBWC}/engineer-specifications/`,  type: 'Page' },
      { label: 'Submittal Packages',                       href: `${TBWC}/submittal-packages/`,       type: 'Page' },
      { label: 'TBWC DENT CTEP Compliant Certificate',     href: `${UP}/CTEP-COA-5923-23.pdf`,        type: 'PDF' },
    ],
  },
  {
    n: '03',
    title: 'Installation Guides',
    desc: 'Field-ready installation references for the most common deployments.',
    href: `${TBWC}/resources/`,
    items: [
      { label: 'Optergy Proton to DI-Meter Installation Guide',  href: `${UP}/Optergy-Proton-to-DI-Meter-Installation-Guide-R4.pdf`,   type: 'PDF' },
      { label: 'Submeter Network Infrastructure Example',        href: `${UP}/Submeter-Network-Infrastructure-Example-R04-0825.pdf`,   type: 'PDF' },
      { label: 'Cellular Service Agreement',                     href: `${UP}/CSA.pdf`,                                                type: 'PDF' },
    ],
  },
  {
    n: '04',
    title: 'Compliance Certifications',
    desc: 'Domestic preference and trade-act compliance for federal and AHJ projects.',
    href: `${TBWC}/resources/`,
    items: [
      { label: 'TBWC Products Made in the USA Compliant',  href: `${UP}/TBWC-Products-Made-in-the-USA-Compliant.pdf`,                       type: 'PDF' },
      { label: 'BAA Compliance Certification',             href: `${UP}/BAA-Compliance-Certification-for-Dent-by-TBWC-Smart-Meters.pdf`,    type: 'PDF' },
      { label: 'TAA Compliance Certification',             href: `${UP}/TAA-Compliance-Certification-for-Dent-by-TBWC-Smart-Meters.pdf`,    type: 'PDF' },
      { label: 'BABA Compliance Certification',            href: `${UP}/BABA-Compliance-Certification-for-Dent-by-TBWC-Smart-Meters.pdf`,   type: 'PDF' },
    ],
  },
  {
    n: '05',
    title: 'Industry Reference',
    desc: 'Codes, deployments, and applied research from the field.',
    href: `${TBWC}/resources/`,
    items: [
      { label: 'Where is Submetering Required?',  href: `${TBWC}/submetering-requirements/`, type: 'Page' },
      { label: 'Case Studies',                    href: `${TBWC}/coming-soon/`,              type: 'Soon' },
      { label: 'Application Notes',               href: `${TBWC}/coming-soon/`,              type: 'Soon' },
    ],
  },
  {
    n: '06',
    title: 'Tech Talk & Support Docs',
    desc: 'Field service reports, quick-start guides, and white papers.',
    href: `${TBWC}/tech-support/`,
    items: [
      { label: 'TBWC Tech Talk · White Papers',           href: `${TBWC}/techtalk/`,                                              type: 'Page' },
      { label: 'Optergy Self-Help Guides',                 href: `${TBWC}/optergy-self-help/`,                                     type: 'Page' },
      { label: 'TBWC IR302 Quickstart Guide',              href: `${UP}/TBWC-IR302-Quickstart-Rev3.pdf`,                           type: 'PDF' },
      { label: 'DentCloud Meter Start-Up Documents',       href: `${UP}/TBWC-Technology-DentCloud-Meter-Start-Up-Documents.pdf`,   type: 'PDF' },
      { label: 'Register List for DI-SA, MMU PSHD Meters', href: `${UP}/PSHD_MASTER_REGISTER_LIST_current-4.xlsx`,                 type: 'XLSX' },
      { label: 'Field Service Report',                     href: `${UP}/TBWC-TECH-SERVICE-PLAN-REPORT.pdf`,                        type: 'PDF' },
      { label: 'PowerScout-HD Commissioning Checklist',    href: `${UP}/PowerScout-HD-Commissioning-Checklist-final2.pdf`,         type: 'PDF' },
    ],
  },
  {
    n: '07',
    title: 'Forms & Applications',
    desc: 'New customer onboarding, cellular service, and rep registration.',
    href: `${TBWC}/contacttbwc/`,
    items: [
      { label: 'New Customer Application',     href: `${TBWC}/new-customer/`,              type: 'Form' },
      { label: '4G LTE Service Registration',  href: `${TBWC}/lte-service-registration/`,  type: 'Form' },
      { label: 'New Rep Registration Request', href: `${TBWC}/newrep-request/`,            type: 'Form' },
      { label: 'Contact TBWC Technology',      href: `${TBWC}/Contact/`,                   type: 'Form' },
    ],
  },
  {
    n: '08',
    title: 'Rep Portal',
    desc: 'Authorized representatives access pricing, RMAs, and order status here.',
    cta: true,
    items: [
      { label: 'Sign in to Rep Portal',     href: `${TBWC}/rep-portal/`,       portal: true },
      { label: 'Request portal access',     href: `${TBWC}/newrep-request/`,   type: 'Form' },
    ],
  },
];

function Brands({ onPortalClick }) {
  return (
    <section id="products" className="row">
      <div className="wrap">
        <div className="sec-hd">
          <div className="sec-hd__label">
            <span><span className="sec-hd__num">01</span> · Products / Resources</span>
            <span>Catalog &amp; reference</span>
          </div>
          <div>
            <h2 className="h2 sec-hd__title">Everything you need<br />to spec, install, and submit.</h2>
            <p className="sec-hd__sub">Documentation for the lines TBWC distributes — submetering, smart meters, and energy management hardware. Authorized pricing and RMA forms live in the Rep Portal.</p>
          </div>
        </div>

        <div className="rgrid">
          {RESOURCE_GROUPS.map((g) => (
            <article className={'rcard' + (g.cta ? ' rcard--cta' : '')} key={g.n}>
              <a className="rcard__hd" href={g.href || '#'} target={g.href ? '_blank' : undefined} rel={g.href ? 'noopener noreferrer' : undefined} aria-label={g.title}>
                <span className="rcard__arrow"><ArrowDiag /></span>
              </a>
              <h3 className="rcard__title">{g.title}</h3>
              <ul className="rcard__list">
                {g.items.map((it) => {
                  const onClick = it.portal && onPortalClick
                    ? (e) => { e.preventDefault(); onPortalClick(); }
                    : undefined;
                  return (
                    <li key={it.label}>
                      <span className="rcard__bullet" aria-hidden="true" />
                      <a className="rcard__link" href={it.href} onClick={onClick}
                         target={it.portal ? undefined : '_blank'}
                         rel={it.portal ? undefined : 'noopener noreferrer'}>
                        <span className="rcard__link-label">{it.label}</span>
                        {it.type && <span className={'rcard__type rcard__type--' + it.type.toLowerCase()}>{it.type}</span>}
                        <span className="rcard__link-arrow" aria-hidden="true">→</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── SUPPORT ───────────────────────────────────────────────────────────────
function Support() {
  const cards = [
    {
      n: '01',
      title: 'Technical support, no phone-tree.',
      desc: 'Direct line to engineers who actually maintain the firmware and stock the bench. SoCal-based, business hours plus emergency.',
      cta: 'Open a ticket',
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="3" y="3" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M3 8h16M7 3v3M15 3v3" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
      ),
    },
    {
      n: '02',
      title: 'RMAs that ship the same day.',
      desc: 'Paperless return authorization in the portal. Cross-shipped advance replacements for active rep accounts in good standing.',
      cta: 'Start an RMA',
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M3 11l4-4M3 11l4 4M3 11h13a3 3 0 013 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      n: '03',
      title: '4G LTE service registration.',
      desc: 'Activate, swap, and manage data plans for connected hardware deployed in the field — without leaving the portal.',
      cta: 'Register a device',
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M5 14a6 6 0 0112 0M8 14a3 3 0 016 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <circle cx="11" cy="14" r="1.4" fill="currentColor"/>
        </svg>
      ),
    },
  ];
  return (
    <section id="support" className="row">
      <div className="wrap">
        <div className="sec-hd">
          <div className="sec-hd__label">
            <span><span className="sec-hd__num">02</span> · Technical Support</span>
            <span>How we back you up</span>
          </div>
          <div>
            <h2 className="h2 sec-hd__title">When something breaks,<br />we don't make you queue.</h2>
            <p className="sec-hd__sub">Three of the things our partners use most. All routed through the same portal, with paper-trail attached automatically to the account.</p>
          </div>
        </div>
        <div className="support">
          {cards.map((c) => (
            <a className="support-card" href="#" key={c.n}>
              <div className="support-card__num">{c.n}</div>
              <div className="support-card__icon">{c.icon}</div>
              <h3 className="support-card__title">{c.title}</h3>
              <p className="support-card__desc">{c.desc}</p>
              <span className="support-card__cta">{c.cta} <Arrow /></span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── REPS CALLOUT (legacy — replaced by RepsMap in reps-map.jsx) ──────────
function RepsLegacy() {
  return (
    <section id="reps" className="row">
      <div className="wrap">
        <div className="sec-hd">
          <div className="sec-hd__label">
            <span><span className="sec-hd__num">03</span> · Representatives</span>
            <span>Join the network</span>
          </div>
          <div>
            <h2 className="h2 sec-hd__title">A rep program designed<br />by people who've carried the bag.</h2>
            <p className="sec-hd__sub">Authorized agencies and their personnel get portal access, protected territories, real co-op, and a person — not a chatbot — on the other end of the line.</p>
          </div>
        </div>

        <div className="reps">
          <div className="reps__left">
            <div className="kicker"><span className="num">/01</span> &nbsp; New representative?</div>
            <h3 className="h2" style={{ fontSize: 'clamp(28px, 3vw, 44px)' }}>
              Request access in under <em style={{ fontFamily: 'var(--f-serif)', fontStyle: 'italic', fontWeight: 400 }}>five minutes</em>.
            </h3>
            <p className="body" style={{ fontSize: 16, lineHeight: 1.55, maxWidth: '46ch' }}>
              Submit your agency information and authorized personnel for review. Most applications are approved within one business day; you'll get portal credentials and a dedicated account manager on day two.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a className="btn btn--accent" href="#contact">
                Registration request <Arrow />
              </a>
              <a className="btn btn--ghost" href="#contact">
                Talk to a person
              </a>
            </div>
          </div>
          <div className="reps__right">
            <div className="kicker"><span className="num">/02</span> &nbsp; What you get</div>
            <div className="reps__steps">
              <div className="reps__step">
                <span className="reps__step-num">01</span>
                <span className="reps__step-text"><strong>Portal access</strong> — line card, datasheets, pricing, RMAs.</span>
              </div>
              <div className="reps__step">
                <span className="reps__step-num">02</span>
                <span className="reps__step-text"><strong>Protected territories</strong> — registered deals stay registered.</span>
              </div>
              <div className="reps__step">
                <span className="reps__step-num">03</span>
                <span className="reps__step-text"><strong>Co-op &amp; SPIFs</strong> — quarterly, paid on time, no haggling.</span>
              </div>
              <div className="reps__step">
                <span className="reps__step-num">04</span>
                <span className="reps__step-text"><strong>Direct engineering line</strong> — for the calls you can't punt.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── LOCATIONS ─────────────────────────────────────────────────────────────
function Locations() {
  return (
    <section id="about" className="row">
      <div className="wrap">
        <div className="sec-hd">
          <div className="sec-hd__label">
            <span><span className="sec-hd__num">04</span> · About TBWC</span>
            <span>Vision &amp; mission</span>
          </div>
          <div>
            <h2 className="h2 sec-hd__title">Practical solutions,<br />delivered through people.</h2>
            <p className="sec-hd__sub">Corporate ops out of Las Vegas, hands-on service center in Ontario, California. Both staffed by the people who actually answer your email.</p>
          </div>
        </div>

        <div className="vm">
          <article className="vm__card">
            <span className="vm__kicker mono">Our Vision</span>
            <p className="vm__body">
              The TBWC Inc. vision is to create green job opportunities through education.
              To provide the support, training, and expertise that is necessary to mitigate
              risk and deliver practical solutions for facility managers and owners today.
            </p>
          </article>
          <article className="vm__card vm__card--dark">
            <span className="vm__kicker mono">Mission Statement</span>
            <p className="vm__body">
              The mission of TBWC Inc. is to provide technical product application and sales
              consulting services at no additional cost to commercial and industrial end-users,
              through a network of professional electrical, lighting, automation-control
              distributors and contractors throughout the United States.
            </p>
          </article>
        </div>

        <div className="ab-prose">
          <div className="ab-prose__col">
            <span className="ab-prose__stat mono">500<span className="ab-prose__stat-plus">+</span></span>
            <span className="ab-prose__stat-label mono">SKUs in line card</span>
          </div>
          <div className="ab-prose__col ab-prose__col--body">
            <p className="ab-prose__lead">
              TBWC provides our Distributors a one-stop shop for essential and peripheral
              products needed for a submetering / energy management system installation —
              including the items many times forgotten. We also support submeter users and
              installers with pre- and post-installation services to ensure every submeter
              purchased delivers the accurate, reliable data they need:
            </p>
            <ul className="ab-prose__list">
              <li>
                <span className="ab-prose__list-k mono">01</span>
                <div>
                  <strong>Retro-commissioning</strong>
                  <span> — annual meter / submeter system wellness check-ups.</span>
                </div>
              </li>
              <li>
                <span className="ab-prose__list-k mono">02</span>
                <div>
                  <strong>AMR system upgrades</strong>
                  <span> — Automatic Meter Reading updates and 3rd-party service agreements.</span>
                </div>
              </li>
              <li>
                <span className="ab-prose__list-k mono">03</span>
                <div>
                  <strong>Custom dashboards</strong>
                  <span> — load segregation, energy management, Net Zero projects, and more.</span>
                </div>
              </li>
            </ul>
            <p className="ab-prose__body">
              Represented by qualified agencies across North America, TBWC Manufacturer's
              Reps have been providing technical product support, application assistance and
              local expertise for decades. Together with our contractor / installation and
              distribution partners, we work to ensure every submeter project is delivered on
              time, installed within scope, and meets the original budget — above all,
              exceeding your end-user customers' expectations.
            </p>
          </div>
        </div>

        <div className="locs">
             <article className="loc">
            <div className="loc__hd">
              <span className="loc__type">Service Center · CA</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>34.0°N · 117.6°W</span>
            </div>
            <h3 className="loc__title">SoCal Service Center</h3>
            <address className="loc__addr">
              <strong>Bench &amp; RMA</strong><br />
              2591 Lindsay Privado Dr.<br />
              Ontario, CA 91761<br />
              <span className="mono" style={{ fontSize: 13 }}>(888) 562-1810</span>
            </address>
          </article>
        </div>
      </div>
    </section>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot__grid">
          <div className="foot__col foot__brand">
            <a href="#" className="brand">
              <span className="brand__quad" aria-hidden="true">
                <span>T</span><span>B</span><span>W</span><span className="brand__quad-c">C</span>
              </span>
              <span className="brand__lockup">
                <span>Technology</span>
              </span>
            </a>
            <p className="foot__tag">TBWC Technology with precision since 2002.</p>
          </div>
          <div className="foot__col">
            <h4>Products</h4>
            <ul>
              <li><a href="#products">Line card</a></li>
              <li><a href="#">Datasheets</a></li>
              <li><a href="#">Firmware</a></li>
              <li><a href="#">Pricing</a></li>
            </ul>
          </div>
          <div className="foot__col">
            <h4>Support</h4>
            <ul>
              <li><a href="https://tbwctechnology.com/tech-support/" target="_blank" rel="noopener noreferrer">Technical support</a></li>
              <li><a href="#">RMAs</a></li>
              <li><a href="#">4G LTE service</a></li>
              <li><a href="#">Documentation</a></li>
            </ul>
          </div>
          <div className="foot__col">
            <h4>Reps</h4>
            <ul>
              <li><a href="#reps">Become a rep</a></li>
              <li><a href="#">Rep Portal</a></li>
              <li><a href="#">Co-op &amp; SPIFs</a></li>
              <li><a href="#">Territory map</a></li>
            </ul>
          </div>
          <div className="foot__col">
            <h4>Company</h4>
            <ul>
              <li><a href="#about">About</a></li>
              <li><a href="#contact">Contact</a></li>
              <li><a href="#">New customer</a></li>
              <li><a href="#">Careers</a></li>
            </ul>
          </div>
        </div>

        <div className="foot__bot">
          <span>© 2026 TBWC TECHNOLOGY, INC. · ALL RIGHTS RESERVED.</span>
          <span>LAS VEGAS, NV · ONTARIO, CA</span>
        </div>
      </div>
    </footer>
  );
}

// ── CONTACT ───────────────────────────────────────────────────────────────
function Contact() {
  return (
    <section id="contact" className="row">
      <div className="wrap">
        <div className="sec-hd">
          <div className="sec-hd__label">
            <span><span className="sec-hd__num">05</span> · Contact</span>
            <span>Who to email, who to call</span>
          </div>
          <div>
            <h2 className="h2 sec-hd__title">Real people, direct lines.</h2>
            <p className="sec-hd__sub">Quotes, orders, technical support, and AR — routed to the person who handles it, not a help desk.</p>
          </div>
        </div>

        <div className="ct-grid">
          <article className="ct-card ct-card--accent">
            <span className="ct-card__kicker mono">01 · Quotes &amp; Orders</span>
            <div className="ct-row">
              <span className="ct-row__label">Quote requests</span>
              <a className="ct-row__link mono" href="mailto:QUOTES@TBWCinc.com">QUOTES@TBWCinc.com</a>
            </div>
            <div className="ct-row">
              <span className="ct-row__label">Purchase orders</span>
              <a className="ct-row__link mono" href="mailto:ORDERS@TBWCinc.com">ORDERS@TBWCinc.com</a>
            </div>
          </article>

          <article className="ct-card">
            <span className="ct-card__kicker mono">02 · Customer Service &amp; Tech Support</span>
            <div className="ct-row">
              <span className="ct-row__label">Phone</span>
              <a className="ct-row__link mono" href="tel:+18885621810">(888) 562-1810</a>
            </div>
            <p className="ct-card__body">
              If you require technical assistance and would prefer to send an email,
              please complete the Technical Support form and we will get back to you ASAP.
            </p>
            <a className="btn btn--ghost ct-card__btn" href="https://tbwctechnology.com/tech-support/" target="_blank" rel="noopener noreferrer">
              Technical support form <Arrow />
            </a>
          </article>

          <article className="ct-card ct-card--wide">
            <span className="ct-card__kicker mono">03 · Accounts Receivable</span>
            <div className="ct-people">
              <div className="ct-person">
                <strong className="ct-person__name">Jenifer Crenshaw</strong>
                <span className="ct-person__role mono">Administration</span>
                <a className="ct-person__line mono" href="tel:+18179178694">(817) 917-8694</a>
                <a className="ct-person__line mono" href="mailto:Jen@TBWCinc.com">Jen@TBWCinc.com</a>
              </div>
              <div className="ct-person">
                <strong className="ct-person__name">Janelle Blanchard</strong>
                <span className="ct-person__role mono">CFO</span>
                <a className="ct-person__line mono" href="tel:+19512366047">(951) 236-6047</a>
                <a className="ct-person__line mono" href="mailto:Janelle@TBWCinc.com">Janelle@TBWCinc.com</a>
              </div>
              <div className="ct-person">
                <strong className="ct-person__name">General AR</strong>
                <span className="ct-person__role mono">Accounting inbox</span>
                <a className="ct-person__line mono" href="mailto:Accounting@tbwcinc.com">Accounting@tbwcinc.com</a>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Nav, Hero, Stats, Brands, Support, RepsLegacy, Locations, Contact, Footer });
