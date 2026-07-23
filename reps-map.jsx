// ── REPRESENTATIVES — Directory-first with ZIP lookup & regional grouping ──
const AGENCIES = [
  { id: 'usnw',     name: 'U.S. Northwest',          contact: 'Kevin Adams',     phone: '(503) 624-8293', region: 'Pacific Northwest', territories: 'WA · OR · ID · MT · AK',        states: ['WA','OR','ID','MT','AK'],          logo: 'https://tbwctechnology.com/wp-content/uploads/USNW.png' },
  { id: 'dz',       name: 'DZ Associates',           contact: 'Steve Mobley',    phone: '(510) 293-6810', region: 'Pacific',           territories: 'NV · HI · Northern California',  states: ['NV','HI'],                          logo: 'https://tbwctechnology.com/wp-content/uploads/DZ-e1710094110554-1024x315.png' },
  { id: 'ba',       name: 'BA Sales',                contact: 'James Blanchard', phone: '(909) 974-0111', region: 'Pacific',           territories: 'Southern California',            states: ['CA'],                                logo: 'https://tbwctechnology.com/wp-content/uploads/BA-e1710094190784-1024x825.png' },
  { id: 'intriq',   name: 'Intriq',                  contact: 'Mark Jeffrey',    phone: '(303) 758-5530', region: 'Mountain',          territories: 'CO · UT · WY · NM · AZ',         states: ['CO','UT','WY','NM','AZ'],            logo: 'https://tbwctechnology.com/wp-content/uploads/intriq-1024x545.jpg' },
  { id: 'meglio',   name: 'Meglio Sales',            contact: 'Dave Meglio',     phone: '(314) 524-4424', region: 'Central',           territories: 'MO · KS · NE · ND · SD · AR',    states: ['MO','KS','NE','ND','SD','AR'],       logo: 'https://tbwctechnology.com/wp-content/uploads/meglio-e1710094088378-1024x656.png' },
  { id: 'mercer',   name: 'Mercer & Associates',     contact: 'Steve Mercer',    phone: '(920) 915-6223', region: 'Central',           territories: 'WI · MN · IA',                   states: ['WI','MN','IA'],                      logo: 'https://tbwctechnology.com/wp-content/uploads/Mercer-e1710094071367-1024x431.png' },
  { id: 'am',       name: 'AM Sales',                contact: 'Ray Doerrer',     phone: '(630) 501-0880', region: 'Great Lakes',       territories: 'IL · IN',                        states: ['IL','IN'],                            logo: 'https://tbwctechnology.com/wp-content/uploads/AM-e1710094211761-1024x521.png' },
  { id: 'pt',       name: 'PT Sales',                contact: 'Ken Piron',       phone: '(248) 291-6213', region: 'Great Lakes',       territories: 'MI · OH',                        states: ['MI','OH'],                            logo: 'https://tbwctechnology.com/wp-content/uploads/PT.png' },
  { id: 'invictus', name: 'Invictus',                contact: 'Bill Holton',     phone: '(540) 239-1033', region: 'Mid-Atlantic',      territories: 'KY · WV · TN',                   states: ['KY','WV','TN'],                       logo: 'https://tbwctechnology.com/wp-content/uploads/invictus-1024x298.jpeg' },
  { id: 'phoenix',  name: 'Phoenix Tech',            contact: 'Bob Fern',        phone: '(703) 282-4597', region: 'Mid-Atlantic',      territories: 'VA · MD · DC · DE',              states: ['VA','MD','DC','DE'],                  logo: 'https://tbwctechnology.com/wp-content/uploads/Phoenix-e1710094055127-1024x479.png' },
  { id: 'pollart',  name: 'Pollart Sales',           contact: 'Eric Vogelsong',  phone: '(609) 238-8414', region: 'Mid-Atlantic',      territories: 'NJ · PA',                        states: ['NJ','PA'],                            logo: 'https://tbwctechnology.com/wp-content/uploads/Pollart-e1710094039654-1024x439.png' },
  { id: 'damin',    name: 'Damin Sales',             contact: 'Justin Felber',   phone: '(917) 414-0098', region: 'Northeast',         territories: 'New York',                       states: ['NY'],                                 logo: 'https://tbwctechnology.com/wp-content/uploads/Damin-Sales.png' },
  { id: 'sss',      name: 'SSS — Strategic Sales',   contact: "Jay O'Connor",    phone: '(508) 326-2708', region: 'Northeast',         territories: 'MA · CT · RI · ME · NH · VT',    states: ['MA','CT','RI','ME','NH','VT'],         logo: 'https://tbwctechnology.com/wp-content/uploads/SSS-1024x380.png' },
  { id: 'ues',      name: 'UES Group',               contact: 'Tom Holcombe',    phone: '(336) 803-8338', region: 'Southeast',         territories: 'NC · SC · GA · FL · AL · MS',    states: ['NC','SC','GA','FL','AL','MS'],         logo: 'https://tbwctechnology.com/wp-content/uploads/UES-e1710093979574-1024x377.png' },
  { id: 'bellmccoy',name: 'Bell & McCoy',            contact: 'Scott Thomas',    phone: '(972) 489-2879', region: 'South Central',     territories: 'TX · LA · OK',                   states: ['TX','LA','OK'],                       logo: 'https://tbwctechnology.com/wp-content/uploads/Bell-and-Mccoy-e1710094170962-1024x433.png' },
];

