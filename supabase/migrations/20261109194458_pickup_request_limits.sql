begin;

create index pickups_active_by_taker on public.pickups (collector_id, confirmed_at)
  where collector_id is not null and status in ('reserved', 'en_route', 'arrived');
drop index public.pickups_one_active_per_taker;

create index pickup_requests_pending_by_taker on public.pickup_requests (collector_id)
  where status = 'pending';

create function public.check_pickup_request_limit(taker uuid, listing uuid, enforce_overdue boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  overdue_id uuid;
  active_count integer;
begin
  -- Serialize changes to the same Taker's quota across different listings.
  perform pg_advisory_xact_lock(hashtextextended(taker::text, 36187));
  if enforce_overdue then
    select p.id into overdue_id from public.pickups p
      where p.collector_id = taker and p.status in ('reserved', 'en_route', 'arrived')
        and p.confirmed_at <= clock_timestamp() - interval '1 hour'
      order by p.confirmed_at, p.id limit 1;
    if overdue_id is not null then
      raise exception 'Resolve your overdue pickup before requesting another.' using errcode = 'BF004', detail = overdue_id::text;
    end if;
  end if;

  select count(*) into active_count from (
    select p.id from public.pickups p
      where p.collector_id = taker and p.status in ('reserved', 'en_route', 'arrived') and p.id <> listing
    union
    select r.pickup_id from public.pickup_requests r
      where r.collector_id = taker and r.status = 'pending' and r.pickup_id <> listing
  ) active;
  if active_count >= 3 then
    raise exception 'You already have three active pickup requests.' using errcode = 'BF005';
  end if;
end;
$$;
revoke all on function public.check_pickup_request_limit(uuid,uuid,boolean) from public, anon, authenticated;

create or replace function public.guard_marketplace_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select maintenance from public.marketplace_settings where singleton) then
    raise exception 'Marketplace maintenance' using errcode = 'BF001';
  end if;

  if tg_table_name = 'pickup_requests' then
    if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending'
      or old.collector_id is distinct from new.collector_id or old.pickup_id is distinct from new.pickup_id) then
      perform public.check_pickup_request_limit(new.collector_id, new.pickup_id, true);
    end if;
  else
    if tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from new.status and not exists (
      select 1 from public.pickup_handover_codes where pickup_id = new.id and verified_at is not null
    ) then
      raise exception 'A handover code is required' using errcode = 'BF002';
    end if;
    if new.collector_id is not null and new.status in ('reserved', 'en_route', 'arrived')
      and (tg_op = 'INSERT' or old.status not in ('reserved', 'en_route', 'arrived')
        or old.collector_id is distinct from new.collector_id) then
      perform public.check_pickup_request_limit(new.collector_id, new.id, not exists (
        select 1 from public.pickup_requests r where r.pickup_id = new.id
          and r.collector_id = new.collector_id and r.status = 'accepted'
      ));
    end if;
  end if;
  return new;
end;
$$;

create unique index account_notifications_one_overdue_per_pickup
  on public.account_notifications (user_id, pickup_id)
  where pickup_id is not null and title = 'Pickup overdue';

create function public.notify_overdue_pickups()
returns void language sql security definer set search_path = ''
as $$
  with due as (
    select p.id, p.collector_id
    from public.pickups p
    where p.collector_id is not null and p.status in ('reserved', 'en_route', 'arrived')
      and p.confirmed_at <= now() - interval '1 hour'
      and not exists (
        select 1 from public.account_notifications n where n.user_id = p.collector_id
          and n.pickup_id = p.id and n.title = 'Pickup overdue'
      )
    order by p.confirmed_at, p.id
    limit 100
    for update of p skip locked
  )
  insert into public.account_notifications (batch_id,user_id,title,message,pickup_id)
    select gen_random_uuid(), collector_id, 'Pickup overdue',
      'Open this pickup to complete or cancel it before requesting another.', id from due
  on conflict do nothing;
$$;
revoke all on function public.notify_overdue_pickups() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('bottleforme-overdue-pickups', '* * * * *', 'select public.notify_overdue_pickups()');
  end if;
end;
$$;

commit;
