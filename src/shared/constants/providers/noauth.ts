export const NOAUTH_PROVIDERS: Record<string, any> = {};
export const NOAUTH_PROVIDER_PROXY_SUPPORTED = new Set<string>([]);
export function supportsNoAuthProviderProxy(_providerId: string): boolean {
  return false;
}
