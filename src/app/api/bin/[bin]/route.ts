import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { bin: string } }) {
  const { bin } = params;

  if (!bin) return NextResponse.json({ error: "BIN required" }, { status: 400 });

  try {
    const response = await fetch(`https://lookup.binlist.net/${bin}`, {
      headers: { "Accept-Version": "3" },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch BIN info" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
