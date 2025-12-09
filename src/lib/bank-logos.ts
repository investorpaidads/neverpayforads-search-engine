// bank-logos.ts
// -------------------------------
// BIN-based Bank Logo Fetcher with caching, Clearbit support, and fallback SVG
// -------------------------------

const LOGO_CACHE = new Map<string, string>();

/**
 * Extract BIN (first 6–8 digits) from card number
 */
function getBIN(cardNumber: string): string | null {
  if (!cardNumber) return null;
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.substring(0, 8); // support up to BIN8
}

/**
 * Lookup BIN metadata via our Next.js API
 */
async function lookupBankByBIN(bin: string) {
  try {
    const res = await fetch(`/api/bin/${bin}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      bankName: data.bank?.name || null,
      bankUrl: data.bank?.url || null,
      country: data.country || null,
    };
  } catch (err) {
    console.error("lookupBankByBIN error:", err);
    return null;
  }
}

/**
 * Try to fetch real bank logo from Clearbit
 */
async function tryClearbitLogo(domain: string): Promise<string | null> {
  const logoUrl = `https://logo.clearbit.com/${domain}`;
  try {
    // HEAD can fail; fetch full GET and assume URL works
    const res = await fetch(logoUrl);
    if (res.ok) return logoUrl;
  } catch (err) {
    console.warn("Clearbit fetch failed:", err);
  }
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

  return `data:image/svg+xml;base64,${typeof btoa === "function" ? btoa(svg) : Buffer.from(svg).toString("base64")}`;
}

/**
 * Main: Get bank logo by card number
 */
export async function getBankLogoByCardNumber(cardNumber: string): Promise<string> {
  const bin = getBIN(cardNumber);
  if (!bin) return makeFallbackLogo("Unknown");

  // Cached?
  if (LOGO_CACHE.has(bin)) return LOGO_CACHE.get(bin)!;

  // Step 1: Lookup bank info
  const bankInfo = await lookupBankByBIN(bin);
  let logo: string | null = null;

  if (bankInfo) {
    const { bankName, bankUrl } = bankInfo;

    // Step 2: Try Clearbit
    if (bankUrl) {
      const domain = bankUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      logo = await tryClearbitLogo(domain);
    }

    // Step 3: Fallback SVG if Clearbit fails
    if (!logo && bankName) {
      logo = makeFallbackLogo(bankName);
    }
  }

  // Step 4: Final fallback
  if (!logo) {
    logo = makeFallbackLogo("Unknown");
  }

  // Cache and return
  LOGO_CACHE.set(bin, logo);
  return logo;
}
