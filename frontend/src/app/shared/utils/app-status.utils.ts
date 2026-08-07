/**
 * @deprecated Import from `restaurant-attention.utils` instead.
 * Re-exports kept for transitional imports.
 */
export {
  buildAppStatusVm,
  buildAttentionItems,
  buildFreshnessAttentionItems,
  buildOperationalAttentionItems,
  buildRestaurantAttentionVm,
  formatLastSyncAt,
  roleLabelFor,
  sortAttentionItems,
  type AppStatusTone,
  type AttentionActionKind,
  type AttentionItemVm,
  type AttentionPriority,
  type AttentionSeverity,
  type FoodcostAttentionHint,
  type MonthPlanHint,
  type NegativeStockHint,
  type RestaurantAttentionVm,
  type TrustStripVm,
} from './restaurant-attention.utils';

/** Legacy alias. */
export type { RestaurantAttentionVm as AppStatusVm } from './restaurant-attention.utils';
