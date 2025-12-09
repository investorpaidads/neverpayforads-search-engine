// src/lib/bank-logos.ts

const LOGO_CACHE = new Map<string, string>();

export async function getBankLogo(bankName: string, existingLogo: string | null | undefined): Promise<string | null> {
  if (existingLogo) return existingLogo;

  // Use proxy
  return `/api/logo-proxy/${encodeURIComponent(bankName)}`;
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