const REGIONS = ['Pacific Northwest', 'Pacific', 'Mountain', 'Central', 'Great Lakes', 'South Central', 'Southeast', 'Mid-Atlantic', 'Northeast'];

const STATE_TO_AGENCY = (() => {
  const m = {};
  AGENCIES.forEach(a => a.states.forEach(s => { m[s] = a.id; }));
  return m;
})();

// First-digit ZIP → likely state. Best-effort.
const ZIP_TO_STATE = {
  '0': ['MA','RI','NH','ME','VT','CT','NJ'],
  '1': ['NY','PA','DE'],
  '2': ['DC','VA','MD','NC','SC','WV'],
  '3': ['FL','GA','AL','TN','MS'],
  '4': ['KY','OH','IN','MI'],
  '5': ['IA','WI','MN','MT','ND','SD'],
  '6': ['IL','MO','KS','NE'],
  '7': ['AR','LA','OK','TX'],
  '8': ['CO','WY','ID','UT','AZ','NM','NV'],
  '9': ['CA','OR','WA','AK','HI'],
};

function findAgencyByZip(zip) {
  const d = zip.trim()[0];
  if (!d || !ZIP_TO_STATE[d]) return null;
  for (const st of ZIP_TO_STATE[d]) {
    if (STATE_TO_AGENCY[st]) return { state: st, agency: STATE_TO_AGENCY[st] };
  }
  return null;
}

function AgencyCard({ a, highlighted, onClick }) {
  return (
    <article className={'agency' + (highlighted ? ' agency--hl' : '')} onClick={onClick}>
      <div className="agency__logo">
        {a.logo ? <img src={a.logo} alt={a.name + ' logo'} loading="lazy" /> : <span className="mono">{a.name.split(/\s+/).slice(0,2).map(w=>w[0]).join('')}</span>}
      </div>
      <div className="agency__body">
        <div className="agency__hd">
          <h4 className="agency__name">{a.name}</h4>
          <span className="agency__states mono">{a.states.join(' · ')}</span>
        </div>
        <div className="agency__terr">{a.territories}</div>
        <div className="agency__contact">
          <div className="agency__person">
            <span className="agency__person-name">{a.contact}</span>
            <span className="agency__person-role mono">Lead Rep</span>
          </div>
          <div className="agency__actions">
            <a className="agency__phone mono" href={`tel:${a.phone.replace(/\D/g,'')}`} onClick={(e)=>e.stopPropagation()}>{a.phone}</a>
            <a className="agency__email mono" href="https://tbwctechnology.com/contacttbwc/" target="_blank" rel="noopener noreferrer" onClick={(e)=>e.stopPropagation()}>Email →</a>
          </div>
        </div>
      </div>
    </article>
  );
}

