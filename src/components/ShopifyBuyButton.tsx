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
            styles: {
              button: {
                'font-family': 'var(--font-body), Nunito, sans-serif',
                'font-weight': '700',
                'font-size': '11.5px',
                'letter-spacing': '0.05em',
                'text-transform': 'uppercase',
                'padding': '10px 14px',
                'border-radius': 'var(--radius-sm)',
                'border': '1.5px solid transparent',
                'background': 'var(--buckram)',
                'color': 'var(--paper)',
                'cursor': 'pointer',
                'width': '100%',
                'height': '100%',
                'display': 'inline-flex',
                'align-items': 'center',
                'justify-content': 'center',
                'gap': '8px',
                'white-space': 'nowrap',
                'line-height': '1',
                ':hover': {
                  'filter': 'brightness(1.15)',
                },
              },
            },
            events: {
              afterRender: (product: any) => {
                const btn = product.node.querySelector('.shopify-buy__btn');
                if (btn && !btn.dataset.vbHooked) {
                  btn.dataset.vbHooked = 'true';
                  btn.addEventListener(
                    'click',
                    (e: Event) => {
                      e.preventDefault();
                      e.stopImmediatePropagation();
                      addCartItem({ id: variantId, quantity: 1 }).catch((err: any) => {
                        console.error('[ShopifyBuyButton] Failed to add to cart:', err);
                      });
                      isCartDrawerOpen.set(true);
                    },
                    true
                  );
                }
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
