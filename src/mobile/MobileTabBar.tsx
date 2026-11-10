import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { MobileTabIcon } from "./MobileNavIcons";
import type { MobileTab } from "./types";

const TABS: { id: MobileTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "budget", label: "Budget" },
  { id: "transactions", label: "Spending" },
  { id: "insights", label: "Insights" },
  { id: "goals", label: "Goals" },
];

export default function MobileTabBar({
  active,
  onChange,
}: {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}) {
  const pillRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [slider, setSlider] = useState({ width: 0, x: 0 });

  const measureSlider = useCallback(() => {
    const index = TABS.findIndex((t) => t.id === active);
    const btn = btnRefs.current[index];
    const pill = pillRef.current;
    if (!btn || !pill || index < 0) return;
    const pillRect = pill.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setSlider({
      width: btnRect.width,
      x: btnRect.left - pillRect.left,
    });
  }, [active]);

  useLayoutEffect(() => {
    measureSlider();
    const pill = pillRef.current;
    if (!pill) return;
    const ro = new ResizeObserver(measureSlider);
    ro.observe(pill);
    window.addEventListener("resize", measureSlider);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureSlider);
    };
  }, [measureSlider]);

  const sliderStyle: CSSProperties = {
    width: slider.width > 0 ? slider.width : 0,
    transform: slider.width > 0 ? `translateX(${slider.x}px)` : "translateX(0)",
    opacity: slider.width > 0 ? 1 : 0,
  };

  return (
    <nav className="fety-mobile-tab-bar" aria-label="Main">
      <div ref={pillRef} className="fety-mobile-tab-bar-pill">
        <div className="fety-mobile-tab-bar-slider" style={sliderStyle} aria-hidden />
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              btnRefs.current[index] = el;
            }}
            type="button"
            className={`fety-mobile-tab-bar-btn${active === tab.id ? " fety-mobile-tab-bar-btn--active" : ""}`}
            aria-current={active === tab.id ? "page" : undefined}
            onClick={() => onChange(tab.id)}
          >
            <span className="fety-mobile-tab-bar-icon" aria-hidden>
              <MobileTabIcon tab={tab.id} />
            </span>
            <span className="fety-mobile-tab-bar-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
