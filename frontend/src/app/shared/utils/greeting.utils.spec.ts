import { buildGreeting, GREETING_AFTERNOON_END_HOUR, GREETING_MORNING_END_HOUR } from './greeting.utils';

describe('buildGreeting', () => {
  it('uses morning salute before noon', () => {
    const noon = new Date(2026, 5, 10, GREETING_MORNING_END_HOUR - 1);
    expect(buildGreeting('Артём', noon)).toBe('Доброе утро, Артём');
  });

  it('uses afternoon salute before evening', () => {
    const afternoon = new Date(2026, 5, 10, GREETING_AFTERNOON_END_HOUR - 1);
    expect(buildGreeting('Артём', afternoon)).toBe('Добрый день, Артём');
  });

  it('uses evening salute at night', () => {
    const evening = new Date(2026, 5, 10, GREETING_AFTERNOON_END_HOUR);
    expect(buildGreeting('Артём', evening)).toBe('Добрый вечер, Артём');
  });
});
