import { NextResponse } from 'next/server';
import { INITIAL_OFFERS } from '@/lib/mock-data';
import { calculateBcrsSplit, PickupOffer } from '@/lib/types';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

// In-memory fallback store when Supabase keys are not set
let inMemoryStore: PickupOffer[] = [...INITIAL_OFFERS];

/**
 * @swagger
 * /api/pickups:
 *   get:
 *     summary: List active bottle pickup offers across Malta
 *     description: Retrieve all offers available on the Malta collector radar, with optional locality and status filtering. Powered by Supabase when configured.
 *     tags:
 *       - Pickups & Radar
 *     parameters:
 *       - in: query
 *         name: locality
 *         schema:
 *           type: string
 *         description: Filter by Malta town (e.g. Sliema, Birkirkara, Gzira)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           default: open
 *         description: Offer status filter
 *     responses:
 *       200:
 *         description: Successfully returned list of pickup offers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PickupOffer'
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locality = searchParams.get('locality');
  const status = searchParams.get('status');

  // 1. Supabase integration if credentials present
  if (isSupabaseConfigured() && supabaseAdmin) {
    try {
      let query = supabaseAdmin
        .from('pickups')
        .select('*')
        .order('created_at', { ascending: false });

      if (locality && locality !== 'all') {
        query = query.ilike('locality', locality);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (!error && data) {
        return NextResponse.json({
          count: data.length,
          offers: data,
          source: 'supabase',
        });
      }
    } catch (err) {
      console.warn('Supabase query failed, falling back to local memory store', err);
    }
  }

  // 2. Fallback to in-memory store
  let results = [...inMemoryStore];

  if (locality && locality !== 'all') {
    results = results.filter(
      (o) => o.locality.toLowerCase() === locality.toLowerCase()
    );
  }

  if (status) {
    results = results.filter((o) => o.status === status);
  }

  return NextResponse.json({
    count: results.length,
    offers: results,
    source: 'in-memory',
  });
}

/**
 * @swagger
 * /api/pickups:
 *   post:
 *     summary: Resident creates a new bottle pickup offer
 *     description: Resident lists their empty bags on the Malta radar with their preferred deposit split ratio (0% free to 70%).
 *     tags:
 *       - Pickups & Radar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOfferRequest'
 *     responses:
 *       201:
 *         description: Offer successfully posted to Malta radar
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PickupOffer'
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const bagCount = Number(body.bag_count) || 1;
    const splitPercentage = body.split_percentage !== undefined ? Number(body.split_percentage) : 50;

    const { estimatedBottles, totalBcrsValue, sellerPayout, collectorProfit } =
      calculateBcrsSplit(bagCount, splitPercentage);

    const newOffer: PickupOffer = {
      id: `malta-offer-${Date.now()}`,
      seller_name: body.seller_name || 'Resident',
      seller_phone: body.seller_phone || '',
      seller_revolut_tag: body.seller_revolut_tag || '',
      locality: body.locality || 'Birkirkara',
      address_notes: body.address_notes || '',
      bag_count: bagCount,
      estimated_bottles: estimatedBottles,
      total_bcrs_value: totalBcrsValue,
      split_percentage: splitPercentage,
      seller_payout: sellerPayout,
      collector_profit: collectorProfit,
      payout_method: body.payout_method || 'revolut',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to Supabase if configured
    if (isSupabaseConfigured() && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('pickups')
          .insert([
            {
              seller_name: newOffer.seller_name,
              seller_phone: newOffer.seller_phone,
              seller_revolut_tag: newOffer.seller_revolut_tag,
              locality: newOffer.locality,
              address_notes: newOffer.address_notes,
              bag_count: newOffer.bag_count,
              estimated_bottles: newOffer.estimated_bottles,
              total_bcrs_value: newOffer.total_bcrs_value,
              split_percentage: newOffer.split_percentage,
              seller_payout: newOffer.seller_payout,
              collector_profit: newOffer.collector_profit,
              payout_method: newOffer.payout_method,
              status: newOffer.status,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          return NextResponse.json(data, { status: 201 });
        }
      } catch (err) {
        console.warn('Supabase insert failed, using memory store fallback', err);
      }
    }

    inMemoryStore.unshift(newOffer);
    return NextResponse.json(newOffer, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create pickup offer' },
      { status: 400 }
    );
  }
}
