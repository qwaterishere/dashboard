/** Semantic colors for attention / trust UI — CSS tokens only. */
export const ATTENTION_TONE_COLOR = {
  info: 'var(--mut)',
  warn: 'var(--amber)',
  critical: 'var(--red)',
  ok: 'var(--grn)',
  muted: 'var(--mut2)',
} as const;

export type AttentionToneKey = keyof typeof ATTENTION_TONE_COLOR;
