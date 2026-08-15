/**
 * Detección de dominios de correo mal tecleados.
 *
 * Un correo con typo pasa la validación de formato, se envía y rebota. Cada rebote duro
 * daña la reputación de envío del dominio propio, así que conviene atajarlo en el
 * formulario en vez de limpiarlo después.
 *
 * Estrategia en tres capas, porque una lista fija de typos solo atrapa lo que alguien
 * anticipó (`gmil.co` se coló por eso):
 *   1. Dominio en la lista de válidos conocidos -> se acepta sin más.
 *   2. Dominio en el mapa de typos frecuentes   -> se sugiere la corrección exacta.
 *   3. Distancia de edición <= 2 a un proveedor popular -> se sugiere el más cercano.
 *
 * Los dominios corporativos o propios (novacode.io, una pyme, etc.) quedan lejos de
 * cualquier proveedor popular, así que la capa 3 no los toca.
 */

/**
 * Dominios válidos que NUNCA se deben marcar.
 *
 * Es la protección contra falsos positivos de la capa 3: `mail.com` es un proveedor real
 * y está a distancia 1 de `gmail.com`, así que sin esta lista se marcaría como typo.
 */
const KNOWN_VALID = new Set([
  "gmail.com", "googlemail.com",
  "hotmail.com", "hotmail.es", "hotmail.com.mx", "hotmail.co.uk",
  "outlook.com", "outlook.es", "outlook.com.mx",
  "yahoo.com", "yahoo.com.mx", "yahoo.es", "yahoo.co.uk",
  "icloud.com", "me.com", "mac.com",
  "live.com", "live.com.mx", "live.mx",
  "msn.com", "aol.com", "mail.com", "gmx.com", "gmx.es",
  "protonmail.com", "proton.me", "zoho.com", "yandex.com",
  "prodigy.net.mx", "terra.com.mx", "att.net.mx",
]);

/** Proveedores populares contra los que se mide la similitud. */
const POPULAR = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "msn.com",
  "aol.com",
];

/** Typos frecuentes que quedan fuera del umbral de distancia o son ambiguos. */
const EXPLICIT_TYPOS: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlook.con": "outlook.com",
  "outlook.co": "outlook.com",
  "yahoo.con": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "icloud.co": "icloud.com",
  "live.co": "live.com",
};

/** Distancia de Levenshtein con corte temprano: si supera `max`, devuelve max + 1. */
const editDistance = (a: string, b: string, max: number): number => {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }

    // Ninguna celda de la fila baja de `max`: el resultado final tampoco podrá.
    if (rowMin > max) return max + 1;
    prev = curr;
  }

  return prev[b.length];
};

/** Devuelve el correo corregido si el dominio parece un typo, o `null`. */
export const suggestEmailFix = (email: string): string | null => {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex < 1) return null;

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return null;

  if (KNOWN_VALID.has(domain)) return null;

  const explicit = EXPLICIT_TYPOS[domain];
  if (explicit) return `${local}@${explicit}`;

  let best: { domain: string; distance: number } | null = null;
  for (const candidate of POPULAR) {
    const distance = editDistance(domain, candidate, 2);
    if (distance <= 2 && (!best || distance < best.distance)) {
      best = { domain: candidate, distance };
    }
  }

  return best ? `${local}@${best.domain}` : null;
};
