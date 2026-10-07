import { describe, expect, it } from 'vitest';
import type { FoodItem } from '../types/nutrition';
import { mealItemDraft } from './mealDraft';

const item: FoodItem = {
  id: 'a7c85ad2-1959-4419-a612-11b12eea66e5',
  name: 'Rice', calories: 130.5, protein: 2.5, carbohydrate: 28, fat: 0.3,
};

describe('meal item request IDs', () => {
  it('omits temporary UUIDs when creating an itemized meal or converting a quick meal', () => {
    const payload = mealItemDraft(item, []);
    expect(payload).not.toHaveProperty('id');
    expect(payload).toEqual({ name: 'Rice', calories: 130.5, protein: 2.5, carbohydrate: 28, fat: 0.3 });
    expect(item.id).toBeDefined();
  });

  it('preserves saved IDs while omitting IDs for newly appended rows', () => {
    const added = { ...item, id: 'b19d928d-6dc6-4d69-9f22-c4b08e3e7e70', name: 'Egg' };
    const payload = [added, { ...item, calories: 150 }].map(row => mealItemDraft(row, [item]));
    expect(payload[0]).not.toHaveProperty('id');
    expect(payload[1]).toMatchObject({ id: item.id, calories: 150 });
    expect(JSON.parse(JSON.stringify(payload))[0]).not.toHaveProperty('id');
  });
});
