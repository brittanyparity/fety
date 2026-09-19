import { parseDeterministicIntent } from "../deterministicParser";
import type { AssistantContext, ParsedIntent } from "../types";
import type { AIProvider } from "./types";

export const deterministicProvider: AIProvider = {
  id: "deterministic",
  parseIntent(message: string, context: AssistantContext): ParsedIntent {
    return parseDeterministicIntent(message, context);
  },
};
