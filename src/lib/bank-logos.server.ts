// bank-logos.server.ts

const LOGO_CACHE = new Map<string, string | null>();

export function extractBin(cardNumber: string): string | null {
  if (!cardNumber) return null;
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.slice(0, 6);
}

async function fetchFromNPA(bin: string) {
  try {
    const res = await fetch(`https://search.neverpayforads.com/api/bin/${bin}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (
      json?.issuer?.logo ||
      json?.bank?.logo ||
      json?.data?.bank_logo ||
      null
    );
  } catch {
    return null;
  }
}

async function fetchFromBinlist(bin: string) {
  try {
    const res = await fetch(`https://lookup.binlist.net/${bin}`, {
      cache: "no-store",
      headers: { "Accept-Version": "3" }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.bank?.logo || json?.bank?.url || null;
  } catch {
    return null;
  }
}

export async function getBankLogoByCardNumber(cardNumber: string) {
  const bin = extractBin(cardNumber);
  if (!bin) return null;

  if (LOGO_CACHE.has(bin)) return LOGO_CACHE.get(bin)!;

  let logo = await fetchFromNPA(bin);
  if (!logo) logo = await fetchFromBinlist(bin);

  LOGO_CACHE.set(bin, logo);
  return logo;
}
