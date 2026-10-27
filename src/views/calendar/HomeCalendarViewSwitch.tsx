import { CALENDAR_VIEW_OPTIONS, type CalView } from "../../lib/calendarView";

export default function HomeCalendarViewSwitch({
  value,
  onChange,
}: {
  value: CalView;
  onChange: (view: CalView) => void;
}) {
  const activeIndex = CALENDAR_VIEW_OPTIONS.findIndex((v) => v.id === value);
  const index = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div className="fety-home-calendar-view-segment" role="tablist" aria-label="Calendar view">
      <div
        className="fety-home-calendar-view-segment-track"
        style={{
          ["--cal-view-index" as string]: index,
          ["--cal-view-count" as string]: CALENDAR_VIEW_OPTIONS.length,
        }}
      >
        <span className="fety-home-calendar-view-segment-pill" aria-hidden />
        {CALENDAR_VIEW_OPTIONS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={value === v.id}
            className="fety-home-calendar-view-segment-btn"
            onClick={() => onChange(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
