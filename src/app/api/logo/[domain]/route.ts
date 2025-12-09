import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // required so we can fetch binary image data

export async function GET(
  req: NextRequest,
  { params }: { params: { domain: string } }
) {
  const { domain } = params;

  if (!domain) {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  }

  try {
    const clearbitUrl = `https://logo.clearbit.com/${domain}`;
    const resp = await fetch(clearbitUrl);

    if (!resp.ok) {
      return NextResponse.json({ error: "Logo not found" }, { status: 404 });
    }

    const buffer = await resp.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": resp.headers.get("Content-Type") || "image/png",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("Logo proxy error:", e);
    return NextResponse.json({ error: "Failed to fetch logo" }, { status: 500 });
  }
}
