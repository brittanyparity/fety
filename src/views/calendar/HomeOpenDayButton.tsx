export default function HomeOpenDayButton({
  dateISO,
  onOpen,
  label,
  className,
}: {
  dateISO: string;
  onOpen: (dateISO: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`fety-home-open-day-btn${className ? ` ${className}` : ""}`}
      aria-label={`Open ${dateISO} in daily calendar view`}
      title="Open in daily view"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(dateISO);
      }}
    >
      {label ? <span className="fety-home-open-day-btn-label">{label}</span> : null}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
        />
      </svg>
    </button>
  );
}
