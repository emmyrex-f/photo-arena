import type { NotificationEvent } from "./notification.types";

interface TemplateVars {
  customerName?: string;
  reference?: string;
  startTime?: string;
  amount?: string;
  details?: string;
  [key: string]: string | undefined;
}

interface EventTheme {
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  badgeLabel: string;
  headline: string;
  description: string;
}

const EVENT_THEMES: Record<NotificationEvent, EventTheme> = {
  booking_confirmed: {
    badgeBg: "rgba(46, 160, 67, 0.15)",
    badgeText: "#3fb950",
    badgeBorder: "#2ea043",
    badgeLabel: "CONFIRMED",
    headline: "Your Session is Confirmed! 🎉",
    description:
      "Thank you for booking with Photo Arena. Your studio photography session is locked in. We look forward to capturing stunning portraits with you.",
  },
  payment_received: {
    badgeBg: "rgba(46, 160, 67, 0.15)",
    badgeText: "#3fb950",
    badgeBorder: "#2ea043",
    badgeLabel: "PAYMENT SUCCESS",
    headline: "Payment Received 💳",
    description:
      "We have successfully received your payment. Please keep this receipt confirmation for your records.",
  },
  booking_created: {
    badgeBg: "rgba(226, 177, 104, 0.15)",
    badgeText: "#e2b168",
    badgeBorder: "#d29922",
    badgeLabel: "TEMPORARY HOLD",
    headline: "Booking Hold Placed ⏳",
    description:
      "A temporary hold has been reserved for your photoshoot. Please complete your payment before the hold expires to confirm your slot.",
  },
  booking_rescheduled: {
    badgeBg: "rgba(226, 177, 104, 0.15)",
    badgeText: "#e2b168",
    badgeBorder: "#d29922",
    badgeLabel: "RESCHEDULED",
    headline: "Booking Rescheduled 📅",
    description:
      "Your photoshoot has been successfully moved to a new time. Please review your updated booking details below.",
  },
  booking_reminder: {
    badgeBg: "rgba(56, 139, 253, 0.15)",
    badgeText: "#58a6ff",
    badgeBorder: "#388bfd",
    badgeLabel: "SESSION REMINDER",
    headline: "Your Shoot is Coming Up! 📸",
    description:
      "This is a friendly reminder of your upcoming photo session at Photo Arena. Here are your schedule details and prep tips.",
  },
  booking_cancelled: {
    badgeBg: "rgba(248, 81, 73, 0.15)",
    badgeText: "#f85149",
    badgeBorder: "#da3633",
    badgeLabel: "CANCELLED",
    headline: "Booking Cancelled ❌",
    description:
      "Your photoshoot booking has been cancelled. If you believe this was an error or would like to re-book, please get in touch with our studio desk.",
  },
  payment_failed: {
    badgeBg: "rgba(248, 81, 73, 0.15)",
    badgeText: "#f85149",
    badgeBorder: "#da3633",
    badgeLabel: "FAILED",
    headline: "Payment Unsuccessful ⚠️",
    description:
      "We were unable to process your payment for this booking. You can retry with a different card or contact support for help.",
  },
  checkout_abandoned: {
    badgeBg: "rgba(226, 177, 104, 0.15)",
    badgeText: "#e2b168",
    badgeBorder: "#d29922",
    badgeLabel: "ABANDONED",
    headline: "Checkout Incomplete ⏳",
    description:
      "Your photoshoot booking checkout was not completed and the temporary slot hold has been released. If you would like to secure this session, please visit our booking page to re-book.",
  },
  password_reset: {
    badgeBg: "rgba(226, 177, 104, 0.15)",
    badgeText: "#e2b168",
    badgeBorder: "#d29922",
    badgeLabel: "SECURITY",
    headline: "Password Reset Request",
    description: "A password reset request was initiated for your Photo Arena account.",
  },
  manual_notice: {
    badgeBg: "rgba(226, 177, 104, 0.15)",
    badgeText: "#e2b168",
    badgeBorder: "#d29922",
    badgeLabel: "STUDIO NOTICE",
    headline: "Message from Photo Arena Desk",
    description: "An update regarding your studio booking or account.",
  },
};

