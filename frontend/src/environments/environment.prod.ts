export const environment = {
  production: true,
  apiBase: '/api',
  analytics: {
    staleAfterMs: 60_000,
    pollIntervalMs: 45_000,
  },
} as const;
