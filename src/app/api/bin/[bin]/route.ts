// src/app/api/bin/[bin]/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache
const LOGO_CACHE = new Map<string, string | null>();

// Example function to get bank logo from BIN
async function getBankLogo(bin: string): Promise<string | null> {
  // Return from cache if available
  if (LOGO_CACHE.has(bin)) return LOGO_CACHE.get(bin) || null;

  try {
    // Replace this with your actual API call or logic
    const response = await fetch(`https://lookup.binlist.net/${bin}`);
    if (!response.ok) return null;

    const data = await response.json();
    const logo = data.bank?.logo || null;

    // Cache result
    LOGO_CACHE.set(bin, logo);
    return logo;
  } catch (err) {
    console.error('Error fetching logo:', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get the dynamic path param [bin]
    const urlParts = req.nextUrl.pathname.split('/');
    const bin = urlParts[urlParts.length - 1];

    if (!bin) {
      return NextResponse.json({ error: 'BIN not provided' }, { status: 400 });
    }

    const logo = await getBankLogo(bin);
    return NextResponse.json({ bin, logo });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
