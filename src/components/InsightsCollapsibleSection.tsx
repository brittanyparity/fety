import { useCallback, useState, type ReactNode } from "react";

function readCollapsed(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function CollapseChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={open ? "fety-insights-chevron fety-insights-chevron-open" : "fety-insights-chevron"}
      aria-hidden
    >
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function InsightsCollapsibleSection({
  storageKey,
  title,
  ariaLabel,
  headerEnd,
  children,
}: {
  storageKey: string;
  title: string;
  ariaLabel: string;
  headerEnd?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey));

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [storageKey]);

  return (
    <section
      className={`fety-insights-charts-section${collapsed ? " fety-insights-charts-section--collapsed" : ""}`}
      aria-label={ariaLabel}
    >
      <div className="fety-insights-charts-header">
        <button
          type="button"
          className="fety-insights-collapse"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onClick={toggle}
        >
          <CollapseChevron open={!collapsed} />
        </button>
        <h2 className="fety-insights-charts-title">{title}</h2>
        <div className="fety-insights-charts-header-spacer" />
        {headerEnd}
      </div>
      {!collapsed ? <div className="fety-insights-feed-body">{children}</div> : null}
    </section>
  );
}
