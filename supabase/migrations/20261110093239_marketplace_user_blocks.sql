begin;
create table public.marketplace_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index marketplace_blocks_blocked_idx on public.marketplace_blocks (blocked_id, blocker_id);
alter table public.marketplace_blocks enable row level security;
revoke all on public.marketplace_blocks from public, anon, authenticated;
grant select, insert, update, delete on public.marketplace_blocks to service_role;

create function public.is_marketplace_blocked(actor uuid, other_user uuid)
returns boolean language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.marketplace_blocks
    where (blocker_id = actor and blocked_id = other_user)
       or (blocker_id = other_user and blocked_id = actor)
  )
$$;
revoke all on function public.is_marketplace_blocked(uuid,uuid) from public, anon, authenticated;
grant execute on function public.is_marketplace_blocked(uuid,uuid) to service_role;

create function public.get_radar_pickups(viewer uuid)
returns setof public.pickups language sql stable set search_path = ''
as $$
  select p.* from public.pickups p where p.status = 'open' and p.archived_at is null
    and p.collector_id is null and p.seller_id <> viewer
    and not public.is_marketplace_blocked(viewer, p.seller_id)
$$;
revoke all on function public.get_radar_pickups(uuid) from public, anon, authenticated;
grant execute on function public.get_radar_pickups(uuid) to service_role;

create function public.guard_marketplace_block()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  first_user uuid;
  second_user uuid;
begin
  case tg_table_name
    when 'marketplace_blocks' then first_user := new.blocker_id; second_user := new.blocked_id;
    when 'pickup_chat_messages' then first_user := new.giver_id; second_user := new.taker_id;
    else first_user := new.seller_id; second_user := new.collector_id;
  end case;
  if first_user is null or second_user is null then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'marketplace-block:' || least(first_user, second_user)::text || ':' || greatest(first_user, second_user)::text, 0
  ));
  if tg_table_name <> 'marketplace_blocks' and public.is_marketplace_blocked(first_user, second_user) then
    raise exception 'This interaction is unavailable.' using errcode = 'BF008';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_marketplace_block() from public, anon, authenticated;
create trigger guard_marketplace_block_insert before insert on public.marketplace_blocks
  for each row execute function public.guard_marketplace_block();
create trigger guard_marketplace_block_assignment before update of collector_id on public.pickups
  for each row when (new.collector_id is not null and old.collector_id is distinct from new.collector_id)
  execute function public.guard_marketplace_block();
create trigger guard_marketplace_block_request before insert or update on public.pickup_requests
  for each row when (new.status in ('pending','accepted')) execute function public.guard_marketplace_block();
create trigger guard_marketplace_block_chat before insert on public.pickup_chat_messages
  for each row execute function public.guard_marketplace_block();
commit;
