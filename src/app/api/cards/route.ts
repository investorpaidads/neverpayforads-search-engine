import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
import { queryCards } from '@/lib/db';

type CardRow = {
  id: number;
  card_number: string;
  cardholder_name: string;
  bank_name: string;
  bank_logo: string | null;
  expiry_date: string | null;
  country_code: string | null;
  country_name: string | null;
  state_code: string | null;
  state_name: string | null;
  city: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  latitude: number | null;
  longitude: number | null;
};

function maskCardNumber(cardNumber: string): string {
  if (cardNumber.length < 8) return cardNumber;
  const first4 = cardNumber.slice(0, 4);
  const last4 = cardNumber.slice(-4);
  const masked = '●'.repeat(cardNumber.length - 8);
  return `${first4}${masked}${last4}`;
}

export async function GET(req: NextRequest) {
  try {
    console.log('[API] /cards route called');

    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || undefined;
    const state = searchParams.get('state') || undefined;
    const cardNumber = searchParams.get('cardNumber') || undefined;
    const bankName = searchParams.get('bankName') || undefined;
    const cardholder = searchParams.get('cardholder') || undefined;
    const limit = Number(searchParams.get('limit') || '25');
    const offset = Number(searchParams.get('offset') || '0');

    console.log('[API] Calling queryCards with params', { country, state, cardNumber, bankName, cardholder, limit, offset });
    const data = await queryCards({ country, state, cardNumber, bankName, cardholder, limit, offset });
    console.log('[API] queryCards returned', data.total, 'total records');

    const maskedData = {
      ...data,
      rows: data.rows.map((row: CardRow) => ({
        ...row,
        card_number: maskCardNumber(row.card_number),
      })),
    };

    console.log('[API] Returning', maskedData.rows.length, 'rows');
    return new Response(JSON.stringify(maskedData), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[API] /cards route error:', error);

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unknown error';

    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
