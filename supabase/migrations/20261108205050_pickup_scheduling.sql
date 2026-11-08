begin;

alter table public.pickups
  add column availability jsonb,
  add column availability_version integer not null default 0,
  add column confirmed_at timestamptz;

create table public.pickup_requests (
  id uuid primary key,
  pickup_id uuid not null references public.pickups(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  collector_id uuid not null references auth.users(id) on delete cascade,
  proposed_by uuid not null,
  proposed_at timestamptz not null,
  kind text not null check (kind in ('available', 'alternative')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  version integer not null default 0,
  last_action text not null default 'request',
  last_actor uuid not null,
  updated_at timestamptz not null default now(),
  check (seller_id <> collector_id and proposed_by in (seller_id, collector_id))
);
create unique index pickup_requests_one_pending_per_collector
  on public.pickup_requests (pickup_id, collector_id) where status = 'pending';
create unique index pickup_requests_one_confirmation
  on public.pickup_requests (pickup_id) where status = 'accepted';
create index pickup_requests_seller on public.pickup_requests (seller_id, updated_at desc, id);
create index pickup_requests_collector on public.pickup_requests (collector_id, updated_at desc, id);
create index pickup_requests_listing on public.pickup_requests (pickup_id, updated_at desc, id);

alter table public.pickup_requests enable row level security;
revoke all on public.pickup_requests from public, anon, authenticated;
grant select on public.pickup_requests to authenticated;
grant select, insert, update on public.pickup_requests to service_role;
create policy pickup_requests_participants on public.pickup_requests for select to authenticated
  using ((select auth.uid()) in (seller_id, collector_id));

create function public.guard_pickup_schedule()
returns trigger language plpgsql set search_path = ''
as $$
declare
  slot jsonb;
  starts_at timestamptz;
  ends_at timestamptz;
  previous_end timestamptz;
begin
  if new.availability is not null and (tg_op = 'INSERT' or new.availability is distinct from old.availability) then
    if new.status <> 'open' or jsonb_typeof(new.availability) <> 'array' then
      raise exception 'Invalid pickup availability.' using errcode = '23514';
    end if;
    if jsonb_array_length(new.availability) not between 1 and 8 then
      raise exception 'Add between one and eight pickup windows.' using errcode = '23514';
    end if;
    for slot in select value from jsonb_array_elements(new.availability) loop
      if coalesce(slot->>'start', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00[.]000Z$'
         or coalesce(slot->>'end', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00[.]000Z$' then
        raise exception 'Invalid pickup time.' using errcode = '23514';
      end if;
      starts_at := (slot->>'start')::timestamptz;
      ends_at := (slot->>'end')::timestamptz;
      if starts_at <= statement_timestamp() or starts_at >= ends_at or starts_at < previous_end
        or (starts_at at time zone 'Europe/Malta')::date <> (ends_at at time zone 'Europe/Malta')::date then
        raise exception 'Use future, non-overlapping windows within the same Malta date.' using errcode = '23514';
      end if;
      previous_end := ends_at;
    end loop;
  end if;
  if tg_op = 'UPDATE' and old.availability is not null and new.availability is null then
    raise exception 'Published pickup availability cannot be cleared.' using errcode = '23514';
  end if;
  if new.status = 'reserved' and (tg_op = 'INSERT' or old.status is distinct from new.status)
    and new.availability is not null and new.confirmed_at is null then
    raise exception 'The owner must accept a pickup request before reservation.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_pickup_schedule before insert or update of availability, status, confirmed_at on public.pickups
  for each row execute function public.guard_pickup_schedule();

create function public.notify_pickup_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  target_id uuid;
  notice_title text;
begin
  if tg_op = 'UPDATE' and old.version = new.version then return new; end if;
  target_id := case when new.last_actor = new.seller_id then new.collector_id else new.seller_id end;
  notice_title := case new.last_action
    when 'request' then case when new.kind = 'alternative' then 'Alternative pickup time proposed' else 'Pickup time requested' end
    when 'counter' then 'Another pickup time proposed'
    when 'accept' then 'Pickup time confirmed'
    when 'reject' then 'Pickup request declined'
    when 'conflict' then 'Pickup is no longer available'
    else 'Pickup arrangement cancelled'
  end;
  insert into public.account_notifications(batch_id,user_id,title,message)
    values (gen_random_uuid(),target_id,notice_title,'Open Handover in BottleForMe to see the pickup arrangement.');
  return new;
end;
$$;
revoke all on function public.notify_pickup_request() from public, anon, authenticated;
create trigger notify_pickup_request after insert or update on public.pickup_requests
  for each row execute function public.notify_pickup_request();

create function public.close_pickup_requests()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    update public.pickup_requests as r
      set status = 'cancelled', version = r.version + 1, last_action = 'listing_cancelled',
          last_actor = coalesce(nullif(current_setting('bottleforme.schedule_actor', true), '')::uuid, r.seller_id),
          updated_at = now()
      where r.pickup_id = new.id and r.status in ('pending', 'accepted');
  elsif new.status = 'reserved' and old.status = 'open' then
    update public.pickup_requests as r
      set status = 'rejected', version = r.version + 1, last_action = 'conflict', last_actor = r.seller_id, updated_at = now()
      where r.pickup_id = new.id and r.status = 'pending';
  end if;
  return new;
end;
$$;
create trigger close_pickup_requests after update of status on public.pickups
  for each row execute function public.close_pickup_requests();

create function public.manage_pickup_schedule(
  listing_id uuid, actor_id uuid, operation text, request_key uuid default null,
  requested_at timestamptz default null, request_kind text default null,
  expected_version integer default null, windows jsonb default null
) returns boolean
language plpgsql set search_path = ''
as $$
declare
  listing public.pickups%rowtype;
  arrangement public.pickup_requests%rowtype;
begin
  if operation = 'request' then
    perform 1 from public.profiles where id = actor_id and role = 'taker' for share;
    if not found then return false; end if;
  end if;

  select * into listing from public.pickups where id = listing_id for update;
  if not found or listing.seller_id is null then return false; end if;

  if operation = 'availability' then
    if listing.seller_id <> actor_id or listing.status <> 'open' or windows is null then return false; end if;
    if windows is not distinct from listing.availability then return true; end if;
    if expected_version is distinct from listing.availability_version then return false; end if;
    update public.pickups set availability = windows, availability_version = availability_version + 1,
      updated_at = now() where id = listing_id;
    return true;
  end if;

  select * into arrangement from public.pickup_requests where id = request_key and pickup_id = listing_id;
  if operation = 'request' then
    if found then
      return arrangement.collector_id = actor_id and arrangement.version = 0
        and arrangement.proposed_at = requested_at and arrangement.kind = request_kind;
    end if;
    if listing.status <> 'open' or listing.collector_id is not null or listing.seller_id = actor_id
      or request_kind is null or request_kind not in ('available','alternative')
      or requested_at is null or requested_at <= statement_timestamp() then return false; end if;
    if request_kind = 'available' and not exists (
      select 1 from jsonb_array_elements(listing.availability) as w
      where requested_at >= (w->>'start')::timestamptz and requested_at < (w->>'end')::timestamptz
    ) then return false; end if;
    insert into public.pickup_requests(id,pickup_id,seller_id,collector_id,proposed_by,proposed_at,kind,last_actor)
      values (request_key,listing_id,listing.seller_id,actor_id,actor_id,requested_at,request_kind,actor_id)
      on conflict do nothing;
    return found;
  end if;

  if not found or actor_id not in (arrangement.seller_id, arrangement.collector_id) or expected_version is null then return false; end if;
  if arrangement.version = expected_version + 1 and arrangement.last_actor = actor_id
    and (arrangement.last_action = operation or (operation = 'cancel' and arrangement.last_action = 'listing_cancelled'))
    and (operation <> 'counter' or arrangement.proposed_at = requested_at) then return true; end if;
  if arrangement.version <> expected_version then return false; end if;

  if operation = 'cancel' and arrangement.status = 'accepted' and listing.status in ('reserved','en_route','arrived') then
    perform set_config('bottleforme.schedule_actor', actor_id::text, true);
    update public.pickups set status = 'cancelled', updated_at = now() where id = listing_id;
    return true;
  end if;
  if arrangement.status <> 'pending' or listing.status <> 'open' then return false; end if;
  if operation <> 'cancel' and actor_id = arrangement.proposed_by then return false; end if;

  case operation
    when 'accept' then
      if arrangement.proposed_at <= statement_timestamp() then return false; end if;
      update public.pickup_requests set status = 'accepted', version = version + 1, last_action = operation,
        last_actor = actor_id, updated_at = now() where id = request_key;
      update public.pickups set status = 'reserved', collector_id = arrangement.collector_id,
        confirmed_at = arrangement.proposed_at, updated_at = now() where id = listing_id;
    when 'counter' then
      if requested_at is null or requested_at <= statement_timestamp() then return false; end if;
      update public.pickup_requests set proposed_at = requested_at, proposed_by = actor_id, kind = 'alternative',
        version = version + 1, last_action = operation, last_actor = actor_id, updated_at = now() where id = request_key;
    when 'reject', 'cancel' then
      update public.pickup_requests set status = case when operation = 'reject' then 'rejected' else 'cancelled' end,
        version = version + 1, last_action = operation, last_actor = actor_id, updated_at = now() where id = request_key;
    else return false;
  end case;
  return true;
end;
$$;
revoke all on function public.manage_pickup_schedule(uuid,uuid,text,uuid,timestamptz,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.manage_pickup_schedule(uuid,uuid,text,uuid,timestamptz,text,integer,jsonb) to service_role;

-- Preserve legacy instant reservations only for listings without availability.
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

  IF next_status = 'cancelled' THEN
    PERFORM set_config('bottleforme.schedule_actor', actor_id::text, true);
  END IF;

  RETURN QUERY
    UPDATE public.pickups AS p
    SET status = next_status,
        collector_id = CASE WHEN next_status = 'reserved' THEN actor_id ELSE p.collector_id END,
        updated_at = now()
    WHERE p.id = pickup_id AND (
      (next_status = 'reserved' AND p.status = 'open' AND p.availability IS NULL AND p.collector_id IS NULL AND p.seller_id <> actor_id)
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

commit;
