import { isAllowlistedIikoHost, isValidHttpUrl, normalizeIikoUrl } from './iiko-settings.utils';

describe('iiko-settings.utils', () => {
  it('normalizeIikoUrl strips trailing slashes', () => {
    expect(normalizeIikoUrl('https://example.iiko.it:443///')).toBe('https://example.iiko.it:443');
  });

  it('isValidHttpUrl accepts https only', () => {
    expect(isValidHttpUrl('https://example.iiko.it')).toBe(true);
    expect(isValidHttpUrl('http://example.iiko.it')).toBe(false);
  });

  it('isValidHttpUrl rejects invalid urls', () => {
    expect(isValidHttpUrl('not-a-url')).toBe(false);
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
  });

  it('isAllowlistedIikoHost accepts iiko.it suffix', () => {
    expect(isAllowlistedIikoHost('https://demo.iiko.it:443')).toBe(true);
    expect(isAllowlistedIikoHost('https://evil.example.com')).toBe(false);
    expect(isAllowlistedIikoHost('https://127.0.0.1')).toBe(false);
  });
});
