import { NextResponse } from 'next/server';
import { INITIAL_OFFERS } from '@/lib/mock-data';
import { calculateBcrsSplit, PickupOffer } from '@/lib/types';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

// In-memory fallback store when Supabase keys are not set
let inMemoryStore: PickupOffer[] = [...INITIAL_OFFERS];

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const bagCount = Number(body.bag_count) || 1;
    const splitPercentage = body.split_percentage !== undefined ? Number(body.split_percentage) : 50;

    const calculated = calculateBcrsSplit(bagCount, splitPercentage);
    const estimatedBottles = body.estimated_bottles || calculated.estimatedBottles;
    const totalDepositValue = body.total_bcrs_value || calculated.totalBcrsValue;
    const sellerPayout = body.seller_payout !== undefined ? body.seller_payout : calculated.sellerPayout;
    const collectorProfit = body.collector_profit !== undefined ? body.collector_profit : calculated.collectorProfit;

    const newOffer: PickupOffer = {
      id: `malta-offer-${Date.now()}`,
      seller_name: body.seller_name || 'Resident',
      seller_phone: body.seller_phone || '',
      seller_revolut_tag: body.seller_revolut_tag || '',
      locality: body.locality || 'Sliema',
      address_notes: body.address_notes || '',
      bag_count: bagCount,
      containers: body.containers,
      estimated_bottles: estimatedBottles,
      total_bcrs_value: totalDepositValue,
      split_percentage: splitPercentage,
      seller_payout: sellerPayout,
      collector_profit: collectorProfit,
      payout_method: body.payout_method || 'revolut',
      status: 'open',
      lat: body.lat,
      lng: body.lng,
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
          return NextResponse.json({ ...data, containers: newOffer.containers, lat: newOffer.lat, lng: newOffer.lng }, { status: 201 });
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
