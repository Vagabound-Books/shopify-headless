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
              wrapper: {
                'background-color': 'rgba(0,0,0,0.35)',
              },
              cart: {
                'background-color': 'var(--paper, #fff)',
                'font-family': 'var(--font-body), Nunito, sans-serif',
                'color': 'var(--ink)',
                'max-width': '420px',
                'width': '100%',
              },
              header: {
                'padding': '20px 24px',
                'border-bottom': '1px solid var(--rule-soft, #e7e7e7)',
                'display': 'flex',
                'align-items': 'center',
                'justify-content': 'space-between',
              },
              title: {
                'font-size': '18px',
                'font-weight': '600',
                'font-family': 'var(--font-body), Nunito, sans-serif',
                'color': 'var(--ink)',
                'margin': '0',
              },
              close: {
                'background': 'none',
                'border': 'none',
                'font-size': '22px',
                'cursor': 'pointer',
                'line-height': '1',
                'color': 'var(--ink)',
                'padding': '0',
              },
              cartScroll: {
                'padding': '16px 24px',
              },
              lineItems: {
                'margin': '0',
                'padding': '0',
                'list-style': 'none',
              },
              footer: {
                'padding': '20px 24px',
                'border-top': '1px solid var(--rule-soft, #e7e7e7)',
              },
              subtotalText: {
                'font-weight': '600',
                'font-size': '16px',
                'color': 'var(--ink)',
                'display': 'inline-block',
                'margin': '0 0 8px 0',
              },
              subtotal: {
                'font-weight': '600',
                'font-size': '16px',
                'color': 'var(--ink)',
                'display': 'inline-block',
                'float': 'right',
                'margin': '0 0 8px 0',
              },
              notice: {
                'font-size': '13px',
                'color': 'var(--ink-muted)',
                'margin-top': '8px',
                'margin-bottom': '16px',
                'line-height': '1.4',
              },
              button: {
                'background': 'var(--accent)',
                'color': 'var(--paper)',
                'font-family': 'var(--font-body), Nunito, sans-serif',
                'font-weight': '700',
                'font-size': '13px',
                'letter-spacing': '0.05em',
                'text-transform': 'uppercase',
                'padding': '14px 22px',
                'border-radius': 'var(--radius-sm)',
                'border': '1.5px solid transparent',
                'width': '100%',
                'display': 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                'cursor': 'pointer',
                'transition': 'background 140ms ease',
                ':hover': {
                  'background': 'var(--accent-deep)',
                },
              },
              empty: {
                'text-align': 'center',
                'margin-top': '40px',
                'color': 'var(--ink-soft)',
                'font-size': '14px',
              },
            },
            text: {
              title: 'Your basket',
              empty: 'Your basket is empty.',
              button: 'Checkout',
              total: 'Subtotal',
              notice: 'Shipping and discount codes are added at checkout.',
            },
          },
          lineItem: {
            contents: {
              image: true,
              variantTitle: true,
              title: true,
              price: false,
              priceWithDiscounts: true,
              quantity: true,
              quantityIncrement: false,
              quantityDecrement: false,
              quantityInput: true,
            },
            styles: {
              lineItem: {
                'padding': '14px 0',
                'border-bottom': '1px solid var(--rule-soft, #e7e7e7)',
                'display': 'flex',
                'gap': '14px',
                'align-items': 'flex-start',
              },
              image: {
                'border-radius': 'var(--radius-sm)',
                'width': '64px',
                'height': '90px',
                'background-size': 'cover',
                'background-position': 'center',
                'flex-shrink': '0',
              },
              itemTitle: {
                'font-weight': '600',
                'color': 'var(--ink)',
                'text-decoration': 'none',
                'display': 'block',
                'font-size': '14px',
              },
              variantTitle: {
                'font-size': '13px',
                'color': 'var(--ink-muted)',
                'margin-top': '4px',
              },
              priceWithDiscounts: {
                'font-size': '13px',
                'margin-top': '6px',
                'color': 'var(--ink)',
              },
              price: {
                'font-size': '13px',
                'color': 'var(--ink)',
              },
              quantity: {
                'margin-top': '8px',
                'display': 'flex',
                'align-items': 'center',
                'gap': '4px',
              },
              quantityInput: {
                'font-size': '13px',
                'width': '48px',
                'text-align': 'center',
                'border': '1px solid var(--rule-soft)',
                'border-radius': 'var(--radius-sm)',
                'padding': '4px',
                'font-family': 'var(--font-body), Nunito, sans-serif',
                'color': 'var(--ink)',
              },
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
                'padding': '12px 16px',
                'border': 'none',
                'cursor': 'pointer',
                'box-shadow': '0 2px 8px rgba(0,0,0,0.15)',
              },
              count: {
                'color': 'var(--paper)',
                'font-size': '13px',
                'font-weight': '700',
              },
              icon: {
                'color': 'var(--paper)',
                'width': '22px',
                'height': '22px',
              },
              iconPath: {
                'fill': 'var(--paper)',
              },
            },
          },
          window: {
            height: 700,
            width: 480,
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
