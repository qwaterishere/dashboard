export const API_BASE = process.env['PLAYWRIGHT_API_BASE'] ?? 'http://127.0.0.1:8000';

/** Учётная запись для e2e (создаётся через API в auth.setup). */
export const E2E_USER = {
  email: 'e2e@example.com',
  password: 'E2ePass123!',
  first_name: 'E2E',
  last_name: 'Тест',
  position: 'Управляющий',
} as const;
