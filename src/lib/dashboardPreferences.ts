import type { DashboardWidgetSource, DashboardWidgetState, FinancialAssessment } from "../types/widgets";
import { coreWidgetIds } from "./widgetCatalog";

/** Build per-widget dashboard state from assessment pins + any existing user layout. */
export function buildDashboardWidgetStates(
  pinned: string[],
  assessment: FinancialAssessment,
  previous?: DashboardWidgetState[],
): DashboardWidgetState[] {
  const prevById = new Map((previous ?? []).map((s) => [s.widgetId, s]));
  const recommended = new Set(
    assessment.prioritizedWidgets.filter((r) => r.recommended).map((r) => r.widgetId),
  );
  const core = new Set(coreWidgetIds());

  return pinned.map((widgetId, position) => {
    const prev = prevById.get(widgetId);
    if (prev?.userModified) {
      return { ...prev, enabled: true, position };
    }
    let source: DashboardWidgetSource = "user-added";
    if (core.has(widgetId) && recommended.has(widgetId)) source = "core";
    else if (recommended.has(widgetId)) source = "recommended";
    else if (core.has(widgetId)) source = "core";
    return {
      widgetId,
      enabled: true,
      position,
      source,
      userModified: false,
    };
  });
}

export function markWidgetUserModified(
  states: DashboardWidgetState[] | undefined,
  widgetId: string,
  enabled: boolean,
  pinned: string[],
): DashboardWidgetState[] {
  const byId = new Map((states ?? []).map((s) => [s.widgetId, { ...s }]));
  const existing = byId.get(widgetId);
  byId.set(widgetId, {
    widgetId,
    enabled,
    position: enabled ? pinned.indexOf(widgetId) : existing?.position ?? pinned.length,
    source: existing?.source ?? "user-added",
    userModified: true,
  });
  // Refresh positions for enabled pins
  return pinned.map((id, position) => {
    const s = byId.get(id);
    return s
      ? { ...s, enabled: true, position }
      : { widgetId: id, enabled: true, position, source: "user-added" as const, userModified: true };
  });
}

export function widgetSourceLabel(source: DashboardWidgetSource): string {
  if (source === "recommended") return "Recommended";
  if (source === "core") return "Core";
  return "You added";
}
