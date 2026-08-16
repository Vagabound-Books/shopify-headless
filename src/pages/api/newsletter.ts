import type { APIRoute } from 'astro';
import { shopifyAdminFetch } from '../../lib/shopify-admin';

const FIND_CUSTOMER_BY_EMAIL = `
  query FindCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          email
          emailMarketingConsent {
            marketingState
            consentUpdatedAt
          }
        }
      }
    }
  }
`;

const CUSTOMER_CREATE = `
  mutation CustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
        emailMarketingConsent {
          marketingState
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CUSTOMER_UPDATE = `
  mutation CustomerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        email
        emailMarketingConsent {
          marketingState
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function makeConsentInput() {
  return {
    marketingState: "SUBSCRIBED",
    marketingOptInLevel: "SINGLE_OPT_IN",
    consentUpdatedAt: new Date().toISOString(),
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please enter a valid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Search for existing customer by email.
    const existing = await shopifyAdminFetch<any>(FIND_CUSTOMER_BY_EMAIL, {
      query: `email:${email}`,
    });
    const customer = existing?.customers?.edges?.[0]?.node;

    let result;
    if (customer) {
      // Update existing customer marketing consent.
      result = await shopifyAdminFetch<any>(CUSTOMER_UPDATE, {
        input: {
          id: customer.id,
          emailMarketingConsent: makeConsentInput(),
        },
      });
      const errors = result?.customerUpdate?.userErrors || [];
      if (errors.length > 0) {
        throw new Error(errors.map((e: any) => e.message).join(', '));
      }
    } else {
      // Create a new customer with subscribed consent.
      result = await shopifyAdminFetch<any>(CUSTOMER_CREATE, {
        input: {
          email,
          emailMarketingConsent: makeConsentInput(),
        },
      });
      const errors = result?.customerCreate?.userErrors || [];
      if (errors.length > 0) {
        throw new Error(errors.map((e: any) => e.message).join(', '));
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'You\'re subscribed to Wandering Mail.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Newsletter] Subscription failed:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
