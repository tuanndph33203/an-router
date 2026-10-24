import type { RegistryEntry } from "../../shared.ts";
import { REASONING_UNSUPPORTED } from "../../shared.ts";

export const openaiProvider: RegistryEntry = {
  id: "openai",
  alias: "openai",
  format: "openai",
  executor: "default",
  baseUrl: "https://api.openai.com/v1/chat/completions",
  reasoningTransport: "opaque",
  authType: "apikey",
  authHeader: "bearer",
  defaultContextLength: 128000,
  models: [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      contextLength: 128000,
      maxOutputTokens: 16384,
      toolCalling: true,
      supportsVision: true,
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      contextLength: 128000,
      maxOutputTokens: 16384,
      toolCalling: true,
      supportsVision: true,
    },
    {
      id: "o1",
      name: "o1",
      contextLength: 200000,
      maxOutputTokens: 100000,
      supportsReasoning: true,
      unsupportedParams: REASONING_UNSUPPORTED,
    },
    {
      id: "o3-mini",
      name: "o3-mini",
      contextLength: 200000,
      maxOutputTokens: 100000,
      supportsReasoning: true,
      unsupportedParams: REASONING_UNSUPPORTED,
    },
  ],
};
