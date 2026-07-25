/** Позиция значения на gauge-шкале → % трека (0–100). */
export function foodcostGaugePosition(
  value: number,
  scaleMin: number,
  scaleMax: number,
): number {
  const span = scaleMax - scaleMin;
  if (!(span > 0) || !Number.isFinite(value)) return 0;
  const pct = ((value - scaleMin) / span) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10;
}

/**
 * Диапазон шкалы вокруг факта и (опционально) цели.
 * Округляет к шагу 5 п.п., минимум 10 п.п. ширины.
 */
export function foodcostGaugeScale(
  pct: number,
  goal: number | null = null,
): { min: number; max: number } {
  const values = [pct, goal].filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length === 0) return { min: 15, max: 35 };

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(4, (hi - lo) * 0.75);
  let min = Math.floor((lo - pad) / 5) * 5;
  let max = Math.ceil((hi + pad) / 5) * 5;
  if (max - min < 10) {
    const mid = (min + max) / 2;
    min = Math.floor((mid - 5) / 5) * 5;
    max = min + 10;
  }
  min = Math.max(0, min);
  return { min, max };
}

/** Тон fill: выше цели — плохо (инвертированный семафор). Без цели — нейтральный. */
export function foodcostGaugeTone(deltaPP: number | null): 'good' | 'mid' | 'bad' {
  if (deltaPP == null || !Number.isFinite(deltaPP)) return 'mid';
  if (deltaPP > 0.3) return 'bad';
  if (deltaPP < -0.3) return 'good';
  return 'mid';
}
