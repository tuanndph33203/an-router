import type { RegistryEntry } from "../../shared.ts";
import { ANTHROPIC_BETA_API_KEY, ANTHROPIC_VERSION_HEADER } from "../../shared.ts";

export const anthropicProvider: RegistryEntry = {
  id: "anthropic",
  alias: "anthropic",
  format: "claude",
  executor: "default",
  baseUrl: "https://api.anthropic.com/v1/messages",
  urlSuffix: "?beta=true",
  authType: "apikey",
  authHeader: "x-api-key",
  defaultContextLength: 200000,
  headers: {
    "Anthropic-Version": ANTHROPIC_VERSION_HEADER,
    "Anthropic-Beta": ANTHROPIC_BETA_API_KEY,
  },
  models: [
    {
      id: "claude-3-5-sonnet",
      name: "Claude 3.5 Sonnet",
      contextLength: 200000,
      maxOutputTokens: 8192,
      supportsVision: true,
      toolCalling: true,
    },
    {
      id: "claude-3-5-haiku",
      name: "Claude 3.5 Haiku",
      contextLength: 200000,
      maxOutputTokens: 8192,
      supportsVision: true,
      toolCalling: true,
    },
  ],
};
