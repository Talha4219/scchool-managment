import nodemailer from "nodemailer";

// Real SMTP delivery for password resets and other transactional mail.
// Activates automatically once SMTP_HOST/PORT/USER/PASS are set (works with
// any provider — Gmail app password, SendGrid, Mailgun, school's own mail
// server, etc.); until then `isEmailConfigured()` returns false so callers
// can fall back to displaying the link/content directly instead of pretending
// to have sent something.

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<{ error?: string }> {
  if (!isEmailConfigured()) return { error: "Email delivery is not configured for this school yet." };
  try {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    // Ethereal (a real SMTP sandbox, not a live provider) returns a URL to view
    // the delivered message instead of actually reaching an inbox — surface it
    // in the server log so a test send can be confirmed without real mail access.
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[email] Ethereal preview: ${preview}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send email." };
  }
}
