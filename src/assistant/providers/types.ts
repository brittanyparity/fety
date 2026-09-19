import type { AIProvider } from "./types";

/** Phase 2+ local and Phase 3 cloud providers implement this. Phase 1 uses deterministicParser only. */
export interface AIProvider {
  readonly id: string;
  parseIntent(message: string, context: AssistantContext): Promise<ParsedIntent> | ParsedIntent;
}

export interface AssistantRoutingStats {
  deterministic: number;
  local: number;
  cloud: number;
}
