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
  return "411922"//digits.substring(0, 8); // support up to BIN8
}// bank-logos.ts
// ------------------------------------
// Safe BIN-based Bank Logo Fetcher
// With caching, fallback API & error protection
// ------------------------------------

const LOGO_CACHE = new Map<string, string | null>();

// Extract first 6 digits of card number
export function extractBin(cardNumber: string): string | null {
  if (!cardNumber) return null;
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.slice(0, 6);
}

// Fetch from neverpayforads (unreliable)
async function fetchFromNPA(bin: string) {
  try {
    const res = await fetch(`https://search.neverpayforads.com/api/bin/${bin}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json = await res.json();

    const possibleLogo =
      json?.issuer?.logo ||
      json?.bank?.logo ||
      json?.data?.bank_logo;

    return possibleLogo || null;
  } catch (err) {
    console.error("NPA API error:", err);
    return null;
  }
}

// Fetch from binlist (very reliable)
async function fetchFromBinlist(bin: string) {
  try {
    const res = await fetch(`https://lookup.binlist.net/${bin}`, {
      method: "GET",
      cache: "no-store",
      headers: { "Accept-Version": "3" },
    });

    if (!res.ok) return null;

    const json = await res.json();

    const possibleLogo =
      json?.bank?.logo ||
      json?.bank?.url ||
      null;

    return possibleLogo;
  } catch (err) {
    console.error("Binlist API error:", err);
    return null;
  }
}

// MAIN FUNCTION
export async function getBankLogoByCardNumber(cardNumber: string): Promise<string | null> {
  const bin = extractBin(cardNumber);
  if (!bin) return null;

  // Check cache first
  if (LOGO_CACHE.has(bin)) {
    return LOGO_CACHE.get(bin) ?? null;
  }

  // Try NeverPayForAds (often down)
  let logo = await fetchFromNPA(bin);

  // If that fails → fallback to binlist (stable)
  if (!logo) {
    logo = await fetchFromBinlist(bin);
  }

  // Save into cache
  LOGO_CACHE.set(bin, logo ?? null);

  return logo;
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