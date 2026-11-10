begin;
create table public.marketplace_paused_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paused_at timestamptz not null default now(),
  deleting boolean not null default false
);
alter table public.marketplace_paused_accounts enable row level security;
revoke all on public.marketplace_paused_accounts from public, anon, authenticated;
grant select on public.marketplace_paused_accounts to service_role;

create function public.account_is_paused(actor uuid)
returns boolean language sql stable set search_path = ''
as $$
  select exists (select 1 from public.marketplace_paused_accounts where user_id = actor)
$$;
revoke all on function public.account_is_paused(uuid) from public, anon, authenticated;
grant execute on function public.account_is_paused(uuid) to service_role;

create function public.lock_marketplace_account(actor uuid)
returns void language sql volatile set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('account-lifecycle:' || actor::text, 0))
$$;
revoke all on function public.lock_marketplace_account(uuid) from public, anon, authenticated;

create function public.set_account_lifecycle(actor uuid, operation text)
returns text language plpgsql security definer set search_path = ''
as $$
begin
  if operation not in ('pause','reactivate','delete') then return 'invalid'; end if;
  perform public.lock_marketplace_account(actor);
  if operation = 'reactivate' then
    if exists (select 1 from public.marketplace_paused_accounts where user_id = actor and deleting) then
      return 'deleting';
    end if;
    delete from public.marketplace_paused_accounts where user_id = actor;
    return 'active';
  end if;

  if exists (select 1 from public.pickups where (seller_id = actor or collector_id = actor)
    and status in ('reserved','en_route','arrived')) or exists (
      select 1 from public.pickup_requests where (seller_id = actor or collector_id = actor) and status = 'pending'
    ) then
    return 'active_pickups';
  end if;
  if operation = 'delete' and (select maintenance from public.marketplace_settings where singleton) then
    return 'maintenance';
  end if;

  insert into public.marketplace_paused_accounts (user_id, deleting) values (actor, operation = 'delete')
    on conflict (user_id) do update set deleting = marketplace_paused_accounts.deleting or excluded.deleting;
  delete from public.web_push_subscriptions where user_id = actor;
  delete from public.mobile_push_devices where user_id = actor;
  return case when operation = 'delete' then 'deleting' else 'paused' end;
end;
$$;
revoke all on function public.set_account_lifecycle(uuid,text) from public, anon, authenticated;
grant execute on function public.set_account_lifecycle(uuid,text) to service_role;

create or replace function public.get_radar_pickups(viewer uuid)
returns setof public.pickups language sql stable set search_path = ''
as $$
  select p.* from public.pickups p where p.status = 'open' and p.archived_at is null
    and p.collector_id is null and p.seller_id <> viewer
    and not public.account_is_paused(p.seller_id)
    and not public.is_marketplace_blocked(viewer, p.seller_id)
$$;

create function public.guard_pickup_account_state()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.seller_id is not null then
    perform public.lock_marketplace_account(least(new.seller_id, new.collector_id));
    if new.collector_id is not null then
      perform public.lock_marketplace_account(greatest(new.seller_id, new.collector_id));
    end if;
    if public.account_is_paused(new.seller_id) or public.account_is_paused(new.collector_id) then
      raise exception 'This pickup is unavailable.' using errcode = 'BF009';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_pickup_account_state() from public, anon, authenticated;
create trigger guard_pickup_listing_account before insert on public.pickups
  for each row execute function public.guard_pickup_account_state();
create trigger guard_pickup_assignment_account before update of collector_id on public.pickups
  for each row when (new.collector_id is not null and old.collector_id is distinct from new.collector_id)
  execute function public.guard_pickup_account_state();
create trigger guard_pickup_request_account before insert or update on public.pickup_requests
  for each row when (new.status in ('pending','accepted')) execute function public.guard_pickup_account_state();

create function public.redact_deleted_listing_owner()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.seller_name := 'Deleted account';
  new.seller_phone := null;
  new.seller_revolut_tag := null;
  new.address_notes := null;
  new.photo_jpeg := null;
  return new;
end;
$$;
revoke all on function public.redact_deleted_listing_owner() from public, anon, authenticated;
create trigger redact_deleted_listing_owner before update of seller_id on public.pickups
  for each row when (old.seller_id is not null and new.seller_id is null)
  execute function public.redact_deleted_listing_owner();

create function public.redact_deleted_report_account()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.reason := 'Redacted after account deletion.';
  return new;
end;
$$;
revoke all on function public.redact_deleted_report_account() from public, anon, authenticated;
create trigger redact_deleted_report_account before update of reporter_id, reported_user_id on public.marketplace_reports
  for each row when ((old.reporter_id is not null and new.reporter_id is null)
    or (old.reported_user_id is not null and new.reported_user_id is null))
  execute function public.redact_deleted_report_account();
commit;
