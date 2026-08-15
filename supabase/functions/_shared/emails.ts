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

// Paleta clara. Los acentos NO son los del sitio tal cual: el verde neón (#39ff14) y el
// naranja (#ff9e35) de la marca dan ~1.5:1 de contraste sobre blanco, ilegibles. Aquí se
// usan versiones oscurecidas del mismo tono, todas por encima de 4.5:1 (WCAG AA).
const BRAND = {
  name: "Master Cuts",
  page: "#f4f4f5",
  card: "#ffffff",
  border: "#e4e4e7",
  text: "#18181b",
  textSoft: "#52525b",
  textMuted: "#71717a",
  green: "#15803d",
  purple: "#6d28d9",
  amber: "#b45309",
  address: "1° de Mayo 1, Sexto Barrio Emiliano Zapata, 90150 Panotla, Tlax.",
  maps: "https://maps.app.goo.gl/DP9atTbrUC1md4kT9",
  phone: "+52 246 202 1022",
  phoneHref: "+522462021022",
  tagline: "✂️🔥 Master Cuts Barbería 🔥✂️",
  owner: "NewBloom",
  ownerUrl: "https://newbloom.com.mx/",
  developer: "IFerretAI",
};

// Calculado, no fijo: un "© 2026" hardcodeado queda viejo el 1 de enero.
const currentYear = () => new Date().getFullYear();

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

/**
 * Animaciones como mejora progresiva.
 *
 * Gmail, Outlook y Yahoo eliminan `animation` y `@keyframes` al sanitizar; Apple Mail y
 * Mail de iOS sí las ejecutan. Regla crítica: el estado inicial (opacity/transform) vive
 * SOLO aquí dentro, nunca en un style inline. Si el cliente borra este bloque, el correo
 * queda estático y completamente visible — jamás en blanco.
 */
const ANIMATIONS = `
  @keyframes mc-rise {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes mc-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes mc-sweep {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }

  @media (prefers-reduced-motion: no-preference) {
    .mc-card  { animation: mc-rise .55s cubic-bezier(.22,.68,.32,1) both; }
    .mc-bar   { animation: mc-sweep .7s cubic-bezier(.22,.68,.32,1) both; transform-origin: left center; }
    .mc-s1    { animation: mc-fade .5s ease-out .18s both; }
    .mc-s2    { animation: mc-fade .5s ease-out .30s both; }
    .mc-s3    { animation: mc-rise .5s ease-out .42s both; }
    .mc-s4    { animation: mc-fade .5s ease-out .54s both; }
  }

  .mc-cta { transition: transform .18s ease, box-shadow .18s ease; }
  .mc-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,.16) !important; }

  @media (max-width: 620px) {
    .mc-pad { padding-left: 22px !important; padding-right: 22px !important; }
    .mc-h1  { font-size: 24px !important; }
  }
`;

