import type { RegistryEntry } from "../../shared.ts";
import { buildGeminiGenerateContentUrl, resolvePublicCred } from "../../shared.ts";

export const geminiProvider: RegistryEntry = {
  id: "gemini",
  alias: "gemini",
  format: "gemini",
  executor: "default",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
  urlBuilder: buildGeminiGenerateContentUrl,
  authType: "apikey",
  authHeader: "x-goog-api-key",
  defaultContextLength: 1048576,
  oauth: {
    clientIdEnv: "GEMINI_OAUTH_CLIENT_ID",
    clientIdDefault: resolvePublicCred("gemini_id"),
    clientSecretEnv: "GEMINI_OAUTH_CLIENT_SECRET",
    clientSecretDefault: resolvePublicCred("gemini_alt"),
  },
  models: [
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      contextLength: 2000000,
      maxOutputTokens: 8192,
      toolCalling: true,
      supportsVision: true,
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      contextLength: 1048576,
      maxOutputTokens: 8192,
      toolCalling: true,
      supportsVision: true,
    },
    {
      id: "gemini-2.0-flash-thinking",
      name: "Gemini 2.0 Flash Thinking",
      contextLength: 1048576,
      maxOutputTokens: 8192,
      toolCalling: true,
      supportsVision: true,
      supportsReasoning: true,
    },
  ],
};
