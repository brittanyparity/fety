import { useEffect, useState } from "react";

/** Matches mobile chrome in `src/index.css` (hamburger / stacked customise). */
export const FETY_NARROW_MQ =
  "(max-width: 768px), ((max-width: 900px) and (pointer: coarse))";

function readNarrow(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(FETY_NARROW_MQ).matches;
}

/** True when the layout should use the narrow/mobile treatment. */
export function useIsNarrow(_breakpointPx = 768): boolean {
  const [narrow, setNarrow] = useState(readNarrow);

  useEffect(() => {
    const mq = window.matchMedia(FETY_NARROW_MQ);
    const apply = () => {
      const next = mq.matches;
      setNarrow(next);
      document.documentElement.classList.toggle("fety-narrow", next);
      document.documentElement.dataset.fetyNarrow = next ? "1" : "0";
    };
    apply();
    mq.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("resize", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, []);

  return narrow;
}
