// app.jsx — TBWC modernized site root

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2A6FDB",
  "type": "geist",
  "density": "regular",
  "dark": false,
  "hero": "A"
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = [
  '#2A6FDB',  // electric cobalt (default)
  '#D9522A',  // industrial orange
  '#1F8A5B',  // forest signal
  '#0A0A0A',  // mono / no accent
];

const TYPE_PRESETS = {
  geist:    { sans: '"Geist"',          mono: '"Geist Mono"',           serif: '"Instrument Serif"', tracking: '-0.02em' },
  schibsted:{ sans: '"Schibsted Grotesk"', mono: '"JetBrains Mono"',    serif: '"Instrument Serif"', tracking: '-0.022em' },
  ibm:      { sans: '"IBM Plex Sans"',  mono: '"IBM Plex Mono"',        serif: '"IBM Plex Serif"',   tracking: '-0.015em' },
};

// inject extra Google Fonts on demand
function ensureFont(family, weights = '300;400;500;600;700') {
  const id = 'gf-' + family.replace(/\s/g, '-');
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s/g, '+')}:wght@${weights}&display=swap`;
  document.head.appendChild(link);
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [portalOpen, setPortalOpen] = React.useState(false);

  // apply theme + accent + type to :root
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = t.dark ? 'dark' : 'light';
    root.dataset.density = t.density;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-ink', '#fff');

    const preset = TYPE_PRESETS[t.type] || TYPE_PRESETS.geist;
    if (t.type === 'schibsted') {
      ensureFont('Schibsted Grotesk');
      ensureFont('JetBrains Mono', '400;500');
    } else if (t.type === 'ibm') {
      ensureFont('IBM Plex Sans');
      ensureFont('IBM Plex Mono', '400;500');
      ensureFont('IBM Plex Serif', '400');
    }
    root.style.setProperty('--f-sans',  `${preset.sans}, ui-sans-serif, system-ui, sans-serif`);
    root.style.setProperty('--f-mono',  `${preset.mono}, ui-monospace, SFMono-Regular, monospace`);
    root.style.setProperty('--f-serif', `${preset.serif}, Georgia, serif`);
  }, [t.dark, t.density, t.accent, t.type]);

  // intersection-based reveal
  React.useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '-50px 0px -50px 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });

  const openPortal = () => setLoginOpen(true);

  return (
    <>
      <Nav onPortalClick={openPortal} />
      <main>
        <Hero variant={t.hero} onPortalClick={openPortal} />
        <Stats />
        <div className="reveal"><Brands onPortalClick={openPortal} /></div>
        <div className="reveal"><RepsMap /></div>
        <div className="reveal"><Locations /></div>
        <div className="reveal"><Contact /></div>
      </main>
      <Footer />

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => { setLoginOpen(false); setPortalOpen(true); }}
      />
      <PortalPreview open={portalOpen} onClose={() => setPortalOpen(false)} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakColor
          label="Accent"
          value={t.accent}
          options={ACCENT_OPTIONS}
          onChange={(v) => setTweak('accent', v)}
        />
        <TweakToggle
          label="Dark mode"
          value={t.dark}
          onChange={(v) => setTweak('dark', v)}
        />

        <TweakSection label="Typography" />
        <TweakSelect
          label="Type pairing"
          value={t.type}
          options={[
            { value: 'geist',     label: 'Geist · Geist Mono · Instrument' },
            { value: 'schibsted', label: 'Schibsted Grotesk · JetBrains' },
            { value: 'ibm',       label: 'IBM Plex Sans · Mono · Serif' },
          ]}
          onChange={(v) => setTweak('type', v)}
        />

        <TweakSection label="Layout" />
        <TweakRadio
          label="Density"
          value={t.density}
          options={['compact', 'regular', 'roomy']}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakRadio
          label="Hero"
          value={t.hero}
          options={[
            { value: 'A', label: 'Editorial' },
            { value: 'B', label: 'Spotlight' },
            { value: 'C', label: 'Centered' },
          ]}
          onChange={(v) => setTweak('hero', v)}
        />

        <TweakSection label="Demo" />
        <TweakButton
          label="Open Rep Portal preview"
          onClick={() => { setLoginOpen(false); setPortalOpen(true); }}
        />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
