/** Top-left brand lockup: full wordmark on large viewports, F mark only when narrow. */
export function FetyLogo() {
  return (
    <div className="fety-logo" aria-label="Fety">
      <span className="fety-logo-mark" aria-hidden>
        F
      </span>
      <span className="fety-logo-word">Fety</span>
    </div>
  );
}
