const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Remitente por defecto: dominio ya verificado en Resend (newbloom.com.mx).
const DEFAULT_FROM = "Master Cuts <no-reply@newbloom.com.mx>";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: SendEmailInput): Promise<{ id: string }> => {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("Falta el secret RESEND_API_KEY");

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM") ?? DEFAULT_FROM,
      to: [to],
      subject,
      html,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Resend respondió ${response.status}: ${payload?.message ?? response.statusText}`);
  }

  return payload as { id: string };
};
