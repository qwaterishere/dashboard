/** Нормализация URL iiko — синхронизировано с backend `normalize_iiko_url`. */
export function normalizeIikoUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export const DEFAULT_IIKO_URL_SUFFIXES = ['.iiko.it'] as const;

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Client-side hint; authoritative check — backend `validate_iiko_url`. */
export function isAllowlistedIikoHost(
  url: string,
  suffixes: readonly string[] = DEFAULT_IIKO_URL_SUFFIXES,
): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host || /^\[?[\d:a-f.]+\]?$/i.test(host)) {
      return false;
    }
    return suffixes.some((suffix) => {
      const normalized = suffix.startsWith('.') ? suffix.toLowerCase() : `.${suffix.toLowerCase()}`;
      const bare = normalized.slice(1);
      return host === bare || host.endsWith(normalized);
    });
  } catch {
    return false;
  }
}
