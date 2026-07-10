export const environment = {
  production: false,
  apiBase: '/api',
  analytics: {
    staleAfterMs: 60_000,
    pollIntervalMs: 45_000,
  },
} as const;
