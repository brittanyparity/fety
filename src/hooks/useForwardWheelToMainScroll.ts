import { useEffect, type RefObject } from "react";

function findMainScrollRegion(from: HTMLElement): HTMLElement | null {
  return (
    from.closest(".fety-shell")?.querySelector<HTMLElement>(".fety-main-scroll") ??
    document.querySelector<HTMLElement>(".fety-main-scroll")
  );
}

/** On desktop, nested overflow:hidden stops page scroll — forward wheel to the main column. */
export function useForwardWheelToMainScroll(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    if (!root) return;

    const onWheel = (event: WheelEvent) => {
      if (document.documentElement.dataset.fetyMobileShell === "1") return;
      if (!window.matchMedia("(min-width: 901px)").matches) return;

      const main = findMainScrollRegion(root);
      if (!main) return;

      const maxScroll = Math.max(0, main.scrollHeight - main.clientHeight);
      const atTop = main.scrollTop <= 0;
      const atBottom = main.scrollTop >= maxScroll - 1;
      if (event.deltaY < 0 && atTop) return;
      if (event.deltaY > 0 && atBottom) return;

      main.scrollTop += event.deltaY;
      event.preventDefault();
    };

    root.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => root.removeEventListener("wheel", onWheel, { capture: true });
  }, [enabled, ref]);
}
