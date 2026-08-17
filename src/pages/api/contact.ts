import type { APIRoute } from 'astro';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const zip = String(data.get('zip') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please fill in all required fields.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please enter a valid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resendKey = import.meta.env.RESEND_KEY || '';
    const toEmail = import.meta.env.RESEND_MAIL || '';

    if (!resendKey || !toEmail) {
      console.error('[Contact] Missing Resend configuration.');
      return new Response(
        JSON.stringify({ success: false, error: 'Contact form is not configured.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vagabound Books <no-reply@vagaboundbooks.com>',
        to: [toEmail],
        reply_to: email,
        subject: 'Sell to us inquiry',
        text: `Name: ${name}\nEmail: ${email}\nZip: ${zip}\n\nMessage:\n${message}`,
        html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> ${escapeHtml(email)}</p>
<p><strong>Zip:</strong> ${escapeHtml(zip)}</p>
<p><strong>Message:</strong></p>
<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Contact] Resend error:', errorBody);
      throw new Error(errorBody);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Thanks — we\'ll be in touch soon.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Contact] Submission failed:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