/** Filas de servicios + total, en tabla para que Outlook no rompa el layout. */
const servicesTable = (reservation: Reservation, accent: string) => {
  const { items, total } = priceServices(reservation.services);

  const rows = items
    .map(
      item => `
        <tr>
          <td style="padding:7px 0;color:${BRAND.text};font-size:15px;">${escapeHtml(item.name)}</td>
          <td style="padding:7px 0;color:${accent};font-size:15px;font-weight:600;text-align:right;white-space:nowrap;">
            ${item.price === null ? "A consultar" : `$${item.price} MXN`}
          </td>
        </tr>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows}
      <tr>
        <td colspan="2" style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;height:12px;">&nbsp;</td>
      </tr>
      <tr>
        <td style="color:${BRAND.text};font-size:16px;font-weight:700;">Total</td>
        <td style="color:${accent};font-size:16px;font-weight:700;text-align:right;white-space:nowrap;">$${total} MXN</td>
      </tr>
    </table>`;
};

const detailRow = (label: string, value: string) => `
  <tr>
    <td style="padding:9px 0;color:${BRAND.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;width:110px;vertical-align:top;">
      ${escapeHtml(label)}
    </td>
    <td style="padding:9px 0;color:${BRAND.text};font-size:16px;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;

/** Desglose de servicios en texto plano, alineado con puntos suspensivos. */
const servicesText = (reservation: Reservation) => {
  const { items, total } = priceServices(reservation.services);
  const lines = items.map(i => `  - ${i.name}: ${i.price === null ? "a consultar" : `$${i.price} MXN`}`);

  return [...lines, `  TOTAL: $${total} MXN`].join("\n");
};

/** Pie común de la versión en texto plano. */
const footerText = () =>
  [
    "---",
    BRAND.name,
    BRAND.address,
    `Cómo llegar: ${BRAND.maps}`,
    `¿Necesitas cambiar tu cita? Llámanos al ${BRAND.phone}.`,
    "",
    `Recibes este correo porque agendaste una cita en ${BRAND.name}.`,
    "",
    BRAND.tagline,
    `© ${currentYear()} ${BRAND.owner} — Todos los derechos reservados. ${BRAND.ownerUrl}`,
    `Desarrollado por ${BRAND.developer}`,
  ].join("\n");

/** Shell común: fondo claro, tarjeta blanca centrada de 600px. */
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
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(heading)}</title>
  <style>${ANIMATIONS}</style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.page};padding:36px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" class="mc-card" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

          <tr>
            <td class="mc-bar" style="background-color:${accent};height:5px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td class="mc-pad mc-s1" style="padding:34px 36px 8px 36px;">
              <p style="margin:0 0 8px 0;color:${accent};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;">
                ${escapeHtml(eyebrow)}
              </p>
              <h1 class="mc-h1" style="margin:0;color:${BRAND.text};font-size:29px;line-height:1.18;font-weight:800;letter-spacing:-.02em;text-transform:uppercase;">
                ${escapeHtml(heading)}
              </h1>
              <p style="margin:14px 0 0 0;color:${BRAND.textSoft};font-size:16px;line-height:1.6;">${intro}</p>
            </td>
          </tr>

          <tr>
            <td class="mc-pad mc-s2" style="padding:20px 36px 0 36px;">${body}</td>
          </tr>

          <tr>
            <td class="mc-pad mc-s4" style="padding:28px 36px 10px 36px;" align="center">
              <a href="${ctaUrl}" class="mc-cta" style="display:inline-block;background-color:${accent};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:9999px;text-transform:uppercase;letter-spacing:.04em;box-shadow:0 2px 6px rgba(0,0,0,.10);">
                ${escapeHtml(ctaLabel)}
              </a>
            </td>
          </tr>

          <tr>
            <td class="mc-pad" style="padding:26px 36px 32px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;height:22px;">&nbsp;</td></tr>
              </table>
              <p style="margin:0 0 4px 0;color:${BRAND.textSoft};font-size:13px;line-height:1.6;">
                <strong style="color:${BRAND.text};">${BRAND.name}</strong><br>
                ${escapeHtml(BRAND.address)}
              </p>
              <p style="margin:8px 0 0 0;color:${BRAND.textSoft};font-size:13px;">
                ¿Necesitas cambiar tu cita? Llámanos al
                <a href="tel:${BRAND.phoneHref}" style="color:${accent};text-decoration:none;font-weight:600;">${BRAND.phone}</a>.
              </p>
              <p style="margin:16px 0 0 0;color:${BRAND.textMuted};font-size:11px;line-height:1.5;">
                Recibes este correo porque agendaste una cita en ${BRAND.name}.
              </p>
            </td>
          </tr>

          <tr>
            <td class="mc-pad" style="padding:4px 36px 30px 36px;" align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;height:20px;">&nbsp;</td></tr>
              </table>
              <p style="margin:0 0 7px 0;color:${BRAND.text};font-size:14px;font-weight:700;letter-spacing:.01em;">
                ${BRAND.tagline}
              </p>
              <p style="margin:0;color:${BRAND.textMuted};font-size:12px;line-height:1.75;">
                © ${currentYear()} <a href="${BRAND.ownerUrl}" style="color:${accent};text-decoration:none;font-weight:600;">${BRAND.owner}</a> — Todos los derechos reservados.<br>
                Desarrollado por ${BRAND.developer}
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
    <div class="mc-s3" style="margin-top:20px;padding:22px;background-color:${BRAND.page};border:1px solid ${BRAND.border};border-radius:12px;">
      <p style="margin:0 0 14px 0;color:${BRAND.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;">
        Servicios
      </p>
      ${servicesTable(reservation, BRAND.amber)}
    </div>
    <p style="margin:20px 0 0 0;color:${BRAND.textSoft};font-size:14px;line-height:1.6;">
      Te esperamos unos minutos antes de tu hora para que empecemos puntuales.
    </p>`;

  const text = [
    `¡Listo, ${reservation.customer_name.trim().split(/\s+/)[0]}!`,
    "",
    `Tu lugar en ${BRAND.name} está apartado. Aquí están los detalles:`,
    "",
    `FECHA: ${longDate}`,
    `HORA:  ${reservation.time}`,
    "",
    "SERVICIOS",
    servicesText(reservation),
    "",
    "Te esperamos unos minutos antes de tu hora para que empecemos puntuales.",
    "",
    footerText(),
  ].join("\n");

  return {
    subject: `Cita confirmada — ${longDate} a las ${reservation.time}`,
    text,
    html: layout({
      preheader: `Tu cita en ${BRAND.name} quedó agendada para el ${longDate} a las ${reservation.time}.`,
      accent: BRAND.green,
      eyebrow: "Cita confirmada",
      heading: `¡Listo, ${firstName(reservation.customer_name)}!`,
      intro: `Tu lugar en <strong style="color:${BRAND.text};">${BRAND.name}</strong> está apartado. Aquí están los detalles:`,
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
    <div class="mc-s3" style="margin-top:20px;padding:22px;background-color:${BRAND.page};border:1px solid ${BRAND.border};border-radius:12px;">
      <p style="margin:0 0 14px 0;color:${BRAND.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;">
        Lo que te vamos a hacer
      </p>
      ${servicesTable(reservation, BRAND.purple)}
    </div>
    <p style="margin:20px 0 0 0;color:${BRAND.textSoft};font-size:14px;line-height:1.6;">
      Si algo se te atravesó y ya no puedes venir, avísanos al
      <a href="tel:${BRAND.phoneHref}" style="color:${BRAND.purple};text-decoration:none;font-weight:600;">${BRAND.phone}</a>
      para liberar el horario.
    </p>`;

  const text = [
    "Tu cita te espera",
    "",
    `${reservation.customer_name.trim().split(/\s+/)[0]}, faltan un par de horas para tu cita en ${BRAND.name}.`,
    "",
    `HOY:  ${longDate}`,
    `HORA: ${reservation.time}`,
    "",
    "LO QUE TE VAMOS A HACER",
    servicesText(reservation),
    "",
    `Si algo se te atravesó y ya no puedes venir, avísanos al ${BRAND.phone} para liberar el horario.`,
    "",
    footerText(),
  ].join("\n");

  return {
    subject: `Tu cita te espera hoy a las ${reservation.time}`,
    text,
    html: layout({
      preheader: `Faltan un par de horas para tu cita en ${BRAND.name}.`,
      accent: BRAND.purple,
      eyebrow: "Recordatorio",
      heading: "Tu cita te espera",
      intro: `${firstName(reservation.customer_name)}, faltan un par de horas para tu cita en <strong style="color:${BRAND.text};">${BRAND.name}</strong>.`,
      body,
      ctaLabel: "Ver cómo llegar",
      ctaUrl: BRAND.maps,
    }),
  };
};
