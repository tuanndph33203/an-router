import { getAnthropicCompatHeaders, type RegistryEntry } from "../../shared.ts";

export const deepseekProvider: RegistryEntry = {
  id: "deepseek",
  alias: "ds",
  format: "openai",
  executor: "default",
  baseUrl: "https://api.deepseek.com/chat/completions",
  authType: "apikey",
  defaultContextLength: 1_000_000,
  authHeader: "bearer",
  alternateFormats: [
    {
      format: "openai-responses",
      baseUrl: "https://api.deepseek.com/responses",
      authHeader: "bearer",
      label: "Responses-compatible",
    },
    {
      format: "claude",
      baseUrl: "https://api.deepseek.com/anthropic/v1/messages",
      authHeader: "x-api-key",
      headers: getAnthropicCompatHeaders(),
      label: "Anthropic-compatible",
    },
  ],
  models: [
    {
      id: "deepseek-chat",
      name: "DeepSeek V3 (Chat)",
      contextLength: 128000,
      maxOutputTokens: 8192,
      toolCalling: true,
    },
    {
      id: "deepseek-reasoner",
      name: "DeepSeek R1 (Reasoner)",
      contextLength: 128000,
      maxOutputTokens: 8192,
      supportsReasoning: true,
    },
  ],
};
