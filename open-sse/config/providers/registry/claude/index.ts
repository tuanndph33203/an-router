import type { RegistryEntry } from "../../shared.ts";
import {
  getClaudeCliHeaders,
  mapStainlessOs,
  mapStainlessArch,
  ANTHROPIC_BETA_CLAUDE_OAUTH,
  ANTHROPIC_VERSION_HEADER,
  CLAUDE_CLI_STAINLESS_PACKAGE_VERSION,
  CLAUDE_CLI_STAINLESS_RUNTIME_VERSION,
  resolvePublicCred,
} from "../../shared.ts";

export const claudeProvider: RegistryEntry = {
  id: "claude",
  alias: "cc",
  format: "claude",
  executor: "default",
  baseUrl: "https://api.anthropic.com/v1/messages",
  urlSuffix: "?beta=true",
  authType: "oauth",
  authHeader: "x-api-key",
  defaultContextLength: 200000,
  headers: getClaudeCliHeaders(),
  oauth: {
    clientIdEnv: "CLAUDE_OAUTH_CLIENT_ID",
    clientIdDefault: resolvePublicCred("claude_id"),
    tokenUrl: "https://api.anthropic.com/v1/oauth/token",
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
