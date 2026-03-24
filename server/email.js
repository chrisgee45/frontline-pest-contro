const nodemailer = require('nodemailer');

// Email config — set these as environment variables in Railway
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null; // Email not configured — will log instead
  }

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });
}

async function sendLeadNotification(lead) {
  const notifyEmail = process.env.NOTIFY_EMAIL || 'jmanharth@gmail.com';
  const transporter = getTransporter();

  const subject = `New Lead: ${lead.name} — ${lead.service || 'General'}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a5223; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Frontline Termite & Pest Control</h1>
        <p style="color: #7fbf85; margin: 4px 0 0; font-size: 14px;">New Lead Notification</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1a1a1a; margin: 0 0 16px; font-size: 18px;">New Lead from ${lead.name}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #737373; width: 120px;">Name:</td><td style="padding: 8px 0; font-weight: 600;">${lead.name}</td></tr>
          <tr><td style="padding: 8px 0; color: #737373;">Phone:</td><td style="padding: 8px 0;"><a href="tel:${lead.phone}" style="color: #1a5223; font-weight: 600;">${lead.phone}</a></td></tr>
          ${lead.email ? `<tr><td style="padding: 8px 0; color: #737373;">Email:</td><td style="padding: 8px 0;"><a href="mailto:${lead.email}" style="color: #1a5223;">${lead.email}</a></td></tr>` : ''}
          ${lead.address ? `<tr><td style="padding: 8px 0; color: #737373;">Address:</td><td style="padding: 8px 0;">${lead.address}</td></tr>` : ''}
          <tr><td style="padding: 8px 0; color: #737373;">Service:</td><td style="padding: 8px 0;"><span style="background: #1a5223; color: white; padding: 2px 10px; border-radius: 12px; font-size: 13px;">${lead.service || 'General'}</span></td></tr>
          ${lead.urgency ? `<tr><td style="padding: 8px 0; color: #737373;">Urgency:</td><td style="padding: 8px 0; font-weight: 600; color: ${lead.urgency === 'emergency' ? '#dc2626' : '#1a1a1a'};">${lead.urgency}</td></tr>` : ''}
        </table>
        ${lead.message ? `
          <div style="margin-top: 16px; padding: 12px; background: white; border: 1px solid #e5e5e5; border-radius: 6px;">
            <p style="color: #737373; font-size: 12px; margin: 0 0 4px;">Message:</p>
            <p style="color: #1a1a1a; margin: 0; line-height: 1.5;">${lead.message}</p>
          </div>
        ` : ''}
        <div style="margin-top: 20px; text-align: center;">
          <a href="https://www.frontlinepestok.com/admin" style="display: inline-block; background: #1a5223; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View in Admin Portal</a>
        </div>
        <p style="color: #a3a3a3; font-size: 11px; text-align: center; margin-top: 20px;">
          Frontline Termite and Pest Control — Edmond, Oklahoma<br>
          This is an automated notification from your website.
        </p>
      </div>
    </div>
  `;

  if (!transporter) {
    console.log(`[EMAIL] Would send to ${notifyEmail}: ${subject}`);
    console.log(`[EMAIL] Lead: ${lead.name} | ${lead.phone} | ${lead.service || 'General'}`);
    return { sent: false, reason: 'SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in Railway environment variables' };
  }

  try {
    await transporter.sendMail({
      from: `"Frontline Pest Control" <${process.env.SMTP_USER}>`,
      to: notifyEmail,
      subject,
      html,
    });
    console.log(`[EMAIL] Lead notification sent to ${notifyEmail}`);
    return { sent: true };
  } catch (err) {
    console.error(`[EMAIL] Failed to send:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendLeadNotification };
