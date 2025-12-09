// src/lib/bank-logos.ts

const LOGO_CACHE = new Map<string, string>();

export async function getBankLogo(bankName: string, bin: string | null) {
  if (!bankName) return null;

  // --- optional: handle BIN-based domains if you already have that logic ---
  const domain = await resolveBankDomain(bankName, bin);
  if (!domain) return null;

  // 🔹 Use proxy in production (Vercel)
  const base =
    typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? "/api/logo"
      : "https://logo.clearbit.com";

  const logoUrl = `${base}/${domain}`;
  LOGO_CACHE.set(bankName, logoUrl);
  return logoUrl;
}

// Example function to convert a bank name → domain
async function resolveBankDomain(bankName: string, bin?: string | null) {
  const normalized = bankName.toLowerCase();
  if (normalized.includes("cimb")) return "cimb.com";
  if (normalized.includes("maybank")) return "maybank.com";
  if (normalized.includes("aeon")) return "aeoncreditservicemberhad.com";
  if (normalized.includes("hsbc")) return "hsbc.com";
  if (normalized.includes("rhb")) return "rhbgroup.com";
  if (normalized.includes("ambank")) return "ambankgroup.com";
  // fallback
  return null;
}
