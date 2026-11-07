-- ==============================================================================
-- BottleForMe Malta - Database Schema & Supabase Setup
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table
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

-- 3. Pickups Table
CREATE TABLE IF NOT EXISTS public.pickups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickups ENABLE ROW LEVEL SECURITY;

-- 5. Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 6. Pickups Policies
CREATE POLICY "Anyone can view open and active pickups" 
  ON public.pickups FOR SELECT USING (true);

CREATE POLICY "Authenticated users or anonymous guests can create pickups" 
  ON public.pickups FOR INSERT WITH CHECK (true);

CREATE POLICY "Collectors and sellers can update their pickup status" 
  ON public.pickups FOR UPDATE USING (true);

-- 7. Realtime Replication for Live Radar Sweep
ALTER PUBLICATION supabase_realtime ADD TABLE public.pickups;

-- 8. Seed Initial Malta Data
INSERT INTO public.pickups (seller_name, seller_phone, seller_revolut_tag, locality, address_notes, bag_count, estimated_bottles, total_bcrs_value, split_percentage, seller_payout, collector_profit, payout_method, status)
VALUES 
  ('Maria Borg', '+356 9912 3456', '@maria_mlt', 'Sliema', 'Tower Road, near Preluna. Lift available.', 2, 75, 7.50, 50, 3.75, 3.75, 'revolut', 'open'),
  ('David Galea', '+356 7944 5566', '@david_g', 'Gzira', 'Manoel Island Marina area. Ground floor.', 1, 50, 5.00, 0, 0.00, 5.00, 'cash', 'open'),
  ('Elena Vella', '+356 9988 7711', '@elena_v', 'Birkirkara', 'Triq il-Wied, near church. Intercom 3.', 3, 110, 11.00, 50, 5.50, 5.50, 'revolut', 'open')
ON CONFLICT DO NOTHING;
