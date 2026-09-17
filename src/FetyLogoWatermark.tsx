/** Structural mark from the Fety brand — repeated F at 10% with one solid F in front. */
export function FetyLogoWatermark() {
  const row = "F ".repeat(14);

  return (
    <div className="fety-watermark" aria-hidden>
      <div className="fety-watermark-field">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>{row}</div>
        ))}
      </div>
      <div className="fety-watermark-solid">F</div>
    </div>
  );
}
