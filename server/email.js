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

// Render the Pay Online call-to-action block for an invoice email. If
// no payUrl is provided (Stripe not configured, or the admin hasn't
// generated a link yet), returns the legacy "call/email us" block.
function renderPaymentBlock(payUrl, balance, fmt) {
  if (payUrl) {
    return `
      <div style="margin: 0 0 24px; padding: 20px; background: #f0fdf4; border: 2px solid #1a5223; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 12px; font-size: 14px; color: #1a5223; font-weight: 600;">Pay Securely Online</p>
        <a href="${payUrl}" style="display: inline-block; background: #1a5223; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 16px;">
          Pay ${fmt(balance)} Now →
        </a>
        <p style="margin: 12px 0 0; font-size: 12px; color: #525252;">
          You'll be taken to our secure Stripe-powered checkout page.
        </p>
      </div>
      <div style="border-top: 1px solid #e5e5e5; padding-top: 20px;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #737373; text-align: center;">Prefer to pay another way?</p>
        <p style="margin: 0; font-size: 13px; line-height: 1.8; text-align: center;">
          <strong style="color: #1a5223;">Phone:</strong> <a href="tel:4055311034" style="color: #1a5223; text-decoration: none;">(405) 531-1034</a>
          &nbsp;&middot;&nbsp;
          <strong style="color: #1a5223;">Email:</strong> <a href="mailto:info@frontlinepestok.com" style="color: #1a5223; text-decoration: none;">info@frontlinepestok.com</a>
        </p>
      </div>
    `;
  }
  return `
    <div style="border-top: 1px solid #e5e5e5; padding-top: 20px;">
      <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #1a1a1a;">Payment Instructions</p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #525252; line-height: 1.6;">
        To pay this invoice, please contact us by phone or email and we'll arrange a convenient payment method for you.
      </p>
      <p style="margin: 12px 0 0; font-size: 13px; line-height: 1.8;">
        <strong style="color: #1a5223;">Phone:</strong> <a href="tel:4055311034" style="color: #1a5223; text-decoration: none;">(405) 531-1034</a><br>
        <strong style="color: #1a5223;">Email:</strong> <a href="mailto:info@frontlinepestok.com" style="color: #1a5223; text-decoration: none;">info@frontlinepestok.com</a>
      </p>
    </div>
  `;
}

