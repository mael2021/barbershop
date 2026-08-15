/**
 * Typos comunes de dominios de correo.
 *
 * Un correo mal tecleado pasa la validación de formato, se envía, y rebota. Cada rebote
 * duro daña la reputación de envío del dominio propio, así que conviene atajarlo en el
 * formulario en vez de limpiarlo después.
 *
 * La comparación es contra el dominio COMPLETO, nunca por prefijo: así `yahoo.co.uk` y
 * `hotmail.co.uk`, que son válidos, no se marcan por parecerse a `yahoo.co`.
 */
const DOMAIN_TYPOS: Record<string, string> = {
  // Gmail
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  "hmail.com": "gmail.com",

  // Hotmail
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmall.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "homail.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.cm": "hotmail.com",

  // Outlook
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outook.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",

  // Yahoo
  "yaho.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",

  // Otros
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
  "live.co": "live.com",
};

/** Devuelve el correo corregido si el dominio es un typo conocido, o `null`. */
export const suggestEmailFix = (email: string): string | null => {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex < 1) return null;

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const fixed = DOMAIN_TYPOS[domain];

  return fixed ? `${local}@${fixed}` : null;
};
