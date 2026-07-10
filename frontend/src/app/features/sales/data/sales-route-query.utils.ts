/** Диапазон дат из query string маршрута продаж. */
export interface SalesDayQuery {
  dateFrom: string;
  dateTo: string;
}

export function readSalesDayQuery(url: string): SalesDayQuery | null {
  const query = url.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  const dateFrom = params.get('date_from');
  const dateTo = params.get('date_to');
  if (!dateFrom || !dateTo) return null;
  return { dateFrom, dateTo };
}
