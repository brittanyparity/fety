import type { MobileTab } from "./types";

const TABS: { id: MobileTab; label: string; icon: string }[] = [
  { id: "transactions", label: "Transactions", icon: "↕" },
  { id: "budget", label: "Budget", icon: "◎" },
  { id: "insights", label: "Insights", icon: "◈" },
  { id: "home", label: "Home", icon: "⌂" },
  { id: "goals", label: "Goals", icon: "★" },
];

export default function MobileTabBar({
  active,
  onChange,
}: {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}) {
  return (
    <nav className="fety-mobile-tab-bar" aria-label="Main">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`fety-mobile-tab-bar-btn${active === tab.id ? " fety-mobile-tab-bar-btn--active" : ""}`}
          aria-current={active === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          <span className="fety-mobile-tab-bar-icon" aria-hidden>
            {tab.icon}
          </span>
          <span className="fety-mobile-tab-bar-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
