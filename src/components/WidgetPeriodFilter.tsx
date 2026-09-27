export type PeriodOption<T extends string> = { id: T; label: string };

/** Compact period chips for dashboard widgets (not a card — just a control row). */
export default function WidgetPeriodFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = "Period",
}: {
  options: readonly PeriodOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="fety-widget-period" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            className={`fety-widget-period-btn${active ? " fety-widget-period-btn-active" : ""}`}
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
