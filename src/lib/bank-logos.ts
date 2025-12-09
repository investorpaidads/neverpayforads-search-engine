// bank-logos.ts
// -------------------------------
// BIN-based Bank Logo Fetcher with caching, Clearbit support, and fallback SVG
// -------------------------------

const LOGO_CACHE = new Map<string, string | null>();

// Extract first 6 digits of card number
export function extractBin(cardNumber: string): string | null {
  if (!cardNumber) return null;
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.slice(0, 6);
}

// Fetch from neverpayforads (unreliable)
async function fetchFromNPA(bin: string): Promise<string | null> {
  try {
    const res = await fetch(`https://search.neverpayforads.com/api/bin/${bin}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.issuer?.logo || json?.bank?.logo || json?.data?.bank_logo || null;
  } catch (err) {
    console.error("NPA API error:", err);
    return null;
  }
}

// Fetch from binlist (very reliable)
async function fetchFromBinlist(bin: string): Promise<string | null> {
  try {
    const res = await fetch(`https://lookup.binlist.net/${bin}`, {
      method: "GET",
      cache: "no-store",
      headers: { "Accept-Version": "3" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.bank?.logo || json?.bank?.url || null;
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
  if (LOGO_CACHE.has(bin)) return LOGO_CACHE.get(bin) ?? null;

  // Try NeverPayForAds → fallback to binlist
  let logo = await fetchFromNPA(bin);
  if (!logo) logo = await fetchFromBinlist(bin);

  LOGO_CACHE.set(bin, logo ?? null);
  return logo;
}

/**
 * Generate fallback SVG logo with initials
 */
export function makeFallbackLogo(name: string): string {
  const initials = name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const colors = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#14b8a6"];
  const color = colors[name.charCodeAt(0) % colors.length];

  const svg = `<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
    <rect width="96" height="96" rx="12" fill="${color}" />
    <text x="48" y="54" text-anchor="middle" font-family="Arial" font-size="34" font-weight="bold" fill="white">${initials}</text>
  </svg>`;

  return typeof btoa === "function" ? `data:image/svg+xml;base64,${btoa(svg)}` : `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
