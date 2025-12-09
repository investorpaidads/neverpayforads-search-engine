// bank-logos.ts
// -------------------------------
// BIN-based Bank Logo Fetcher with server-side API
// -------------------------------

const LOGO_CACHE = new Map<string, string | null>();

/**
 * Extract BIN (first 6–8 digits)
 */
function getBIN(cardNumber: string): string | null {
  if (!cardNumber) return null;
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.substring(0, 8); // support up to BIN8
}

/**
 * Lookup BIN metadata via our Next.js API
 * Calls /api/bin/[bin] on the same origin
 */
async function lookupBankByBIN(bin: string) {
  try {
    const res = await fetch(`/api/bin/${bin}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      bankName: data.bank?.name || null,
      bankUrl: data.bank?.url || null,
      country: data.country?.name || null,
    };
  } catch {
    return null;
  }
}

/**
 * Try to fetch real bank logo from Clearbit
 */
async function tryClearbitLogo(domain: string): Promise<string | null> {
  const logoUrl = `https://logo.clearbit.com/${domain}`;
  try {
    const res = await fetch(logoUrl, { method: "HEAD" });
    if (res.ok) return logoUrl;
  } catch {}
  return null;
}

/**
 * Generate fallback SVG logo with initials
 */
function makeFallbackLogo(name: string): string {
  const initials = name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const colors = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
    "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"
  ];
  const color = colors[name.charCodeAt(0) % colors.length];

  const svg = `
    <svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" rx="12" fill="${color}" />
      <text x="48" y="54" text-anchor="middle" 
        font-family="Arial" font-size="34" 
        font-weight="bold" fill="white">${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Main: Get real bank logo from card number
 */
export async function getBankLogoByCardNumber(cardNumber: string): Promise<string | null> {
  const bin = getBIN(cardNumber);
  if (!bin) return null;

  // Cached?
  if (LOGO_CACHE.has(bin)) return LOGO_CACHE.get(bin);

  // Step 1: Lookup BIN metadata via server-side API
  const bankInfo = await lookupBankByBIN(bin);
  if (!bankInfo) {
    LOGO_CACHE.set(bin, null);
    return null;
  }

  const { bankName, bankUrl } = bankInfo;

  // Step 2: If domain exists, try Clearbit
  if (bankUrl) {
    const domain = bankUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const realLogo = await tryClearbitLogo(domain);
    if (realLogo) {
      LOGO_CACHE.set(bin, realLogo);
      return realLogo;
    }
  }

  // Step 3: Fallback with initials
  if (bankName) {
    const fallback = makeFallbackLogo(bankName);
    LOGO_CACHE.set(bin, fallback);
    return fallback;
  }

  LOGO_CACHE.set(bin, null);
  return null;
}
