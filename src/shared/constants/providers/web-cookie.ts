export const WEB_COOKIE_PROVIDERS: Record<string, any> = {};

export interface WebProviderHostLink {
  url: string;
  host: string;
}

export function resolveWebProviderHost(
  _providerId: string | null | undefined,
  _fallbackBaseUrl?: string | null
): WebProviderHostLink | null {
  return null;
}
