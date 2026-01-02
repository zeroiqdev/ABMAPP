import { create } from 'zustand';
import { MarketplaceProduct } from '@/types';

export interface CartItem {
  product: MarketplaceProduct;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: MarketplaceProduct, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product: MarketplaceProduct, quantity: number) => {
    const items = get().items;
    const existingItemIndex = items.findIndex((item) => item.product.id === product.id);

    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      const updatedItems = [...items];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + quantity,
      };
      set({ items: updatedItems });
    } else {
      // Add new item
      set({ items: [...items, { product, quantity }] });
    }
  },

  removeItem: (productId: string) => {
    set({ items: get().items.filter((item) => item.product.id !== productId) });
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: get().items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      ),
    });
  },

  clearCart: () => {
    set({ items: [] });
  },

  getTotal: () => {
    return get().items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));