function formatIsoDate(isoString?: string): string {
  if (!isoString) return "Scheduled";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Africa/Lagos",
    }) + " (WAT)";
  } catch {
    return isoString;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildEventEmail(
  event: NotificationEvent,
  vars: TemplateVars,
): { subject: string; text: string; html: string } {
  const theme = EVENT_THEMES[event] ?? EVENT_THEMES.booking_confirmed;
  const customerName = vars.customerName?.trim() || "Valued Customer";
  const reference = vars.reference?.trim() || "N/A";
  const formattedTime = formatIsoDate(vars.startTime);
  const amount = vars.amount?.trim();
  const details = vars.details?.trim();

  // Subject line
  let subject = `Photo Arena — ${theme.headline.replace(/ [^\s]+$/, "")}`;
  if (reference && reference !== "N/A" && reference !== "TEST") {
    subject += ` [${reference}]`;
  }

  // Plain text fallback
  const textLines = [
    `PHOTO ARENA STUDIO`,
    `--------------------------------------------------`,
    theme.headline,
    ``,
    `Hello ${customerName},`,
    ``,
    theme.description,
    ``,
    `BOOKING DETAILS:`,
    `• Reference: ${reference}`,
    vars.startTime ? `• Date & Time: ${formattedTime}` : null,
    amount ? `• Amount: ${amount}` : null,
    details ? `• Note / Details: ${details}` : null,
    ``,
    event === "booking_reminder" || event === "booking_confirmed"
      ? `STUDIO TIPS:\n• Please arrive 10 minutes before your scheduled start time.\n• Dressing rooms and full-length vanity mirrors are available on-site.\n• Need to reschedule? Please contact us at least 24 hours in advance.`
      : null,
    ``,
    `--------------------------------------------------`,
    `Photo Arena Studio · Port Harcourt, Rivers State, Nigeria`,
    `Support & Inquiries: support@photoarenang.com`,
    `You received this transactional service email regarding your booking with Photo Arena.`,
    `To manage notification preferences or unsubscribe from reminders: support@photoarenang.com?subject=Unsubscribe%20${reference}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  // Rich HTML template
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#0b0e14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f0f6fc;-webkit-font-smoothing:antialiased;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;margin:0 auto;background-color:#11161d;border:1px solid #252d3a;border-radius:14px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.6);">
    <!-- Studio Header -->
    <tr>
      <td style="padding:32px 32px 24px 32px;border-bottom:1px solid #252d3a;text-align:center;background:linear-gradient(180deg, #161c26 0%, #11161d 100%);">
        <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:0.08em;color:#e2b168;text-transform:uppercase;">Photo Arena</h1>
        <p style="margin:4px 0 0 0;font-size:12px;color:#8b949e;letter-spacing:0.18em;text-transform:uppercase;">Studio Photography &amp; Desk</p>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding:32px;">
        <!-- Status Pill -->
        <div style="margin-bottom:20px;">
          <span style="display:inline-block;padding:4px 12px;background-color:${theme.badgeBg};color:${theme.badgeText};border:1px solid ${theme.badgeBorder};border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
            ${escapeHtml(theme.badgeLabel)}
          </span>
        </div>

        <h2 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#ffffff;line-height:1.3;">
          ${escapeHtml(theme.headline)}
        </h2>

        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#c9d1d9;">
          Hello <strong style="color:#ffffff;">${escapeHtml(customerName)}</strong>,
        </p>

        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#8b949e;">
          ${escapeHtml(theme.description)}
        </p>

        <!-- Summary Table -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px 0;background-color:#0b0e14;border:1px solid #252d3a;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:14px 18px;border-bottom:1px solid #1f2733;font-size:13px;color:#8b949e;width:40%;">Booking Reference</td>
            <td style="padding:14px 18px;border-bottom:1px solid #1f2733;font-size:14px;color:#e2b168;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
              ${escapeHtml(reference)}
            </td>
          </tr>
          ${
            vars.startTime
              ? `
          <tr>
            <td style="padding:14px 18px;border-bottom:1px solid #1f2733;font-size:13px;color:#8b949e;">Date &amp; Time</td>
            <td style="padding:14px 18px;border-bottom:1px solid #1f2733;font-size:14px;color:#ffffff;font-weight:500;">
              ${escapeHtml(formattedTime)}
            </td>
          </tr>
          `
              : ""
          }
          ${
            amount
              ? `
          <tr>
            <td style="padding:14px 18px;border-bottom:1px solid #1f2733;font-size:13px;color:#8b949e;">Amount Paid</td>
            <td style="padding:14px 18px;border-bottom:1px solid #1f2733;font-size:14px;color:#3fb950;font-weight:600;">
              ${escapeHtml(amount)}
            </td>
          </tr>
          `
              : ""
          }
          ${
            details
              ? `
          <tr>
            <td style="padding:14px 18px;font-size:13px;color:#8b949e;">Notes / Info</td>
            <td style="padding:14px 18px;font-size:13px;color:#c9d1d9;line-height:1.5;">
              ${escapeHtml(details)}
            </td>
          </tr>
          `
              : ""
          }
        </table>

        ${
          event === "booking_reminder" || event === "booking_confirmed"
            ? `
        <!-- Prep Tips Box -->
        <div style="margin:0 0 24px 0;padding:16px 20px;background-color:#161c26;border-left:3px solid #e2b168;border-radius:6px;">
          <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;color:#e2b168;text-transform:uppercase;letter-spacing:0.04em;">
            Session Preparation Tips
          </p>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#c9d1d9;line-height:1.6;">
            <li>Please arrive 10 minutes before your shoot to settle in.</li>
            <li>Dressing suites with vanity mirrors and garment steamers are provided.</li>
            <li>Feel free to bring multiple outfit options and personal props.</li>
          </ul>
        </div>
        `
            : ""
        }

        <p style="margin:0;font-size:14px;line-height:1.5;color:#8b949e;">
          If you have any questions or need to make adjustments, simply reach out to our studio team at 
          <a href="mailto:support@photoarenang.com" style="color:#e2b168;text-decoration:none;">support@photoarenang.com</a>.
        </p>
      </td>
    </tr>

    <!-- Studio Address & Unsubscribe Footer -->
    <tr>
      <td style="padding:24px 32px;background-color:#0b0e14;border-top:1px solid #252d3a;text-align:center;">
        <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:#c9d1d9;">
          Photo Arena Studio
        </p>
        <p style="margin:0 0 10px 0;font-size:12px;color:#6e7681;line-height:1.5;">
          Port Harcourt, Rivers State, Nigeria · support@photoarenang.com
        </p>
        <p style="margin:0 0 8px 0;font-size:11px;color:#6e7681;line-height:1.5;">
          You received this transactional service email regarding your booking reference <strong>${escapeHtml(reference)}</strong>.
        </p>
        <p style="margin:0;font-size:11px;color:#6e7681;line-height:1.5;">
          <a href="mailto:support@photoarenang.com?subject=Photo%20Arena%20Support%20${encodeURIComponent(reference)}" style="color:#8b949e;text-decoration:underline;">Support Contact</a>
          &nbsp;·&nbsp;
          <a href="mailto:support@photoarenang.com?subject=Unsubscribe%20from%20reminders%20${encodeURIComponent(reference)}" style="color:#6e7681;text-decoration:underline;">Unsubscribe from session reminders</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, text: textLines, html };
}

export function buildManualNotificationEmail(input: {
  subject: string;
  message: string;
  customerName?: string;
  senderEmail?: string;
}): { subject: string; text: string; html: string } {
  const customerName = input.customerName?.trim() || "Valued Client";
  const subject = input.subject.trim();
  const rawMessage = input.message.trim();
  const escapedMessage = escapeHtml(rawMessage).replace(/\n/g, "<br/>");

  const text = [
    `PHOTO ARENA STUDIO`,
    `--------------------------------------------------`,
    subject,
    ``,
    `Hello ${customerName},`,
    ``,
    rawMessage,
    ``,
    `--------------------------------------------------`,
    `Photo Arena Studio · Port Harcourt, Rivers State, Nigeria`,
    `Support & Inquiries: support@photoarenang.com`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#0b0e14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f0f6fc;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;margin:0 auto;background-color:#11161d;border:1px solid #252d3a;border-radius:14px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.6);">
    <tr>
      <td style="padding:32px 32px 24px 32px;border-bottom:1px solid #252d3a;text-align:center;background:linear-gradient(180deg, #161c26 0%, #11161d 100%);">
        <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:0.08em;color:#e2b168;text-transform:uppercase;">Photo Arena</h1>
        <p style="margin:4px 0 0 0;font-size:12px;color:#8b949e;letter-spacing:0.18em;text-transform:uppercase;">Studio Desk Notice</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#ffffff;">${escapeHtml(subject)}</h2>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#c9d1d9;">Hello <strong>${escapeHtml(customerName)}</strong>,</p>
        <div style="margin:0 0 24px 0;padding:20px;background-color:#0b0e14;border:1px solid #252d3a;border-radius:8px;font-size:15px;line-height:1.7;color:#e6edf3;">
          ${escapedMessage}
        </div>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#8b949e;">
          If you have any questions or wish to respond, please reply directly or reach us at <a href="mailto:support@photoarenang.com" style="color:#e2b168;text-decoration:none;">support@photoarenang.com</a>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background-color:#0b0e14;border-top:1px solid #252d3a;text-align:center;">
        <p style="margin:0 0 4px 0;font-size:12px;color:#6e7681;">Photo Arena Studio · Port Harcourt, Rivers State, Nigeria</p>
        <p style="margin:0;font-size:11px;color:#6e7681;">
          <a href="mailto:support@photoarenang.com?subject=Unsubscribe%20from%20notices" style="color:#6e7681;text-decoration:underline;">Unsubscribe from broadcast emails</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, text, html };
}
