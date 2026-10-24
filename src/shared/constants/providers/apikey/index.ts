import { APIKEY_PROVIDERS_FRONTIER } from "./frontier-labs";
import { APIKEY_PROVIDERS_REGIONAL } from "./regional";

export const APIKEY_PROVIDERS = {
  openai: APIKEY_PROVIDERS_FRONTIER.openai,
  anthropic: APIKEY_PROVIDERS_FRONTIER.anthropic,
  gemini: APIKEY_PROVIDERS_FRONTIER.gemini,
  deepseek: APIKEY_PROVIDERS_REGIONAL.deepseek,
};
