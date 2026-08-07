/** Query `focus` склада: deep-link к минусовым остаткам. */
export type WarehouseFocusQuery = 'negative';

export function readWarehouseFocusQuery(url: string): WarehouseFocusQuery | null {
  const query = url.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  const focus = params.get('focus');
  return focus === 'negative' ? 'negative' : null;
}
