// cloudflare-worker-contact.js
// Deploy this as a Cloudflare Worker at workers.allmotiv.com
// Requires a Resend API key in environment variable RESEND_API_KEY

export default {
  async fetch(request) {
    // Only accept POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify it's a form submission
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
      return new Response('Expected form data', { status: 400 });
    }

    const formData = await request.formData();
    const name = formData.get('name') || '';
    const email = formData.get('email') || '';
    const subject = formData.get('subject') || 'Website Contact';
    const message = formData.get('message') || '';

    // Simple validation
    if (!name || !email || !message) {
      return formResponse('Please fill in name, email, and message.');
    }

    // Send via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return formResponse('Server not configured – try again later.');
    }

    const emailBody = `
New contact form submission from allmotiv.com

Name:    ${name}
Email:   ${email}
Subject: ${subject || '(none)'}

Message:
${message}
    `.trim();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AllMotiv Contact <contact@allmotiv.com>',
        to: 'derekwilliams1983@gmail.com',
        reply_to: email,
        subject: `[AllMotiv] ${subject}`,
        text: emailBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return formResponse('Message failed to send. Please email directly.');
    }

    return formResponse('Thanks! We\'ll be in touch soon.');
  },
};

function formResponse(msg) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="4;url=/"><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1B2A4A;color:white;text-align:center;padding:2rem;}p{font-size:1.2rem;}</style></head><body><p>${escapeHtml(msg)}<br><br><small>Redirecting back...</small></p></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
