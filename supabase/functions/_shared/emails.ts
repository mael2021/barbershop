import { formatLongDate } from "./datetime.ts";
import { priceServices } from "./services.ts";

export interface Reservation {
  id: number;
  services: string[];
  date: string;
  time: string;
  customer_name: string;
  phone: string;
  email: string;
  status: string;
}

const BRAND = {
  name: "Master Cuts",
  dark: "#1a1a1a",
  gray: "#2d2d2d",
  green: "#39ff14",
  orange: "#ff9e35",
  purple: "#8b5cf6",
  address: "1° de Mayo 1, Sexto Barrio Emiliano Zapata, 90150 Panotla, Tlax.",
  maps: "https://maps.app.goo.gl/DP9atTbrUC1md4kT9",
  phone: "+52 246 202 1022",
  phoneHref: "+522462021022",
};

// Antes de que el formulario pidiera el correo, la app guardaba este relleno en todas
// las reservas (~3.6k filas). Tiene "@", así que hay que descartarlo explícitamente:
// enviarle correo produce hard bounces contra un dominio ajeno y eso quema la
// reputación de envío del dominio propio.
const PLACEHOLDER_EMAILS = new Set(["no-email@barberia.com"]);

export const isSendableEmail = (email: string | null | undefined): email is string => {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();
  if (PLACEHOLDER_EMAILS.has(normalized)) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const firstName = (fullName: string) => escapeHtml(fullName.trim().split(/\s+/)[0] ?? fullName);

/** Filas de servicios + total, en tabla para que Outlook no rompa el layout. */
const servicesTable = (reservation: Reservation, accent: string) => {
  const { items, total } = priceServices(reservation.services);

  const rows = items
    .map(
      item => `
        <tr>
          <td style="padding:6px 0;color:#ffffff;font-size:15px;">${escapeHtml(item.name)}</td>
          <td style="padding:6px 0;color:${accent};font-size:15px;text-align:right;white-space:nowrap;">
            ${item.price === null ? "A consultar" : `$${item.price} MXN`}
          </td>
        </tr>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows}
      <tr>
        <td colspan="2" style="border-top:1px solid #4b5563;font-size:0;line-height:0;height:12px;">&nbsp;</td>
      </tr>
      <tr>
        <td style="color:#ffffff;font-size:16px;font-weight:bold;">Total</td>
        <td style="color:${accent};font-size:16px;font-weight:bold;text-align:right;white-space:nowrap;">$${total} MXN</td>
      </tr>
    </table>`;
};

const detailRow = (label: string, value: string) => `
  <tr>
    <td style="padding:8px 0;color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:.04em;width:110px;">
      ${escapeHtml(label)}
    </td>
    <td style="padding:8px 0;color:#ffffff;font-size:16px;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;

/** Shell común: fondo oscuro, tarjeta centrada, ancho fijo de 600px. */
const layout = ({
  preheader,
  accent,
  eyebrow,
  heading,
  intro,
  body,
  ctaLabel,
  ctaUrl,
}: {
  preheader: string;
  accent: string;
  eyebrow: string;
  heading: string;
  intro: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.dark};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.dark};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.gray};border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

          <tr>
            <td style="background-color:${accent};height:6px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <p style="margin:0 0 6px 0;color:${accent};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.12em;">
                ${escapeHtml(eyebrow)}
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.2;font-weight:800;text-transform:uppercase;">
                ${escapeHtml(heading)}
              </h1>
              <p style="margin:16px 0 0 0;color:#d1d5db;font-size:16px;line-height:1.6;">${intro}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 0 32px;">${body}</td>
          </tr>

          <tr>
            <td style="padding:28px 32px 8px 32px;" align="center">
              <a href="${ctaUrl}" style="display:inline-block;background-color:${accent};color:${BRAND.dark};font-size:15px;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:9999px;text-transform:uppercase;letter-spacing:.03em;">
                ${escapeHtml(ctaLabel)}
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 32px 32px;border-top:1px solid #4b5563;">
              <p style="margin:24px 0 4px 0;color:#9ca3af;font-size:13px;line-height:1.6;">
                <strong style="color:#ffffff;">${BRAND.name}</strong><br>
                ${escapeHtml(BRAND.address)}
              </p>
              <p style="margin:8px 0 0 0;color:#9ca3af;font-size:13px;">
                ¿Necesitas cambiar tu cita? Llámanos al
                <a href="tel:${BRAND.phoneHref}" style="color:${accent};text-decoration:none;">${BRAND.phone}</a>.
              </p>
              <p style="margin:16px 0 0 0;color:#6b7280;font-size:11px;line-height:1.5;">
                Recibes este correo porque agendaste una cita en ${BRAND.name}.
                Este buzón no recibe respuestas.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const confirmationEmail = (reservation: Reservation) => {
  const longDate = formatLongDate(reservation.date);

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${detailRow("Fecha", longDate)}
      ${detailRow("Hora", reservation.time)}
    </table>
    <div style="margin-top:20px;padding:20px;background-color:${BRAND.dark};border-radius:12px;">
      <p style="margin:0 0 12px 0;color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:.04em;font-weight:bold;">
        Servicios
      </p>
      ${servicesTable(reservation, BRAND.orange)}
    </div>
    <p style="margin:20px 0 0 0;color:#9ca3af;font-size:14px;line-height:1.6;">
      Te esperamos unos minutos antes de tu hora para que empecemos puntuales.
    </p>`;

  return {
    subject: `Cita confirmada — ${longDate} a las ${reservation.time}`,
    html: layout({
      preheader: `Tu cita en ${BRAND.name} quedó agendada para el ${longDate} a las ${reservation.time}.`,
      accent: BRAND.green,
      eyebrow: "Cita confirmada",
      heading: `¡Listo, ${firstName(reservation.customer_name)}!`,
      intro: `Tu lugar en <strong style="color:#ffffff;">${BRAND.name}</strong> está apartado. Aquí están los detalles:`,
      body,
      ctaLabel: "Ver cómo llegar",
      ctaUrl: BRAND.maps,
    }),
  };
};

export const reminderEmail = (reservation: Reservation) => {
  const longDate = formatLongDate(reservation.date);

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${detailRow("Hoy", longDate)}
      ${detailRow("Hora", reservation.time)}
    </table>
    <div style="margin-top:20px;padding:20px;background-color:${BRAND.dark};border-radius:12px;">
      <p style="margin:0 0 12px 0;color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:.04em;font-weight:bold;">
        Lo que te vamos a hacer
      </p>
      ${servicesTable(reservation, BRAND.purple)}
    </div>
    <p style="margin:20px 0 0 0;color:#9ca3af;font-size:14px;line-height:1.6;">
      Si algo se te atravesó y ya no puedes venir, avísanos al
      <a href="tel:${BRAND.phoneHref}" style="color:${BRAND.purple};text-decoration:none;">${BRAND.phone}</a>
      para liberar el horario.
    </p>`;

  return {
    subject: `Tu cita te espera hoy a las ${reservation.time}`,
    html: layout({
      preheader: `Faltan un par de horas para tu cita en ${BRAND.name}.`,
      accent: BRAND.purple,
      eyebrow: "Recordatorio",
      heading: "Tu cita te espera",
      intro: `${firstName(reservation.customer_name)}, faltan un par de horas para tu cita en <strong style="color:#ffffff;">${BRAND.name}</strong>.`,
      body,
      ctaLabel: "Ver cómo llegar",
      ctaUrl: BRAND.maps,
    }),
  };
};