function RepsMap() {
  const [zip, setZip] = React.useState('');
  const [match, setMatch] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [activeAgency, setActiveAgency] = React.useState(null);

  const onZip = (e) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip.trim())) { setMatch({ err: 'Enter a 5-digit ZIP.' }); return; }
    const hit = findAgencyByZip(zip);
    if (hit) setMatch({ agency: AGENCIES.find(a => a.id === hit.agency), state: hit.state });
    else setMatch({ err: 'No direct match — browse the directory below.' });
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? AGENCIES.filter(a => (a.name + ' ' + a.contact + ' ' + a.territories + ' ' + a.states.join(' ')).toLowerCase().includes(q))
    : AGENCIES;
  const grouped = REGIONS.map(r => [r, filtered.filter(a => a.region === r)]).filter(([, list]) => list.length);

  return (
    <section id="reps" className="row">
      <div className="wrap">
        <div className="sec-hd">
          <div className="sec-hd__label">
            <span><span className="sec-hd__num">03</span> · Representatives</span>
            <span>15 agencies · 50 states</span>
          </div>
          <div>
            <h2 className="h2 sec-hd__title">Find your rep.<br />Two ways in.</h2>
            <p className="sec-hd__sub">Enter a ZIP to route instantly, or browse by region. Every agency is technically qualified, locally staffed, and on the line card today.</p>
          </div>
        </div>

        {/* ZIP hero band */}
        <div className="repfind">
          <form className="repfind__form" onSubmit={onZip}>
            <label className="repfind__label mono">Find representative near me</label>
            <div className="repfind__input-row">
              <input
                className="repfind__input"
                inputMode="numeric"
                maxLength={5}
                placeholder="90001"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g,'').slice(0,5))}
                aria-label="Project ZIP"
              />
              <button type="submit" className="btn btn--accent">Route me <Arrow /></button>
            </div>
          </form>

          <div className="repfind__result">
            {!match && <div className="repfind__hint mono">Routing happens client-side — no form to fill out.</div>}
            {match?.err && <div className="repfind__hint repfind__hint--err mono">{match.err}</div>}
            {match?.agency && (
              <div className="repfind__hit">
                <div className="repfind__hit-eyebrow mono">Your representative · {match.state}</div>
                <AgencyCard a={match.agency} highlighted />
              </div>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="repbar">
          <input
            className="repbar__input"
            placeholder="Search by name, contact, state, or territory…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search agencies"
          />
          <div className="repbar__count mono">
            {filtered.length} of {AGENCIES.length} {filtered.length === 1 ? 'agency' : 'agencies'}
          </div>
        </div>

        {/* Regional groupings */}
        <div className="repdir">
          {grouped.map(([region, list]) => (
            <div className="repgrp" key={region}>
              <div className="repgrp__hd">
                <span className="repgrp__hd-name">{region}</span>
                <span className="repgrp__hd-count mono">{list.length} {list.length === 1 ? 'agency' : 'agencies'}</span>
                <span className="repgrp__hd-states mono">{[...new Set(list.flatMap(a => a.states))].join(' · ')}</span>
              </div>
              <div className="repgrp__grid">
                {list.map(a => <AgencyCard key={a.id} a={a} highlighted={activeAgency === a.id} onClick={() => setActiveAgency(activeAgency === a.id ? null : a.id)} />)}
              </div>
            </div>
          ))}
          {!grouped.length && (
            <div className="repdir__empty mono">No agencies match "{query}". Try a state code or partial name.</div>
          )}
        </div>

        {/* New-rep callout */}
        <div className="rmap__newrep">
          <div className="rmap__newrep-l">
            <div className="kicker"><span className="num">/16</span> &nbsp; Become a representative</div>
            <h3 className="h2" style={{ fontSize: 'clamp(24px, 2.4vw, 36px)', marginTop: 6 }}>Looking to add TBWC to your line card?</h3>
          </div>
          <div className="rmap__newrep-r">
            <p className="body" style={{ fontSize: 15, color: 'var(--ink-2)', maxWidth: '46ch' }}>
              Submit your agency for review. Most applications are approved within one business day with portal credentials and a dedicated account manager.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a className="btn btn--accent" href="https://tbwctechnology.com/newrep-request/" target="_blank" rel="noopener noreferrer">Registration request <Arrow /></a>
              <a className="btn btn--ghost" href="https://tbwctechnology.com/contacttbwc/" target="_blank" rel="noopener noreferrer">Talk to a person</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { RepsMap });
