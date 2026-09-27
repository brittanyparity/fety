import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

type SplashMode = "home" | "login";

const FEATURES = [
  {
    title: "Retroactive cash flow",
    body: "See what your balance actually was on any day — then project forward from bills, income, and real transactions.",
    visual: "timeline" as const,
  },
  {
    title: "Calendar-first money",
    body: "Month, week, and year views that show ending balances and scheduled money before it hits.",
    visual: "calendar" as const,
  },
  {
    title: "Conversational books",
    body: "Log spending in plain language. Fety confirms before it writes — you stay in control.",
    visual: "chat" as const,
  },
  {
    title: "Budgets that stick",
    body: "Category caps, goals, and net worth in one place so spending power is never a guess.",
    visual: "budget" as const,
  },
] as const;

function FeatureVisual({ kind }: { kind: (typeof FEATURES)[number]["visual"] }) {
  if (kind === "timeline") {
    return (
      <div className="fety-splash-viz fety-splash-viz-timeline" aria-hidden>
        <svg viewBox="0 0 280 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 98 C48 98 52 42 88 42 C124 42 128 110 164 110 C200 110 208 28 244 28 C256 28 264 36 268 48"
            stroke="var(--ink)"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.2"
          />
          <path
            d="M12 98 C48 98 52 42 88 42 C124 42 128 110 164 110 C200 110 208 28 244 28"
            stroke="var(--clear-dk)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="88" cy="42" r="5" fill="var(--clear)" stroke="var(--clear-dk)" strokeWidth="1.5" />
          <circle cx="164" cy="110" r="5" fill="var(--trouble)" stroke="var(--trouble-dk)" strokeWidth="1.5" />
          <circle cx="244" cy="28" r="5" fill="var(--lime)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="78" y="28" fontSize="9" fill="var(--ink-3)" fontFamily="var(--font-mono)">Mar 12</text>
          <text x="154" y="128" fontSize="9" fill="var(--ink-3)" fontFamily="var(--font-mono)">Apr 1</text>
          <text x="228" y="16" fontSize="9" fill="var(--ink-3)" fontFamily="var(--font-mono)">Today</text>
        </svg>
      </div>
    );
  }

  if (kind === "calendar") {
    const cells = [
      0, 0, 1, 1, 1, 1, 0,
      1, 1, 1, 0, 1, 1, 1,
      1, 0, 1, 1, 1, 0, 1,
      1, 1, 0, 1, 1, 1, 0,
    ];
    return (
      <div className="fety-splash-viz fety-splash-viz-calendar" aria-hidden>
        <div className="fety-splash-viz-cal-dow">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>
        <div className="fety-splash-viz-cal-grid">
          {cells.map((on, i) => (
            <span
              key={i}
              className={`fety-splash-viz-cal-cell${on ? " fety-splash-viz-cal-cell--on" : ""}${i === 16 ? " fety-splash-viz-cal-cell--sel" : ""}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (kind === "chat") {
    return (
      <div className="fety-splash-viz fety-splash-viz-chat" aria-hidden>
        <div className="fety-splash-viz-bubble fety-splash-viz-bubble--user">Groceries at Whole Foods, about $52.</div>
        <div className="fety-splash-viz-bubble fety-splash-viz-bubble--bot">
          Logged to Groceries. Confirm?
          <span className="fety-splash-viz-chip">Confirm</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fety-splash-viz fety-splash-viz-budget" aria-hidden>
      {[
        { label: "Groceries", pct: 62, tone: "ok" },
        { label: "Dining", pct: 88, tone: "warn" },
        { label: "Shopping", pct: 104, tone: "over" },
      ].map((row) => (
        <div key={row.label} className="fety-splash-viz-budget-row">
          <div className="fety-splash-viz-budget-meta">
            <span>{row.label}</span>
            <span>{Math.min(row.pct, 100)}%</span>
          </div>
          <div className="fety-splash-viz-budget-track">
            <div
              className={`fety-splash-viz-budget-fill fety-splash-viz-budget-fill--${row.tone}`}
              style={{ width: `${Math.min(row.pct, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SplashView({
  onSignUp,
}: {
  onSignUp: () => void;
}) {
  const [mode, setMode] = useState<SplashMode>("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginNote, setLoginNote] = useState<string | null>(null);
  const [pastHero, setPastHero] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || mode !== "home") {
      setPastHero(mode === "login");
      return;
    }

    const update = () => {
      const bottom = hero.getBoundingClientRect().bottom;
      setPastHero(bottom <= 72);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [mode]);

  useEffect(() => {
    if (!pastHero) setMenuOpen(false);
  }, [pastHero]);

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoginNote(
      "Cloud accounts arrive with security and database work. For now, set up on this device — your data stays local.",
    );
  };

  const showChrome = mode === "login" || pastHero;

  let navTrailing: ReactNode = null;
  if (mode === "login") {
    navTrailing = (
      <button
        type="button"
        className="fety-splash-link"
        onClick={() => {
          setMode("home");
          setLoginNote(null);
          setMenuOpen(false);
        }}
      >
        Back
      </button>
    );
  } else if (pastHero) {
    navTrailing = (
      <button
        type="button"
        className="fety-splash-hamburger"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        {menuOpen ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className="fety-splash">
      <header
        className={`fety-splash-nav${showChrome ? " fety-splash-nav--solid" : " fety-splash-nav--clear"}`}
      >
        {showChrome ? (
          <span className="fety-splash-nav-mark" aria-label="Fety">
            F
          </span>
        ) : (
          <span className="fety-splash-nav-spacer" aria-hidden />
        )}
        <div className="fety-splash-nav-actions">{navTrailing}</div>
        {mode === "home" && pastHero && menuOpen && (
          <>
            <button
              type="button"
              className="fety-splash-menu-backdrop"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <nav className="fety-splash-menu" aria-label="Splash menu">
              <button
                type="button"
                className="fety-splash-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  setMode("login");
                }}
              >
                Log in
              </button>
              <button
                type="button"
                className="fety-splash-menu-item fety-splash-menu-item--primary"
                onClick={() => {
                  setMenuOpen(false);
                  onSignUp();
                }}
              >
                Sign up
              </button>
            </nav>
          </>
        )}
      </header>

      {mode === "home" ? (
        <>
          <section ref={heroRef} className="fety-splash-hero" aria-label="Fety introduction">
            <div className="fety-splash-hero-copy">
              <p className="fety-splash-brand">Fety</p>
              <h1 className="fety-splash-headline">Money with a memory.</h1>
              <p className="fety-splash-lede">
                A retroactive cash-flow system that tracks what you had, what is coming, and what you can still spend.
              </p>
              <div className="fety-splash-cta">
                <button type="button" className="fety-splash-btn-primary fety-splash-btn-lg" onClick={onSignUp}>
                  Get started
                </button>
                <button type="button" className="fety-splash-btn-ghost fety-splash-btn-lg" onClick={() => setMode("login")}>
                  Log in
                </button>
              </div>
            </div>

            <div className="fety-splash-hero-visual" aria-hidden>
              <div className="fety-splash-orbit fety-splash-orbit-a" />
              <div className="fety-splash-orbit fety-splash-orbit-b" />
              <div className="fety-splash-ledger">
                <div className="fety-splash-ledger-row fety-splash-ledger-row--head">
                  <span>Today</span>
                  <span>Balance</span>
                </div>
                <div className="fety-splash-ledger-row">
                  <span>Paycheck</span>
                  <span className="fety-splash-pos">+$2,800</span>
                </div>
                <div className="fety-splash-ledger-row">
                  <span>Rent</span>
                  <span className="fety-splash-neg">−$2,000</span>
                </div>
                <div className="fety-splash-ledger-row">
                  <span>Groceries</span>
                  <span className="fety-splash-neg">−$52</span>
                </div>
                <div className="fety-splash-ledger-row fety-splash-ledger-row--total">
                  <span>Ending</span>
                  <span>$2,612</span>
                </div>
              </div>
            </div>
          </section>

          <section className="fety-splash-features" id="features" aria-labelledby="fety-features-heading">
            <h2 id="fety-features-heading" className="fety-splash-features-title">
              Built for how money actually moves
            </h2>
            <p className="fety-splash-features-sub">
              Not another envelope spreadsheet — a living timeline of cash in and out.
            </p>
            <ul className="fety-splash-feature-list">
              {FEATURES.map((f) => (
                <li key={f.title} className="fety-splash-feature">
                  <FeatureVisual kind={f.visual} />
                  <div className="fety-splash-feature-copy">
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <footer className="fety-splash-footer">
            <p>Fety keeps your books on this device until you choose cloud sync.</p>
            <button type="button" className="fety-splash-btn-primary" onClick={onSignUp}>
              Create your setup
            </button>
          </footer>
        </>
      ) : (
        <section className="fety-splash-login" aria-label="Log in">
          <h1 className="fety-splash-login-title">Welcome back</h1>
          <p className="fety-splash-login-lede">
            Sign in when cloud accounts ship. Until then, continue with a local setup on this device.
          </p>
          <form className="fety-splash-login-form" onSubmit={handleLoginSubmit}>
            <label className="fety-splash-field">
              <span className="fety-label">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="fety-splash-field">
              <span className="fety-label">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            {loginNote && <p className="fety-splash-login-note" role="status">{loginNote}</p>}
            <button type="submit" className="fety-splash-btn-primary fety-splash-btn-lg" style={{ width: "100%" }}>
              Log in
            </button>
            <button type="button" className="fety-splash-btn-ghost fety-splash-btn-lg" style={{ width: "100%" }} onClick={onSignUp}>
              Set up on this device
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
