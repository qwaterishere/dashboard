export const XSS_TEST_PAYLOADS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(1)',
] as const;

/** true если DOM содержит неэкранированные опасные конструкции. */
export function hasDangerousDom(root: HTMLElement): boolean {
  if (root.querySelector('script')) return true;
  const html = root.outerHTML;
  if (/<script[\s>]/i.test(html)) return true;
  if (/<img[^>]*\sonerror\s*=/i.test(html)) return true;
  return false;
}
