/** Hidden planner route — open the app with `#planner` in the URL. */
export const PLANNER_HASH = "#planner";

export function isPlannerHash(location: Location = window.location): boolean {
  return location.hash === PLANNER_HASH;
}

export function syncPlannerHash(active: boolean, location: Location = window.location): void {
  const url = new URL(location.href);
  if (active) {
    if (url.hash !== PLANNER_HASH) {
      url.hash = PLANNER_HASH.slice(1);
      window.history.replaceState(null, "", url.toString());
    }
    return;
  }
  if (url.hash === PLANNER_HASH) {
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
  }
}

export function openPlannerHash(): void {
  const url = new URL(window.location.href);
  url.hash = PLANNER_HASH.slice(1);
  window.history.pushState(null, "", url.toString());
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