// Send a branded invoice email to a customer. The invoice argument is
// the enriched invoice (the one returned by GET /api/admin/invoices) so
// it includes paidAmount/balance — the email calls out "Balance Due" when
// there are already partial payments, and switches to "Total" when not.
//
// If `payUrl` is provided (Stripe is configured and a pay link is
// available), the email includes a big "Pay Now" button; otherwise it
// falls back to the legacy "call us to pay" instructions.
async function sendInvoiceEmail(invoice, { to, payUrl } = {}) {
  if (!to) return { sent: false, reason: 'Missing recipient email' };

  const transporter = getTransporter();
  const paidAmount = Number(invoice.paidAmount || 0);
  const balance = Number(invoice.balance != null ? invoice.balance : invoice.total);
  const hasPartial = paidAmount > 0.005 && balance > 0.005;
  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const lineItemRows = (invoice.items || []).map(item => `
    <tr style="border-bottom: 1px solid #f3f4f6;">
      <td style="padding: 10px 12px; font-size: 14px;">${(item.description || '').replace(/</g, '&lt;')}</td>
      <td style="padding: 10px 12px; text-align: right; font-size: 14px;">${item.quantity}</td>
      <td style="padding: 10px 12px; text-align: right; font-size: 14px;">${fmt(item.rate)}</td>
      <td style="padding: 10px 12px; text-align: right; font-size: 14px; font-weight: 600;">${fmt(Number(item.quantity) * Number(item.rate))}</td>
    </tr>
  `).join('');

  const subject = `Invoice ${invoice.invoiceNumber} from Frontline Termite & Pest Control`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1a5223; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">FRONTLINE</h1>
        <p style="color: #a3d4a8; margin: 4px 0 0; font-size: 12px; letter-spacing: 1px;">TERMITE &amp; PEST CONTROL</p>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e5e5e5; border-top: none;">
        <div style="display: table; width: 100%; margin-bottom: 24px;">
          <div style="display: table-cell; vertical-align: top;">
            <p style="margin: 0; color: #737373; font-size: 12px; letter-spacing: 0.5px;">INVOICE</p>
            <p style="margin: 4px 0 0; font-size: 24px; font-weight: 700; color: #1a1a1a;">${invoice.invoiceNumber}</p>
          </div>
          <div style="display: table-cell; text-align: right; vertical-align: top;">
            <p style="margin: 0; color: #737373; font-size: 12px; letter-spacing: 0.5px;">DATE</p>
            <p style="margin: 4px 0 0; font-size: 14px;">${fmtDate(invoice.createdAt)}</p>
            ${invoice.dueDate ? `<p style="margin: 8px 0 0; color: #737373; font-size: 12px; letter-spacing: 0.5px;">DUE DATE</p><p style="margin: 4px 0 0; font-size: 14px; font-weight: 600;">${fmtDate(invoice.dueDate)}</p>` : ''}
          </div>
        </div>

        <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
          <p style="margin: 0; color: #737373; font-size: 12px; letter-spacing: 0.5px;">BILL TO</p>
          <p style="margin: 4px 0 0; font-size: 15px; font-weight: 600;">${(invoice.customerName || '').replace(/</g, '&lt;')}</p>
          ${invoice.customerAddress ? `<p style="margin: 4px 0 0; color: #525252; font-size: 13px;">${invoice.customerAddress.replace(/</g, '&lt;')}</p>` : ''}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px 12px; text-align: left; font-size: 11px; letter-spacing: 0.5px; color: #737373;">DESCRIPTION</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 11px; letter-spacing: 0.5px; color: #737373; width: 60px;">QTY</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 11px; letter-spacing: 0.5px; color: #737373; width: 90px;">RATE</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 11px; letter-spacing: 0.5px; color: #737373; width: 100px;">AMOUNT</th>
            </tr>
          </thead>
          <tbody>${lineItemRows}</tbody>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr><td style="padding: 4px 12px; text-align: right; font-size: 13px; color: #737373;">Subtotal</td><td style="padding: 4px 12px; text-align: right; font-size: 13px; width: 100px;">${fmt(invoice.subtotal)}</td></tr>
          <tr><td style="padding: 4px 12px; text-align: right; font-size: 13px; color: #737373;">Tax (${((Number(invoice.taxRate) || 0.085) * 100).toFixed(2).replace(/\.?0+$/, '')}%)</td><td style="padding: 4px 12px; text-align: right; font-size: 13px;">${fmt(invoice.tax)}</td></tr>
          <tr style="border-top: 2px solid #e5e5e5;"><td style="padding: 10px 12px; text-align: right; font-weight: 700; font-size: 15px;">Total</td><td style="padding: 10px 12px; text-align: right; font-weight: 700; font-size: 18px;">${fmt(invoice.total)}</td></tr>
          ${hasPartial ? `
            <tr><td style="padding: 4px 12px; text-align: right; font-size: 13px; color: #16a34a;">Payments Received</td><td style="padding: 4px 12px; text-align: right; font-size: 13px; color: #16a34a;">-${fmt(paidAmount)}</td></tr>
            <tr style="border-top: 2px solid #1a5223; background: #f0fdf4;"><td style="padding: 10px 12px; text-align: right; font-weight: 700; font-size: 15px; color: #1a5223;">Balance Due</td><td style="padding: 10px 12px; text-align: right; font-weight: 700; font-size: 20px; color: #1a5223;">${fmt(balance)}</td></tr>
          ` : ''}
        </table>

        ${invoice.notes ? `
          <div style="background: #f9fafb; padding: 14px 16px; border-radius: 6px; margin-bottom: 24px; border-left: 3px solid #1a5223;">
            <p style="margin: 0; font-size: 13px; color: #525252; line-height: 1.5;">${invoice.notes.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>
          </div>
        ` : ''}

        ${renderPaymentBlock(payUrl, balance, fmt)}

        <p style="margin: 32px 0 0; text-align: center; color: #a3a3a3; font-size: 11px;">
          Frontline Termite and Pest Control &mdash; Edmond, Oklahoma<br>
          Thank you for your business.
        </p>
      </div>
    </div>
  `;

  if (!transporter) {
    console.log(`[EMAIL] Would send invoice ${invoice.invoiceNumber} to ${to}`);
    return { sent: false, reason: 'SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in Railway environment variables' };
  }

  try {
    await transporter.sendMail({
      from: `"Frontline Termite & Pest Control" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL] Invoice ${invoice.invoiceNumber} sent to ${to}`);
    return { sent: true };
  } catch (err) {
    console.error(`[EMAIL] Failed to send invoice:`, err.message);
    return { sent: false, reason: err.message };
  }
}

// Dedicated "Pay Online" reminder email. Shorter than the full invoice
// email — just the greeting, total/balance, big Pay Now button, and
// fallback payment options. Used by the "Send Pay Link" admin action.
async function sendInvoicePayLinkEmail(invoice, { to, payUrl }) {
  if (!to) return { sent: false, reason: 'Missing recipient email' };
  if (!payUrl) return { sent: false, reason: 'Missing pay URL' };

  const transporter = getTransporter();
  const paidAmount = Number(invoice.paidAmount || 0);
  const balance = Number(invoice.balance != null ? invoice.balance : invoice.total);
  const hasPartial = paidAmount > 0.005 && balance > 0.005;
  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const subject = `Payment Link for Invoice ${invoice.invoiceNumber} — Frontline Pest Control`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1a5223; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">FRONTLINE</h1>
        <p style="color: #a3d4a8; margin: 4px 0 0; font-size: 12px; letter-spacing: 1px;">TERMITE &amp; PEST CONTROL</p>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px; font-size: 15px;">Hi ${(invoice.customerName || 'there').replace(/</g, '&lt;')},</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #525252;">
          Here's a secure payment link for invoice
          <strong style="color: #1a1a1a;">${invoice.invoiceNumber}</strong>${invoice.dueDate ? `, due ${fmtDate(invoice.dueDate)}` : ''}.
          Click the button below to pay online by credit or debit card &mdash; it takes about 30 seconds.
        </p>

        <div style="margin: 24px 0; padding: 20px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e5e5;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #737373; font-size: 13px;">Invoice</td><td style="padding: 4px 0; text-align: right; font-weight: 600;">${invoice.invoiceNumber}</td></tr>
            <tr><td style="padding: 4px 0; color: #737373; font-size: 13px;">Total</td><td style="padding: 4px 0; text-align: right;">${fmt(invoice.total)}</td></tr>
            ${hasPartial ? `<tr><td style="padding: 4px 0; color: #16a34a; font-size: 13px;">Payments Received</td><td style="padding: 4px 0; text-align: right; color: #16a34a;">-${fmt(paidAmount)}</td></tr>` : ''}
            <tr style="border-top: 2px solid #1a5223;"><td style="padding: 10px 0 4px; font-weight: 700; font-size: 15px; color: #1a5223;">${hasPartial ? 'Balance Due' : 'Amount Due'}</td><td style="padding: 10px 0 4px; text-align: right; font-weight: 700; font-size: 20px; color: #1a5223;">${fmt(balance)}</td></tr>
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${payUrl}" style="display: inline-block; background: #1a5223; color: white; padding: 16px 40px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 17px;">
            Pay ${fmt(balance)} Now →
          </a>
          <p style="margin: 12px 0 0; font-size: 12px; color: #525252;">Secure checkout powered by Stripe.</p>
        </div>

        <div style="border-top: 1px solid #e5e5e5; padding-top: 20px; margin-top: 20px;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #737373; text-align: center;">Prefer to pay another way?</p>
          <p style="margin: 0; font-size: 13px; line-height: 1.8; text-align: center;">
            <strong style="color: #1a5223;">Phone:</strong> <a href="tel:4055311034" style="color: #1a5223; text-decoration: none;">(405) 531-1034</a>
            &nbsp;&middot;&nbsp;
            <strong style="color: #1a5223;">Email:</strong> <a href="mailto:info@frontlinepestok.com" style="color: #1a5223; text-decoration: none;">info@frontlinepestok.com</a>
          </p>
        </div>

        <p style="margin: 28px 0 0; text-align: center; color: #a3a3a3; font-size: 11px;">
          Frontline Termite and Pest Control &mdash; Edmond, Oklahoma<br>
          Thank you for your business.
        </p>
      </div>
    </div>
  `;

  if (!transporter) {
    console.log(`[EMAIL] Would send pay link for ${invoice.invoiceNumber} to ${to}`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  try {
    await transporter.sendMail({
      from: `"Frontline Termite & Pest Control" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL] Pay link for invoice ${invoice.invoiceNumber} sent to ${to}`);
    return { sent: true };
  } catch (err) {
    console.error(`[EMAIL] Failed to send pay link:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendLeadNotification, sendInvoiceEmail, sendInvoicePayLinkEmail };
