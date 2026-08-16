export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return Response.redirect('https://allmotiv.com', 302);
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const origin = request.headers.get('origin') || '';
    if (
      origin &&
      origin !== 'https://allmotiv.com' &&
      origin !== 'https://www.allmotiv.com'
    ) {
      return Response.redirect('https://allmotiv.com?error=blocked', 302);
    }

    const contentType = request.headers.get('content-type') || '';
    if (
      !contentType.includes('application/x-www-form-urlencoded') &&
      !contentType.includes('multipart/form-data')
    ) {
      return new Response('Expected form data', { status: 400 });
    }

    const formData = await request.formData();

    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const subject = String(
      formData.get('subject') || 'Website Contact'
    ).trim();
    const message = String(formData.get('message') || '').trim();

    const website = String(formData.get('website') || '').trim();
    const startedAt = Number(formData.get('form_started_at') || 0);
    const turnstileToken = String(
      formData.get('cf-turnstile-response') || ''
    );

    // Honeypot field: real users should never fill this in.
    if (website) {
      return Response.redirect('https://allmotiv.com?sent=ok', 302);
    }

    // Reject instant bot submissions.
    if (!startedAt || Date.now() - startedAt < 3000) {
      return Response.redirect('https://allmotiv.com?error=blocked', 302);
    }

    // Basic validation / size limits.
    if (
      !name ||
      !email ||
      !message ||
      name.length > 120 ||
      email.length > 254 ||
      subject.length > 200 ||
      message.length > 5000
    ) {
      return Response.redirect('https://allmotiv.com?error=missing', 302);
    }

    const resendKey = env.RESEND_API_KEY;
    const turnstileSecret = env.TURNSTILE_SECRET_KEY;

    if (!resendKey || !turnstileSecret) {
      return Response.redirect('https://allmotiv.com?error=server', 302);
    }

    if (!turnstileToken) {
      return Response.redirect('https://allmotiv.com?error=verify', 302);
    }

    // Verify Cloudflare Turnstile server-side.
    const verifyBody = new FormData();
    verifyBody.append('secret', turnstileSecret);
    verifyBody.append('response', turnstileToken);

    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) {
      verifyBody.append('remoteip', ip);
    }

    const verifyRes = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: verifyBody,
      }
    );

    const verify = await verifyRes
      .json()
      .catch(() => ({ success: false }));

    if (!verify.success) {
      return Response.redirect('https://allmotiv.com?error=verify', 302);
    }

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
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AllMotiv Contact <contact@allmotiv.com>',
        to: 'derek@allmotiv.com',
        reply_to: email,
        subject: `[AllMotiv] ${subject}`,
        text: notifyBody,
      }),
    });

    if (!notifyRes.ok) {
      return Response.redirect('https://allmotiv.com?error=send', 302);
    }

    // No automatic outbound reply.
    return Response.redirect('https://allmotiv.com?sent=ok', 302);
  },
};