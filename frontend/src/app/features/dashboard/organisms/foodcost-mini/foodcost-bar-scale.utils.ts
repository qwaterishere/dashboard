/** Полная шкала бара: 100% фудкоста = 100% ширины трека. */
export const FOODCOST_BAR_SCALE_MAX = 100;

/** Ширина/позиция засечки в % трека (0–100). */
export function foodcostBarWidth(pct: number, scaleMax = FOODCOST_BAR_SCALE_MAX): number {
  if (scaleMax <= 0) return 0;
  const width = (pct / scaleMax) * 100;
  return Math.round(Math.min(100, Math.max(0, width)) * 10) / 10;
}
