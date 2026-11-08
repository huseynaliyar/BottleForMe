BEGIN;

GRANT SELECT (id, role), UPDATE (role) ON public.profiles TO service_role;

-- Keep the state precondition and assignment in one write. After a retry, return
-- the matching state only to the participant who could have performed the action.
CREATE OR REPLACE FUNCTION public.transition_pickup(pickup_id uuid, actor_id uuid, next_status text)
RETURNS SETOF public.pickups
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF next_status = 'reserved' THEN
    -- Serialize a claim with changes to this account's active role.
    PERFORM 1 FROM public.profiles WHERE id = actor_id AND role = 'taker' FOR SHARE;
    IF NOT FOUND THEN
      RETURN;
    END IF;
  END IF;

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
