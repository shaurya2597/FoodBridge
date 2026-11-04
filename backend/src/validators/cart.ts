import { z } from 'zod';

const selection = z.object({ group: z.string().trim().min(1).max(60), option: z.string().trim().min(1).max(60) });
const quantity = z.number().int().min(1).max(20);

export const addCartItemBody = z.object({
  foodItemId: z.string().min(1).max(40),
  quantity: quantity.default(1),
  selections: z.array(selection).max(10).default([]),
  instructions: z.string().trim().max(200).optional(),
  // When the cart holds another restaurant's items: true = empty it first, false = reject with 409.
  replaceCart: z.boolean().default(false),
});

export const updateCartItemBody = z.object({ quantity });
