import type { RegistryEntry } from "./shared.ts";
import { openaiProvider } from "./registry/openai/index.ts";
import { anthropicProvider } from "./registry/anthropic/index.ts";
import { geminiProvider } from "./registry/gemini/index.ts";
import { deepseekProvider } from "./registry/deepseek/index.ts";
import { claudeProvider } from "./registry/claude/index.ts";
import { codexProvider } from "./registry/codex/index.ts";
import { antigravityProvider } from "./registry/antigravity/index.ts";
import { cursorProvider } from "./registry/cursor/index.ts";
import { githubProvider } from "./registry/github/index.ts";

export const REGISTRY: Record<string, RegistryEntry> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  deepseek: deepseekProvider,
  claude: claudeProvider,
  codex: codexProvider,
  antigravity: antigravityProvider,
  cursor: cursorProvider,
  github: githubProvider,
};
