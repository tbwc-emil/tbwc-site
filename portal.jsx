// portal.jsx — login modal + Rep Portal dashboard preview overlay

function LoginModal({ open, onClose, onSuccess }) {
  const [email, setEmail] = React.useState('');
  const [pass, setPass] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => { setBusy(false); onSuccess(); }, 750);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Sign in to Rep Portal">
        <button className="modal__close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <div>
          <div className="kicker" style={{ marginBottom: 12 }}>
            <span className="num">/01</span> &nbsp; Rep Portal · v3.2
          </div>
          <h2 style={{ fontSize: 28, letterSpacing: '-0.022em', fontWeight: 500, lineHeight: 1.1 }}>
            Sign in to your<br />agency account.
          </h2>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="field">
            <label htmlFor="lm-email">Email</label>
            <input id="lm-email" type="email" autoFocus required
                   value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="you@agency.com" />
          </div>
          <div className="field">
            <label htmlFor="lm-pass">Password</label>
            <input id="lm-pass" type="password" required
                   value={pass} onChange={(e) => setPass(e.target.value)}
                   placeholder="••••••••" />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
            <button type="submit" className="btn btn--primary" style={{ flex: 1, justifyContent: 'center' }} disabled={busy}>
              {busy ? 'Signing in…' : <>Sign in <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, opacity: 0.6 }}>↵</span></>}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-3)' }}>
            <a href="#" style={{ color: 'inherit' }}>Forgot password?</a>
            <a href="#" style={{ color: 'inherit' }}>Request access →</a>
          </div>
        </form>
      </div>
    </div>
  );
}

function PortalPreview({ open, onClose }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="portal" role="dialog" aria-label="Rep Portal preview">
      <div className="portal__head">
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <span className="brand">
            <span className="brand__mark">TBWC</span>
            <span className="brand__sub">Rep Portal</span>
          </span>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-3)', padding: '4px 10px', border: 'var(--rule-w) solid var(--rule)', borderRadius: 999 }}>
            DEMO · Pacific Tech Reps
          </span>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>
          ← Back to site
        </button>
      </div>
      <div className="portal__body">
        <div className="portal__grid">
          <div className="portal__welcome">
            <div>
              <div className="kicker" style={{ marginBottom: 12 }}>
                <span className="num">●</span> &nbsp; Q2 · Day 38
              </div>
              <h2>Welcome back, Marcus.</h2>
              <p className="body" style={{ marginTop: 12, fontSize: 16, color: 'var(--ink-2)', maxWidth: '52ch' }}>
                You're at <strong style={{ color: 'var(--ink)' }}>112%</strong> of quarter target. Three deals are awaiting your sign-off in the queue.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--ghost btn--sm">Reports</button>
              <button className="btn btn--accent btn--sm">New order <span>→</span></button>
            </div>
          </div>

          <div className="portal__tile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3>Q2 Booked</h3>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>USD</span>
            </div>
            <div className="portal__tile-num">$1.84M</div>
            <div className="portal__tile-meta">
              <span>vs Q1</span>
              <span className="up">▲ 18.4%</span>
            </div>
          </div>

          <div className="portal__tile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3>Open RMAs</h3>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>active</span>
            </div>
            <div className="portal__tile-num">7</div>
            <div className="portal__tile-meta">
              <span>2 advance-shipped</span>
              <span>review →</span>
            </div>
          </div>

          <div className="portal__tile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3>Co-op available</h3>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Q2</span>
            </div>
            <div className="portal__tile-num">$24,750</div>
            <div className="portal__tile-meta">
              <span>Expires Jun 30</span>
              <span>claim →</span>
            </div>
          </div>

          <div className="portal__tile" style={{ gridColumn: 'span 2', minHeight: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3>Recent orders</h3>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Last 7 days</span>
            </div>
            <ul className="portal__list">
              {[
                { ord: 'TB-29481', nm: 'Halcyon Networks · 24-port switch ×8', amt: '$14,280' },
                { ord: 'TB-29479', nm: 'Sentinel Power · 3kVA UPS ×2',         amt: '$8,940'  },
                { ord: 'TB-29475', nm: 'Foundry Cabling · OM4 spool ×40',      amt: '$3,612'  },
                { ord: 'TB-29470', nm: 'Polaris Wireless · LTE gateway ×6',    amt: '$11,160' },
                { ord: 'TB-29466', nm: 'Northwind Audio · DSP rack',           amt: '$22,400' },
              ].map((o) => (
                <li key={o.ord}>
                  <span className="ord">{o.ord}</span>
                  <span className="nm">{o.nm}</span>
                  <span className="mono">{o.amt}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="portal__tile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3>Quick actions</h3>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
              {['New order', 'Open an RMA', 'Register a deal', 'Activate LTE device', 'Download datasheet'].map((a) => (
                <a key={a} href="#" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 6, border: 'var(--rule-w) solid var(--rule)', fontSize: 13, color: 'var(--ink-2)' }}>
                  <span>{a}</span><span>→</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginModal, PortalPreview });
