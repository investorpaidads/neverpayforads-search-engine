import { NextResponse } from "next/server";

export const config = {
  matcher: ["/logo/:path*"],
};

export async function middleware(req: Request) {
  const url = new URL(req.url);
  const domain = url.pathname.replace("/logo/", "");
  const target = `https://logo.clearbit.com/${domain}`;
  const resp = await fetch(target);

  return new NextResponse(resp.body, {
    headers: {
      "Content-Type": resp.headers.get("Content-Type") || "image/png",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
