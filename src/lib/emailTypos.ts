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

/**
 * TLDs legítimos y frecuentes en México. Si el dominio termina en uno de estos, la
 * capa 3b no aplica: `mibarberia.mx` es un dominio propio válido, no un `gmail.com`
 * mal escrito, aunque la raíz se pareciera de casualidad.
 */
const VALID_TLDS = new Set(["com", "mx", "org", "net", "io", "es", "dev", "app", "co.uk"]);

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

/**
 * Distancia de Damerau-Levenshtein: cuenta la transposición de dos letras contiguas
 * como UNA edición, no dos. Importa porque invertir letras ("gmial" por "gmail") es el
 * error de tecleo más frecuente, y con Levenshtein simple costaba 2 y se escapaba.
 */
const editDistance = (a: string, b: string): number => {
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];

  for (let i = 1; i <= a.length; i++) {
    rows[i] = [i];

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i][j - 1] + 1, rows[i - 1][j] + 1, rows[i - 1][j - 1] + cost);

      // Transposición: las dos letras están cruzadas respecto al candidato.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2][j - 2] + 1);
      }

      rows[i][j] = best;
    }
  }

  return rows[a.length][b.length];
};

/** Parte el dominio en raíz y TLD: "gmsl.co" -> { root: "gmsl", tld: "co" } */
const splitDomain = (domain: string) => {
  const lastDot = domain.lastIndexOf(".");
  if (lastDot < 1) return null;

  return { root: domain.slice(0, lastDot), tld: domain.slice(lastDot + 1) };
};

/**
 * Umbral por longitud de raíz. Una raíz corta como "aol" (3 letras) con tolerancia 2
 * marcaría casi cualquier cosa, así que las cortas exigen coincidencia mucho más
 * estrecha. Es deliberadamente conservador: bloquear el correo de un cliente real es
 * peor que dejar pasar un typo, porque el rebote lo atrapa después la lista de supresión.
 */
const rootThreshold = (root: string) => (root.length <= 4 ? 1 : 2);

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

  // Capa 3a: dominio completo parecido a un proveedor popular.
  for (const candidate of POPULAR) {
    const distance = editDistance(domain, candidate);
    if (distance <= 2 && (!best || distance < best.distance)) {
      best = { domain: candidate, distance };
    }
  }
  if (best) return `${local}@${best.domain}`;

  // Capa 3b: la raíz se parece a un proveedor pero el TLD también viene mal
  // ("gmsl.co"). Comparar el dominio entero fallaba porque acumulaba los errores
  // de la raíz y del TLD en una sola distancia.
  const parts = splitDomain(domain);
  if (!parts || VALID_TLDS.has(parts.tld)) return null;

  for (const candidate of POPULAR) {
    const candidateParts = splitDomain(candidate)!;
    const distance = editDistance(parts.root, candidateParts.root);

    if (distance <= rootThreshold(candidateParts.root) && (!best || distance < best.distance)) {
      best = { domain: candidate, distance };
    }
  }

  return best ? `${local}@${best.domain}` : null;
};
