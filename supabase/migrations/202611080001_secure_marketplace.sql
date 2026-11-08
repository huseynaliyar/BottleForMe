-- Apply after schema.sql on a new database, or directly to the existing schema.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS locality text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_check CHECK (
  avatar_url IS NULL OR avatar_url = '/logo.jpg' OR (
    length(avatar_url) <= 699100 AND avatar_url ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$'
  )
) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE public.profiles SET role = CASE role WHEN 'resident' THEN 'giver' WHEN 'driver' THEN 'taker' ELSE role END
WHERE role IN ('resident', 'driver');
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'giver';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('giver', 'taker', 'both'));

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY profiles_read_self ON public.profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT (id, full_name, phone, revolut_tag, role, avatar_url, locality),
      UPDATE (id, full_name, phone, revolut_tag, role, avatar_url, locality)
ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Anyone can view open and active pickups" ON public.pickups;
DROP POLICY IF EXISTS "Authenticated users or anonymous guests can create pickups" ON public.pickups;
DROP POLICY IF EXISTS "Collectors and sellers can update their pickup status" ON public.pickups;
REVOKE ALL ON public.pickups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pickups TO service_role;

ALTER TABLE public.pickups ADD COLUMN IF NOT EXISTS containers jsonb;
-- Account identity exists even when an older signup did not create a profile.
ALTER TABLE public.pickups DROP CONSTRAINT IF EXISTS pickups_seller_id_fkey;
ALTER TABLE public.pickups DROP CONSTRAINT IF EXISTS pickups_collector_id_fkey;
ALTER TABLE public.pickups ADD CONSTRAINT pickups_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.pickups ADD CONSTRAINT pickups_collector_id_fkey
  FOREIGN KEY (collector_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pickups_radar_idx ON public.pickups (created_at DESC) WHERE status = 'open' AND seller_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pickups_seller_idx ON public.pickups (seller_id);
CREATE INDEX IF NOT EXISTS pickups_collector_idx ON public.pickups (collector_id);

-- Participant data is only served through the authorized API.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pickups'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.pickups;
  END IF;
END $$;

-- Keep the state precondition and assignment in one write. After a retry, return
-- the matching state only to the participant who could have performed the action.
CREATE OR REPLACE FUNCTION public.transition_pickup(pickup_id uuid, actor_id uuid, next_status text)
RETURNS SETOF public.pickups
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    UPDATE public.pickups AS p
    SET status = next_status,
        collector_id = CASE WHEN next_status = 'reserved' THEN actor_id ELSE p.collector_id END,
        updated_at = now()
    WHERE p.id = pickup_id AND (
      (next_status = 'reserved' AND p.status = 'open' AND p.collector_id IS NULL AND p.seller_id <> actor_id)
      OR (next_status = 'cancelled' AND p.status IN ('open', 'reserved', 'en_route', 'arrived')
          AND (p.seller_id = actor_id OR p.collector_id = actor_id))
      OR (p.collector_id = actor_id AND (
        (next_status = 'en_route' AND p.status = 'reserved')
        OR (next_status = 'arrived' AND p.status = 'en_route')
        OR (next_status = 'completed' AND p.status IN ('reserved', 'en_route', 'arrived'))
      ))
    )
    RETURNING p.*;

  IF NOT FOUND THEN
    RETURN QUERY
      SELECT p.* FROM public.pickups AS p
      WHERE p.id = pickup_id AND p.status = next_status AND (
        (next_status IN ('reserved', 'en_route', 'arrived', 'completed', 'cancelled') AND p.collector_id = actor_id)
        OR (next_status = 'cancelled' AND p.seller_id = actor_id)
      );
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.transition_pickup(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_pickup(uuid, uuid, text) TO service_role;

COMMIT;
