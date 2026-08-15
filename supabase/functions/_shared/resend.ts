const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Remitente por defecto: dominio ya verificado en Resend (newbloom.com.mx).
const DEFAULT_FROM = "Master Cuts <no-reply@newbloom.com.mx>";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Alternativa en texto plano. Mandar multipart mejora la entregabilidad:
   *  el correo solo-HTML es un patrón que los filtros asocian con spam. */
  text: string;
}

export const sendEmail = async ({ to, subject, html, text }: SendEmailInput): Promise<{ id: string }> => {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("Falta el secret RESEND_API_KEY");

  // El dominio no tiene MX, así que una respuesta a no-reply@ le rebotaría al cliente.
  // Con RESEND_REPLY_TO configurado, las respuestas llegan a un buzón que sí se lee.
  const replyTo = Deno.env.get("RESEND_REPLY_TO");

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
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Resend respondió ${response.status}: ${payload?.message ?? response.statusText}`);
  }

  return payload as { id: string };
};
