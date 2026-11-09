begin;

create table public.marketplace_settings (
  singleton boolean primary key default true check (singleton),
  maintenance boolean not null default false
);
insert into public.marketplace_settings default values;
alter table public.marketplace_settings enable row level security;
revoke all on public.marketplace_settings from public, anon, authenticated;
grant select, update on public.marketplace_settings to service_role;

create table public.auth_action_limits (
  action text not null check (action in ('otp', 'reset')),
  email_hash text not null,
  attempts integer not null,
  expires_at timestamptz not null,
  primary key (action,email_hash)
);
alter table public.auth_action_limits enable row level security;
revoke all on public.auth_action_limits from public, anon, authenticated;

create function public.claim_auth_attempt(action_name text, email_key text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  result public.auth_action_limits%rowtype;
  current_time_utc timestamptz := clock_timestamp();
  max_attempts integer := case when action_name = 'otp' then 5 else 1 end;
  duration interval := case when action_name = 'otp' then interval '30 minutes' else interval '2 minutes' end;
begin
  insert into public.auth_action_limits as limits (action,email_hash,attempts,expires_at)
    values (action_name,email_key,1,current_time_utc + duration)
  on conflict (action,email_hash) do update
    set attempts = case when limits.expires_at <= current_time_utc then 1 else limits.attempts + 1 end,
        expires_at = case when limits.expires_at <= current_time_utc or limits.attempts + 1 = max_attempts
          then current_time_utc + duration else limits.expires_at end
    where limits.expires_at <= current_time_utc or limits.attempts < max_attempts
  returning * into result;

  if not found then
    select * into result from public.auth_action_limits where action = action_name and email_hash = email_key;
    return greatest(1,ceil(extract(epoch from result.expires_at - current_time_utc))::integer);
  end if;
  return 0;
end;
$$;
revoke all on function public.claim_auth_attempt(text,text) from public, anon, authenticated;
grant execute on function public.claim_auth_attempt(text,text) to service_role;
grant delete on public.auth_action_limits to service_role;
grant select (action,email_hash) on public.auth_action_limits to service_role;

-- Read-only preview: visiting a recovery link does not consume it.
create function public.is_recovery_link_valid(supplied_hash text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where recovery_token in (supplied_hash, 'pkce_' || supplied_hash)
      and recovery_sent_at > now() - interval '5 minutes'
  );
$$;
revoke all on function public.is_recovery_link_valid(text) from public, anon, authenticated;
grant execute on function public.is_recovery_link_valid(text) to service_role;

alter table public.account_notifications add column pickup_id uuid references public.pickups(id) on delete set null;
grant select (pickup_id) on public.account_notifications to authenticated;
grant select (batch_id,user_id,title,message,pickup_id) on public.account_notifications to service_role;

create or replace function public.notify_pickup_request()
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
  insert into public.account_notifications(batch_id,user_id,title,message,pickup_id)
    values (gen_random_uuid(),target_id,notice_title,'Open Handover in BottleForMe to see the pickup arrangement.',new.pickup_id);
  return new;
end;
$$;

drop function public.claim_web_push(uuid);
create function public.claim_web_push(target_batch uuid default null)
returns table (
  batch_id uuid, subscription_id uuid, endpoint text, p256dh text, auth text,
  attempts integer, lease_id uuid, title text, message text, pickup_id uuid
)
language sql set search_path = ''
as $$
  with due as (
    select j.batch_id, j.subscription_id
    from public.web_push_jobs as j
    where j.status = 'queued' and j.next_attempt_at <= now()
      and (target_batch is null or j.batch_id = target_batch)
    order by j.next_attempt_at
    limit 16
    for update skip locked
  ), claimed as (
    update public.web_push_jobs as j
    set next_attempt_at = now() + interval '5 minutes', attempts = j.attempts + 1,
        lease_id = gen_random_uuid()
    from due
    where (j.batch_id, j.subscription_id) = (due.batch_id, due.subscription_id)
    returning j.*
  )
  select c.batch_id, c.subscription_id, s.endpoint, s.p256dh, s.auth, c.attempts, c.lease_id, n.title, n.message, n.pickup_id
  from claimed as c
  join public.web_push_subscriptions as s on s.id = c.subscription_id and s.user_id = c.user_id
  join public.account_notifications as n on (n.user_id, n.batch_id) = (c.user_id, c.batch_id);
$$;
revoke all on function public.claim_web_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_web_push(uuid) to service_role;

drop function public.claim_mobile_push(uuid);
create function public.claim_mobile_push(target_batch uuid default null)
returns table (
  batch_id uuid, installation_id uuid, user_id uuid, token text, attempts integer, ticket_id text, lease_id uuid, title text, message text, pickup_id uuid
)
language sql security invoker set search_path = ''
as $$
  with due as (
    select j.batch_id, j.installation_id
    from public.mobile_push_jobs as j
    join public.mobile_push_devices as d using (installation_id)
    where j.status = 'queued' and j.next_attempt_at <= now()
      and d.user_id = j.user_id
      and (target_batch is null or j.batch_id = target_batch)
    order by j.next_attempt_at
    limit 100
    for update of j skip locked
  ), claimed as (
    update public.mobile_push_jobs as j
    set next_attempt_at = now() + interval '5 minutes',
        attempts = j.attempts + 1,
        lease_id = gen_random_uuid()
    from due
    where j.batch_id = due.batch_id and j.installation_id = due.installation_id
    returning j.*
  )
  select c.batch_id, c.installation_id, c.user_id, d.token, c.attempts, c.ticket_id, c.lease_id, n.title, n.message, n.pickup_id
  from claimed as c join public.mobile_push_devices as d using (installation_id)
  join public.account_notifications as n on (n.user_id,n.batch_id) = (c.user_id,c.batch_id)
  where c.user_id = d.user_id;
$$;
revoke all on function public.claim_mobile_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_mobile_push(uuid) to service_role;

create unique index pickups_one_active_per_taker on public.pickups (collector_id)
  where collector_id is not null and status in ('reserved','en_route','arrived');

create table public.pickup_handover_codes (
  pickup_id uuid primary key references public.pickups(id) on delete cascade,
  code text not null,
  failed_attempts integer not null default 0,
  retry_at timestamptz,
  verified_at timestamptz
);
alter table public.pickup_handover_codes enable row level security;
revoke all on public.pickup_handover_codes from public, anon, authenticated;

create function public.guard_marketplace_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select maintenance from public.marketplace_settings where singleton) then
    raise exception 'Marketplace maintenance' using errcode = 'BF001';
  end if;
  if tg_table_name = 'pickup_requests' and tg_op = 'INSERT' then
    if exists (select 1 from public.pickups where collector_id = new.collector_id and status in ('reserved','en_route','arrived')) then
      raise exception 'Finish the current pickup first' using errcode = 'BF003';
    end if;
  end if;
  if tg_table_name = 'pickups' and tg_op = 'UPDATE' then
    if new.status = 'completed' and old.status is distinct from new.status and not exists (
      select 1 from public.pickup_handover_codes where pickup_id = new.id and verified_at is not null
    ) then
      raise exception 'A handover code is required' using errcode = 'BF002';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_marketplace_write() from public, anon, authenticated;
