import type { APIRoute } from 'astro';

function getMailchimpConfig() {
  const apiKey = import.meta.env.MAILCHIMP_KEY || '';
  const audienceId = import.meta.env.MAILCHIMP_ID || '';
  const datacenter = apiKey.split('-').pop() || '';
  return { apiKey, audienceId, datacenter };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function encodeBasicAuth(apiKey: string): string {
  return `Basic ${btoa(`anystring:${apiKey}`)}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const source = String(data.get('source') ?? '').trim();

    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please enter a valid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { apiKey, audienceId, datacenter } = getMailchimpConfig();
    if (!apiKey || !audienceId || !datacenter) {
      console.error('[Newsletter] Missing Mailchimp configuration.');
      return new Response(
        JSON.stringify({ success: false, error: 'Newsletter signup is not configured.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(
      `https://${datacenter}.api.mailchimp.com/3.0/lists/${audienceId}/members`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': encodeBasicAuth(apiKey),
        },
        body: JSON.stringify({
          email_address: email,
          status: 'pending',
          ...(source === 'popup' ? { tags: ['Popup'] } : {}),
        }),
      }
    );

    if (response.ok) {
      return new Response(
        JSON.stringify({ success: true, message: 'Check your inbox to confirm your subscription.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const errorBody = await response.json().catch(() => ({}));
    const errorDetail = errorBody.detail || '';

    // Member already exists = success.
    if (response.status === 400 && /already a list member|member exists/i.test(errorDetail)) {
      return new Response(
        JSON.stringify({ success: true, message: 'You\'re already subscribed to Wandering Mail.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('[Newsletter] Mailchimp error:', errorBody);
    return new Response(
      JSON.stringify({ success: false, error: 'Could not subscribe. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Newsletter] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
