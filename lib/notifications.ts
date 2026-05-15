type NotificationPayload = {
  title: string;
  message: string;
  dueDate?: Date;
  orderId?: string;
};

export async function sendEmailReminder(_payload: NotificationPayload) {
  if (!process.env.EMAIL_API_KEY) return { skipped: true, reason: "EMAIL_API_KEY missing" };
  return { skipped: true, reason: "Email integration not implemented yet" };
}

export async function createGoogleCalendarReminder(_payload: NotificationPayload) {
  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET) {
    return { skipped: true, reason: "Google Calendar OAuth credentials missing" };
  }
  return { skipped: true, reason: "Google Calendar integration not implemented yet" };
}

export async function sendN8nWebhook(_payload: NotificationPayload) {
  if (!process.env.N8N_WEBHOOK_URL) return { skipped: true, reason: "N8N_WEBHOOK_URL missing" };
  return { skipped: true, reason: "n8n webhook integration not implemented yet" };
}
