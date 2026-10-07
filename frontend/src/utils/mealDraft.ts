import type { FoodItem, FoodItemDraft } from '../types/nutrition';

/** Form row IDs are local keys unless the item was returned by the API. */
export function mealItemDraft(item: FoodItem, savedItems: readonly FoodItem[]): FoodItemDraft {
  const { id, ...values } = item;
  return savedItems.some(saved => saved.id === id) ? { ...values, id } : values;
}
