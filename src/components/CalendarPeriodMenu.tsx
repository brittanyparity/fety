import { useEffect, useRef, useState } from "react";

type CalView = "monthly" | "weekly" | "biweekly" | "daily" | "yearly";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function mondayOfWeek(d: Date): Date {
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  mon.setHours(12, 0, 0, 0);
  return mon;
}

function formatWeekRange(mon: Date): string {
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sun.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatBiweekRange(mon: Date): string {
  const end = new Date(mon);
  end.setDate(mon.getDate() + 13);
  return `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function calendarPeriodLabel(calView: CalView, focusDate: Date, year: number): string {
  if (calView === "daily") {
    return focusDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  if (calView === "yearly") return String(year);
  if (calView === "weekly") return formatWeekRange(mondayOfWeek(focusDate));
  if (calView === "biweekly") return formatBiweekRange(mondayOfWeek(focusDate));
  return `${focusDate.toLocaleDateString("en-US", { month: "long" })} ${focusDate.getFullYear()}`;
}

export function CalendarPeriodMenu({
  calView,
  focusDate,
  year,
  onFocusDate,
}: {
  calView: CalView;
  focusDate: Date;
  year: number;
  onFocusDate: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = calendarPeriodLabel(calView, focusDate, year);

  const menuStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)",
    minWidth: 160,
    maxHeight: 280,
    overflowY: "auto",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    zIndex: 20,
    padding: 6,
  };

  const itemBtn = (active: boolean): React.CSSProperties => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 8,
    border: "none",
    background: active ? "var(--bg)" : "transparent",
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: active ? 600 : 500,
    color: "var(--ink)",
  });

  let items: { key: string; label: string; date: Date }[] = [];

  if (calView === "monthly") {
    items = MONTH_ABBR.map((abbr, i) => ({
      key: String(i),
      label: abbr,
      date: new Date(focusDate.getFullYear(), i, Math.min(focusDate.getDate(), new Date(focusDate.getFullYear(), i + 1, 0).getDate())),
    }));
  } else if (calView === "yearly") {
    const y0 = year - 5;
    items = Array.from({ length: 11 }, (_, i) => {
      const y = y0 + i;
      return { key: String(y), label: String(y), date: new Date(y, focusDate.getMonth(), focusDate.getDate()) };
    });
  } else if (calView === "weekly") {
    const base = mondayOfWeek(focusDate);
    items = Array.from({ length: 12 }, (_, i) => {
      const mon = new Date(base);
      mon.setDate(base.getDate() + (i - 6) * 7);
      return { key: mon.toISOString(), label: formatWeekRange(mon), date: mon };
    });
  } else if (calView === "biweekly") {
    const base = mondayOfWeek(focusDate);
    items = Array.from({ length: 10 }, (_, i) => {
      const mon = new Date(base);
      mon.setDate(base.getDate() + (i - 5) * 14);
      return { key: mon.toISOString(), label: formatBiweekRange(mon), date: mon };
    });
  } else if (calView === "daily") {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    items = Array.from({ length: 21 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - 10 + i);
      return {
        key: d.toISOString(),
        label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
        date: d,
      };
    });
  }

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 140 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink)",
          minWidth: 140,
          textAlign: "center",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: 8,
        }}
      >
        {label}
      </button>
      {open && items.length > 0 && (
        <div style={menuStyle} role="listbox">
          {items.map((it) => {
            const active =
              calView === "monthly"
                ? it.date.getMonth() === focusDate.getMonth()
                : calView === "yearly"
                  ? it.date.getFullYear() === year
                  : calView === "daily"
                    ? it.date.toDateString() === focusDate.toDateString()
                    : mondayOfWeek(it.date).toDateString() === mondayOfWeek(focusDate).toDateString();
            return (
              <button
                key={it.key}
                type="button"
                style={itemBtn(active)}
                onClick={() => {
                  onFocusDate(it.date);
                  setOpen(false);
                }}
              >
                {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
