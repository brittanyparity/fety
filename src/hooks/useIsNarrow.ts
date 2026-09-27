import { useEffect, useState } from "react";

/** True when the layout should use the narrow/mobile treatment. */
export function useIsNarrow(breakpointPx = 768): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= breakpointPx : false,
  );

  useEffect(() => {
    const apply = () => {
      const next = window.innerWidth <= breakpointPx;
      setNarrow(next);
      document.documentElement.classList.toggle("fety-narrow", next);
      document.documentElement.dataset.fetyNarrow = next ? "1" : "0";
    };
    apply();
    window.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, [breakpointPx]);

  return narrow;
}
