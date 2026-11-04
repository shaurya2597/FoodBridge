import { api } from './api'

export interface CartItem {
  id: string
  foodItemId: string
  name: string
  imageUrl: string
  foodType: 'VEG' | 'NON_VEG'
  quantity: number
  selections: { group: string; option: string }[]
  instructions: string | null
  unitPrice: number
  lineTotal: number
}

export interface Cart {
  restaurant: {
    id: string
    name: string
    imageUrl: string | null
    city: string
    deliveryTime: number
    isOpen: boolean
    minOrder: number
  } | null
  items: CartItem[]
  itemCount: number
  issues: { cartItemId?: string; code: string; message: string }[]
  meetsMinOrder: boolean
  coupon: {
    code: string
    applied: boolean
    description?: string
    discount: number
    error?: { code: string; message: string }
  } | null
  breakdown: {
    subtotal: number
    discount: number
    deliveryFee: number
    platformFee: number
    tax: number
    total: number
  }
}

interface CartResponse {
  success: true
  data: Cart
}

export interface AddCartItemInput {
  foodItemId: string
  quantity?: number
  selections?: { group: string; option: string }[]
  instructions?: string
  replaceCart?: boolean
}

async function readCart(response: Promise<CartResponse>): Promise<Cart> {
  const result = await response
  return result.data
}

export function getCart(signal?: AbortSignal): Promise<Cart> {
  return readCart(api.get<CartResponse>('/cart', { signal }))
}

export function addCartItem(input: AddCartItemInput): Promise<Cart> {
  return readCart(api.post<CartResponse>('/cart/items', {
    quantity: 1,
    selections: [],
    replaceCart: false,
    ...input,
  }))
}

export function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
  return readCart(api.patch<CartResponse>(`/cart/items/${itemId}`, { quantity }))
}

export function removeCartItem(itemId: string): Promise<Cart> {
  return readCart(api.delete<CartResponse>(`/cart/items/${itemId}`))
}

export function clearCart(): Promise<Cart> {
  return readCart(api.delete<CartResponse>('/cart'))
}
