// src/lib/getBankLogoByBIN.ts
import { getBankLogo } from "./bank-logos";

export async function getBankLogoByBIN(cardNumber: string): Promise<string | null> {
  if (!cardNumber) return null;

  const bin = cardNumber.substring(0, 6);

  try {
    const res = await fetch(`https://lookup.binlist.net/${bin}`, { cache: "no-store" });
    if (!res.ok) return null;

    const data: any = await res.json(); // use 'any' so no type declarations needed

    // Use logo from API if available
    if (data?.bank?.logo) return data.bank.logo;

    // Fallback: use bank name + local logo function
    if (data?.bank?.name) return getBankLogo(data.bank.name, null);

    return null;
  } catch (error) {
    console.error("BIN Lookup error:", error);
    return null;
  }
}
