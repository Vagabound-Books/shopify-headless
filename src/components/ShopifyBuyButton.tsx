import { useEffect, useRef } from 'preact/hooks';
import { addCartItem, isCartDrawerOpen } from '../lib/cart';

interface Props {
  handle: string;
  variantId: string;
  buttonText?: string;
}

declare global {
  interface Window {
    ShopifyBuy?: any;
    __SHOPIFY_CONFIG__?: {
      storeDomain: string;
      storefrontAccessToken: string;
      apiVersion: string;
    };
  }
}

export default function ShopifyBuyButton({ handle, variantId, buttonText = 'Add to cart' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const config = window.__SHOPIFY_CONFIG__;
    if (!config?.storeDomain || !config?.storefrontAccessToken) {
      console.error('[ShopifyBuyButton] Missing Shopify configuration');
      return;
    }

    const loadScript = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (window.ShopifyBuy) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://sdks.shopifycdn.com/buy-button/latest/buybutton.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Buy Button script'));
        document.body.appendChild(script);
      });
    };

    const initBuyButton = () => {
      const client = window.ShopifyBuy.buildClient({
        domain: "vagaboundbooks.com",
        storefrontAccessToken: config.storefrontAccessToken,
      });

      const ui = window.ShopifyBuy.UI.init(client);

      ui.createComponent('product', {
        handle,
        node: containerRef.current,
        options: {
          product: {
            iframe: false,
            buttonDestination: 'cart',
            layout: 'vertical',
            width: '100%',
            contents: {
              img: false,
              title: false,
              variantTitle: false,
              price: false,
              options: false,
              quantity: false,
              quantityIncrement: false,
              quantityDecrement: false,
              quantityInput: false,
              button: true,
              description: false,
            },
            text: {
              button: buttonText,
              outOfStock: 'Out of stock',
              unavailable: 'Unavailable',
            },
            classes: {
              button: 'shopify-buy__btn vb-btn vb-btn--primary vb-btn--sm vb-btn--block',
            },
            styles: {},
            events: {
              addVariantToCart: () => {
                // Sync Buy Button add-to-cart with our custom nanostores cart
                addCartItem({ id: variantId, quantity: 1 }).catch((err: any) => {
                  console.error('[ShopifyBuyButton] Failed to add to custom cart:', err);
                });
                isCartDrawerOpen.set(true);
              },
            },
          },
          cart: {
            iframe: true,
            startOpen: false,
            popup: false,
          },
          toggle: {
            sticky: false,
          },
        },
      });
    };

    loadScript().then(initBuyButton).catch((err) => {
      console.error('[ShopifyBuyButton]', err);
    });
  }, [handle, variantId, buttonText]);

  return <div ref={containerRef} class="shopify-buy-button-wrap" />;
}
