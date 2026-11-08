-- ==============================================================================
-- BottleForMe Malta - Idempotent Database Schema
-- Safe to run multiple times without errors
-- ==============================================================================

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  revolut_tag TEXT,
  role TEXT DEFAULT 'both' CHECK (role IN ('resident', 'driver', 'both')),
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_bottles_recycled INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pickups
CREATE TABLE IF NOT EXISTS public.pickups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  collector_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_name TEXT NOT NULL,
  seller_phone TEXT,
  seller_revolut_tag TEXT,
  locality TEXT NOT NULL,
  address_notes TEXT,
  bag_count INTEGER NOT NULL CHECK (bag_count > 0),
  estimated_bottles INTEGER NOT NULL,
  total_bcrs_value NUMERIC(10,2) NOT NULL,
  split_percentage INTEGER DEFAULT 50 CHECK (split_percentage >= 0 AND split_percentage <= 100),
  seller_payout NUMERIC(10,2) NOT NULL,
  collector_profit NUMERIC(10,2) NOT NULL,
  payout_method TEXT DEFAULT 'revolut' CHECK (payout_method IN ('revolut', 'cash', 'charity')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'reserved', 'en_route', 'arrived', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickups ENABLE ROW LEVEL SECURITY;

-- Apply the migrations in supabase/migrations before serving traffic.
