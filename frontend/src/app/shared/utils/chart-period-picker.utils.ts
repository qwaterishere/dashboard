import type { DataBoundsV2 } from '../models/dashboard-v2.model';

export function formatBoundRange(bounds: DataBoundsV2 | null): string {
  if (!bounds?.earliest || !bounds.latest) return '';
  const from = formatBound(bounds.earliest);
  const to = formatBound(bounds.latest);
  return `Доступны данные: ${from} — ${to}`;
}

function formatBound(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
