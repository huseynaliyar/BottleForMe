begin;
alter table public.pickups add column archived_at timestamptz;

create function public.guard_archived_pickup()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  listing_archived_at timestamptz;
begin
  if tg_table_name = 'pickup_requests' then
    select archived_at into listing_archived_at from public.pickups where id = new.pickup_id for share;
    if listing_archived_at is not null then
      raise exception 'This listing is archived.' using errcode = 'BF007';
    end if;
  elsif new.archived_at is not null then
    if new.status in ('reserved','en_route','arrived') then
      raise exception 'Complete or cancel this pickup before archiving.' using errcode = 'BF007';
    end if;
    if old.archived_at is null and exists (
      select 1 from public.pickup_requests where pickup_id = new.id and status = 'pending'
    ) then
      raise exception 'Resolve pending time requests before archiving this listing.' using errcode = 'BF007';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_archived_pickup() from public, anon, authenticated;
create trigger guard_archived_pickup before update of status, archived_at on public.pickups
  for each row execute function public.guard_archived_pickup();
create trigger guard_archived_pickup_requests before insert or update on public.pickup_requests
  for each row when (new.status in ('pending','accepted')) execute function public.guard_archived_pickup();
commit;
