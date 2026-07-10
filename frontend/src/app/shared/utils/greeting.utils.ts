/** Границы суток для приветствия (часы, локальное время). */
export const GREETING_MORNING_END_HOUR = 12;
export const GREETING_AFTERNOON_END_HOUR = 18;

export function buildGreeting(firstName: string, now = new Date()): string {
  const hour = now.getHours();
  const salute =
    hour < GREETING_MORNING_END_HOUR
      ? 'Доброе утро'
      : hour < GREETING_AFTERNOON_END_HOUR
        ? 'Добрый день'
        : 'Добрый вечер';
  return `${salute}, ${firstName}`;
}
