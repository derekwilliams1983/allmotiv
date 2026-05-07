export default {
  async fetch(request, env) {
    // Handle GET — redirect to site
    if (request.method === 'GET') {
      return Response.redirect('https://allmotiv.com', 302);
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
      return new Response('Expected form data', { status: 400 });
    }

    const formData = await request.formData();
    const name = formData.get('name') || '';
    const email = formData.get('email') || '';
    const subject = formData.get('subject') || 'Website Contact';
    const message = formData.get('message') || '';

    if (!name || !email || !message) {
      return Response.redirect('https://allmotiv.com?error=missing', 302);
    }

    const resendKey = env.RESEND_API_KEY;
    if (!resendKey) {
      return Response.redirect('https://allmotiv.com?error=server', 302);
    }

    // — Send notification to Derek —
    const notifyBody = `
New contact form submission from allmotiv.com

Name:    ${name}
Email:   ${email}
Subject: ${subject || '(none)'}

Message:
${message}
    `.trim();

    const notifyRes = await fetch('https://api.resend.com/emails', {
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
        text: notifyBody,
      }),
    });

    if (!notifyRes.ok) {
      return Response.redirect('https://allmotiv.com?error=send', 302);
    }

    // — Send auto-reply to customer —
    const autoBody = `
Hi ${name},

Thanks for reaching out through allmotiv.com!

We've received your message and will get back to you as soon as possible. We typically respond within 1-2 business days.

Here's a summary of what you sent:
---
Subject: ${subject || '(none)'}
${message}
---

If you need immediate assistance, feel free to call us at (810) 000-0000.

Best regards,
Derek
AllMotiv LLC
    `.trim();

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AllMotiv Contact <contact@allmotiv.com>',
        to: email,
        subject: `Thanks for contacting AllMotiv, ${name}!`,
        text: autoBody,
      }),
    }).catch(() => {}); // Don't fail if auto-reply has issues

    return Response.redirect('https://allmotiv.com?sent=ok', 302);
  },
};
