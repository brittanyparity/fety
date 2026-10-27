import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const TILE_SCROLL_STEP_PX = 48;
const TILE_HOLD_DELAY_MS = 350;
const TILE_HOLD_INTERVAL_MS = 90;

function TileScrollButton({
  direction,
  onStep,
}: {
  direction: "up" | "down";
  onStep: (smooth: boolean) => void;
}) {
  const holdDelayRef = useRef<number | null>(null);
  const holdRepeatRef = useRef<number | null>(null);

  const clearHold = useCallback(() => {
    if (holdDelayRef.current != null) window.clearTimeout(holdDelayRef.current);
    if (holdRepeatRef.current != null) window.clearInterval(holdRepeatRef.current);
    holdDelayRef.current = null;
    holdRepeatRef.current = null;
  }, []);

  useEffect(() => clearHold, [clearHold]);

  const startHold = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      clearHold();
      onStep(true);
      holdDelayRef.current = window.setTimeout(() => {
        onStep(false);
        holdRepeatRef.current = window.setInterval(() => onStep(false), TILE_HOLD_INTERVAL_MS);
      }, TILE_HOLD_DELAY_MS);
    },
    [clearHold, onStep],
  );

  const endHold = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      clearHold();
    },
    [clearHold],
  );

  const label = direction === "up" ? "Scroll up" : "Scroll down";
  return (
    <button
      type="button"
      className="fety-home-calendar-yearly-scroll-btn fety-home-cal-tile-scroll-btn"
      aria-label={label}
      title={label}
      onPointerDown={startHold}
      onPointerUp={endHold}
      onPointerCancel={endHold}
      onLostPointerCapture={clearHold}
      onClick={(event) => event.stopPropagation()}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        {direction === "up" ? (
          <path d="M6 3.5 2.5 7h7L6 3.5Z" fill="currentColor" />
        ) : (
          <path d="M6 8.5 9.5 5h-7L6 8.5Z" fill="currentColor" />
        )}
      </svg>
    </button>
  );
}

export default function HomeCalendarTileScroller({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  const refresh = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScroll(el.scrollHeight > el.clientHeight + 2);
  }, []);

  useEffect(() => {
    refresh();
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(refresh);
    ro.observe(el);
    const blockWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    el.addEventListener("wheel", blockWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", blockWheel);
    };
  }, [refresh, children]);

  const scrollByStep = useCallback((direction: -1 | 1, smooth: boolean) => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxTop = el.scrollHeight - el.clientHeight;
    const nextTop = Math.max(0, Math.min(maxTop, el.scrollTop + direction * TILE_SCROLL_STEP_PX));
    el.scrollTo({ top: nextTop, behavior: smooth ? "smooth" : "auto" });
  }, []);

  return (
    <div className={`fety-home-cal-tile-scroll-wrap${className ? ` ${className}` : ""}`}>
      <div ref={scrollerRef} className="fety-home-cal-tile-scroll">
        {children}
      </div>
      {canScroll ? (
        <div className="fety-home-cal-tile-scroll-nav" onClick={(event) => event.stopPropagation()}>
          <TileScrollButton direction="up" onStep={(smooth) => scrollByStep(-1, smooth)} />
          <TileScrollButton direction="down" onStep={(smooth) => scrollByStep(1, smooth)} />
        </div>
      ) : null}
    </div>
  );
}
