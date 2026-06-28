import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();
    const name = data.get('name');
    const email = data.get('email');
    const zip = data.get('zip');
    const message = data.get('message');

    // TODO: Wire this up to your email service (e.g., SendGrid, Resend, Formspree)
    // or Shopify Admin API to create a customer/draft order with notes.
    console.log('Contact form submission:', { name, email, zip, message });

    return new Response(
      JSON.stringify({ success: true, message: 'Message received.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: 'Something went wrong.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
