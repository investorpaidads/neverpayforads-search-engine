// app/api/logo/[domain]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge"; // works faster on Vercel

export async function GET(req: NextRequest, { params }: { params: { domain: string } }) {
  try {
    const { domain } = params;

    if (!domain || domain.trim() === "") {
      return NextResponse.json({ error: "Missing domain" }, { status: 400 });
    }

    // fetch Clearbit logo
    const logoUrl = `https://logo.clearbit.com/${encodeURIComponent(domain)}`;
    const res = await fetch(logoUrl);

    if (!res.ok) {
      // fallback: return placeholder logo
      return NextResponse.json({ error: "Logo not found" }, { status: 404 });
    }

    const arrayBuffer = await res.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=604800, immutable", // cache 7 days
      },
    });
  } catch (err) {
    console.error("Logo API error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
