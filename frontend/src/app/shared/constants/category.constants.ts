import type { CategoryKey } from '../models';

/** Названия категорий — единый источник для всех страниц. */
export const CAT_NAME: Record<CategoryKey, string> = {
  k: 'Кухня',
  b: 'Бар',
  w: 'Вино',
};

export const CAT_COLOR: Record<CategoryKey, string> = {
  k: '#3DDC97',
  b: '#6E6BFF',
  w: '#C7466F',
};

/** CSS-модификатор заливки баров по категории. */
export const CAT_FILL_CLASS: Record<CategoryKey, '' | 'v' | 'w'> = {
  k: '',
  b: 'v',
  w: 'w',
};

export const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'] as const;

export const WEEKDAYS_FULL = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
] as const;

export const CATEGORY_KEYS: CategoryKey[] = ['k', 'b', 'w'];
