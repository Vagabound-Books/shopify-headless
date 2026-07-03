import type { z } from "zod";
import { atom } from "nanostores";
import { persistentAtom } from "@nanostores/persistent";
import {
  getCart,
  addCartLines,
  createCart,
  removeCartLines,
} from "./shopify";
import type { CartResult } from "./schemas";

// Cart drawer state (open or closed) with initial value (false) and no persistent state
export const isCartDrawerOpen = atom(false);

// Cart is updating state (true or false)
export const isCartUpdating = atom(false);

const emptyCart = {
  id: "",
  checkoutUrl: "",
  totalQuantity: 0,
  lines: { edges: [] },
  cost: { subtotalAmount: { amount: "", currencyCode: "" } },
};

// Cart store with persistent state (local storage)
export const cart = persistentAtom<z.infer<typeof CartResult>>(
  "cart",
  emptyCart,
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);

// Fetch cart data if a cart exists in local storage, called during session start only
// Shopify automatically deletes the cart when the customer completes the checkout
// or if the cart is unused or abandoned after 10 days
// https://shopify.dev/custom-storefronts/cart#considerations
export async function initCart() {
  const sessionStarted = sessionStorage.getItem("sessionStarted");
  if (!sessionStarted) {
    sessionStorage.setItem("sessionStarted", "true");
    const localCart = cart.get();
    const cartId = localCart?.id;
    if (cartId) {
      try {
        const data = await getCart(cartId);
        if (data) {
          cart.set({
            id: data.id,
            cost: data.cost,
            checkoutUrl: data.checkoutUrl,
            totalQuantity: data.totalQuantity,
            lines: data.lines,
          });
        } else {
          cart.set(emptyCart);
        }
      } catch {
        cart.set(emptyCart);
      }
    }
  }
}

// Add item to cart or create a new cart if it doesn't exist yet
export async function addCartItem(item: { id: string; quantity: number }) {
  const localCart = cart.get();
  const cartId = localCart?.id;

  isCartUpdating.set(true);

  if (!cartId) {
    const cartData = await createCart(item.id, item.quantity);
    if (cartData) {
      cart.set({
        id: cartData.id,
        cost: cartData.cost,
        checkoutUrl: cartData.checkoutUrl,
        totalQuantity: cartData.totalQuantity,
        lines: cartData.lines,
      });
      isCartUpdating.set(false);
      isCartDrawerOpen.set(true);
    }
  } else {
    const cartData = await addCartLines(cartId, item.id, item.quantity);
    if (cartData) {
      cart.set({
        id: cartData.id,
        cost: cartData.cost,
        checkoutUrl: cartData.checkoutUrl,
        totalQuantity: cartData.totalQuantity,
        lines: cartData.lines,
      });
      isCartUpdating.set(false);
      isCartDrawerOpen.set(true);
    }
  }
}

export async function removeCartItems(lineIds: string[]) {
  const localCart = cart.get();
  const cartId = localCart?.id;

  isCartUpdating.set(true);

  if (cartId) {
    const cartData = await removeCartLines(cartId, lineIds);
    if (cartData) {
      cart.set({
        id: cartData.id,
        cost: cartData.cost,
        checkoutUrl: cartData.checkoutUrl,
        totalQuantity: cartData.totalQuantity,
        lines: cartData.lines,
      });
      isCartUpdating.set(false);
    }
  }
}

// Backwards-compatible helpers
export async function addToCart(variantId: string, quantity: number = 1) {
  return addCartItem({ id: variantId, quantity });
}

export async function removeFromCart(lineId: string) {
  return removeCartItems([lineId]);
}

export async function getOrCreateCart() {
  const localCart = cart.get();
  if (localCart?.id) {
    try {
      const data = await getCart(localCart.id);
      if (data) {
        cart.set({
          id: data.id,
          cost: data.cost,
          checkoutUrl: data.checkoutUrl,
          totalQuantity: data.totalQuantity,
          lines: data.lines,
        });
        return data;
      }
    } catch {
      // Cart expired
    }
  }

  // Create an empty cart by adding a dummy line and immediately removing it
  // Or just return the empty cart state
  return cart.get();
}
