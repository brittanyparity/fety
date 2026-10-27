import CalendarNoteIcon from "../../components/CalendarNoteIcon";

const LEGEND_ITEMS = [
  {
    label: "Positive balance",
    swatch: "rgba(145, 216, 182, 0.55)",
  },
  {
    label: "Zero balance",
    swatch: "rgba(255, 217, 107, 0.58)",
  },
  {
    label: "Negative balance",
    swatch: "rgba(255, 111, 94, 0.5)",
  },
  {
    label: "Selected day",
    swatch: "var(--ink)",
  },
  {
    label: "Notes",
    noteIcon: true,
  },
] as const;

export default function HomeCalendarColorKey() {
  return (
    <div className="fety-home-calendar-legend" aria-label="Calendar color key">
      <span className="fety-home-calendar-legend-heading">Key</span>
      <ul className="fety-home-calendar-legend-list">
        {LEGEND_ITEMS.map((item) => (
          <li key={item.label}>
            {"noteIcon" in item && item.noteIcon ? (
              <span className="fety-home-calendar-legend-note-mark" aria-hidden>
                <CalendarNoteIcon size={11} />
              </span>
            ) : (
              <span
                className="fety-home-calendar-legend-swatch"
                style={{ background: "swatch" in item ? item.swatch : undefined }}
                aria-hidden
              />
            )}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
