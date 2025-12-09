import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const urlParts = req.nextUrl.pathname.split("/");
    const bin = urlParts[urlParts.length - 1];

    if (!bin) {
      return NextResponse.json({ error: "BIN not provided" }, { status: 400 });
    }

    const response = await fetch(`https://lookup.binlist.net/${bin}`);
    if (!response.ok) return NextResponse.json({ error: "BIN lookup failed" }, { status: 500 });

    const data = await response.json();

    // Return in the format bank-logos.ts expects
    const result = {
      bank: {
        name: data.bank?.name || null,
        url: data.bank?.url || null,
      },
      country: data.country?.alpha2 || null,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
