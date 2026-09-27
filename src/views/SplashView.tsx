import { useState, type FormEvent } from "react";
import { FetyLogo } from "../FetyLogo";

type SplashMode = "home" | "login";

const FEATURES = [
  {
    title: "Retroactive cash flow",
    body: "See what your balance actually was on any day — then project forward from bills, income, and real transactions.",
  },
  {
    title: "Calendar-first money",
    body: "Month, week, and year views that show ending balances and scheduled money before it hits.",
  },
  {
    title: "Conversational books",
    body: "Log spending in plain language. Fety confirms before it writes — you stay in control.",
  },
  {
    title: "Budgets that stick",
    body: "Category caps, goals, and net worth in one place so spending power is never a guess.",
  },
] as const;

export default function SplashView({
  onSignUp,
}: {
  onSignUp: () => void;
}) {
  const [mode, setMode] = useState<SplashMode>("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginNote, setLoginNote] = useState<string | null>(null);

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoginNote(
      "Cloud accounts arrive with security and database work. For now, set up on this device — your data stays local.",
    );
  };

  return (
    <div className="fety-splash">
      <header className="fety-splash-nav">
        <FetyLogo />
        <div className="fety-splash-nav-actions">
          {mode === "home" ? (
            <>
              <button type="button" className="fety-splash-link" onClick={() => setMode("login")}>
                Log in
              </button>
              <button type="button" className="fety-splash-btn-primary" onClick={onSignUp}>
                Sign up
              </button>
            </>
          ) : (
            <button
              type="button"
              className="fety-splash-link"
              onClick={() => {
                setMode("home");
                setLoginNote(null);
              }}
            >
              Back
            </button>
          )}
        </div>
      </header>

      {mode === "home" ? (
        <>
          <section className="fety-splash-hero" aria-label="Fety introduction">
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
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
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
