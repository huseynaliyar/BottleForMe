// Existing email links may still point here. A relative Location keeps the
// browser's origin and lets the Supabase client process the original fragment.
export function GET() {
  return new Response(null, {
    status: 307,
    headers: { Location: '/', 'Cache-Control': 'no-store' },
  });
}
