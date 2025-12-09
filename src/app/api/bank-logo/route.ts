import { NextRequest } from "next/server";
import { getBankLogoByCardNumber } from "@/lib/bank-logos.server";

export async function GET(req: NextRequest) {
  const card = req.nextUrl.searchParams.get("card");
  if (!card) return Response.json({ logo: null });

  const logo = await getBankLogoByCardNumber(card);

  return Response.json({ logo });
}
