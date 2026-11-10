import type { MobileTab } from "./types";

const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function MobileTabIcon({ tab, size = 20 }: { tab: MobileTab; size?: number }) {
  switch (tab) {
    case "home":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...common}>
          <path d="m3 9.75 9-6.75 9 6.75V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V9.75Z" />
          <path d="M9 21.5V12h6v9.5" />
        </svg>
      );
    case "transactions":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...common}>
          <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      );
    case "budget":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...common}>
          <path d="M21 7.5V18a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18V7.5m18 0A2.25 2.25 0 0 0 18.75 5.25H5.25A2.25 2.25 0 0 0 3 7.5m18 0H3" />
        </svg>
      );
    case "insights":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...common}>
          <path d="M3 19.5V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25V19.5M7.5 16.5h9" />
          <path d="M8.25 12h7.5M8.25 8.25h4.5" />
        </svg>
      );
    case "goals":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...common}>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.25v2.25M12 19.5v2.25M2.25 12h2.25M19.5 12h2.25" />
        </svg>
      );
    default:
      return null;
  }
}

export function MobileSettingsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="fety-mobile-settings-icon">
      <path
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.282c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function MobileFilterIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...common}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

export function MobileListTagIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="fety-mobile-list-tag-icon">
      <path
        d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v13.5A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V14.432"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="m16.5 3 4.5 4.5M12 12.75 19.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