create trigger guard_marketplace_pickups before insert or update on public.pickups
  for each row execute function public.guard_marketplace_write();
create trigger guard_marketplace_requests before insert or update on public.pickup_requests
  for each row execute function public.guard_marketplace_write();

create function public.get_handover_code(listing_id uuid, actor_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  pickup public.pickups%rowtype;
  secret_code text;
begin
  select * into pickup from public.pickups where id = listing_id for update;
  if not found or pickup.seller_id is distinct from actor_id or pickup.collector_id is null
    or pickup.status not in ('reserved','en_route','arrived') then return null; end if;

  insert into public.pickup_handover_codes (pickup_id,code)
    values (listing_id, lpad(((('x' || left(gen_random_uuid()::text,8))::bit(32)::bigint) % 1000000)::text,6,'0'))
  on conflict (pickup_id) do nothing;
  select code into secret_code from public.pickup_handover_codes where pickup_id = listing_id;
  return secret_code;
end;
$$;
revoke all on function public.get_handover_code(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_handover_code(uuid,uuid) to service_role;

create function public.complete_handover(listing_id uuid, actor_id uuid, supplied_code text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  pickup public.pickups%rowtype;
  handover public.pickup_handover_codes%rowtype;
  failed integer;
begin
  select * into pickup from public.pickups where id = listing_id for update;
  if not found or pickup.collector_id is distinct from actor_id then return 'unavailable'; end if;
  select * into handover from public.pickup_handover_codes where pickup_id = listing_id;
  if not found then return 'no_code'; end if;
  if pickup.status = 'completed' and handover.verified_at is not null and handover.code = supplied_code then return 'completed'; end if;
  if pickup.status not in ('reserved','en_route','arrived') then return 'unavailable'; end if;
  if handover.retry_at > now() then return 'locked'; end if;

  if supplied_code is null or handover.code <> supplied_code then
    failed := case when handover.retry_at is not null then 1 else handover.failed_attempts + 1 end;
    update public.pickup_handover_codes set failed_attempts = failed,
      retry_at = case when failed >= 5 then now() + interval '30 minutes' else null end where pickup_id = listing_id;
    return case when failed >= 5 then 'locked' else 'incorrect' end;
  end if;

  update public.pickup_handover_codes set verified_at = now() where pickup_id = listing_id;
  update public.pickups set status = 'completed', updated_at = now() where id = listing_id;
  insert into public.account_notifications (batch_id,user_id,title,message,pickup_id)
    values (gen_random_uuid(),pickup.seller_id,'Pickup completed','The Taker verified your handover code and completed the pickup.',listing_id);
  return 'completed';
end;
$$;
revoke all on function public.complete_handover(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.complete_handover(uuid,uuid,text) to service_role;

commit;
