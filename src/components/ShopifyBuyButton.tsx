import { useEffect, useRef } from 'preact/hooks';

interface Props {
  handle: string;
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

export default function ShopifyBuyButton({ handle, buttonText = 'Add to cart' }: Props) {
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
        domain: config.storeDomain,
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
            styles: {
              button: {
                'font-family': 'var(--font-body), Nunito, sans-serif',
                'font-weight': '700',
                'font-size': '13.5px',
                'letter-spacing': '0.05em',
                'text-transform': 'uppercase',
                'padding': '18px 22px',
                'border-radius': 'var(--radius-sm)',
                'border': '1.5px solid transparent',
                'background': 'var(--buckram)',
                'color': 'var(--paper)',
                'cursor': 'pointer',
                'transition': 'background 140ms ease, color 140ms ease, border-color 140ms ease',
                'width': '100%',
                'display': 'inline-flex',
                'align-items': 'center',
                'justify-content': 'center',
                'gap': '8px',
                'white-space': 'nowrap',
                'line-height': '1',
                ':hover': {
                  'background': 'var(--buckram)',
                  'filter': 'brightness(1.15)',
                },
              },
            },
          },
          cart: {
            iframe: true,
            startOpen: false,
            popup: false,
            styles: {
              button: {
                'background': 'var(--buckram)',
                'color': 'var(--paper)',
                'font-family': 'var(--font-body), Nunito, sans-serif',
                'font-weight': '700',
                'font-size': '13px',
                'letter-spacing': '0.05em',
                'text-transform': 'uppercase',
                'padding': '14px 22px',
                'border-radius': 'var(--radius-sm)',
                'border': '1.5px solid transparent',
                'cursor': 'pointer',
              },
            },
            text: {
              title: 'Cart',
              empty: 'Your cart is empty.',
              button: 'Checkout',
              total: 'Total',
              notice: 'Shipping and discount codes are added at checkout.',
            },
          },
          toggle: {
            styles: {
              toggle: {
                'background': 'var(--buckram)',
                'color': 'var(--paper)',
                'font-family': 'var(--font-body), Nunito, sans-serif',
                'font-weight': '700',
                'font-size': '13px',
                'letter-spacing': '0.05em',
                'text-transform': 'uppercase',
                'border-radius': 'var(--radius-sm) 0 0 var(--radius-sm)',
              },
              count: {
                'color': 'var(--paper)',
              },
              icon: {
                'color': 'var(--paper)',
              },
            },
          },
        },
      });
    };

    loadScript().then(initBuyButton).catch((err) => {
      console.error('[ShopifyBuyButton]', err);
    });
  }, [handle, buttonText]);

  return <div ref={containerRef} class="shopify-buy-button-wrap" />;
}
