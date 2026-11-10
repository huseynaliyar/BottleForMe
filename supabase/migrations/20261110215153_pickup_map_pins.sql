alter table public.pickups
  add column pickup_lat double precision,
  add column pickup_lng double precision,
  add column share_exact_pin boolean not null default false,
  add constraint pickups_pin_bounds check (
    (pickup_lat is null and pickup_lng is null and not share_exact_pin)
    or (pickup_lat is not null and pickup_lng is not null
        and pickup_lat between 35.78 and 36.16 and pickup_lng between 14.15 and 14.62)
  );

create function public.clear_deleted_giver_pin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.seller_id is not null and new.seller_id is null then
    new.pickup_lat := null;
    new.pickup_lng := null;
    new.share_exact_pin := false;
  end if;
  return new;
end;
$$;
revoke all on function public.clear_deleted_giver_pin() from public, anon, authenticated;
create trigger clear_deleted_giver_pin before update of seller_id on public.pickups
for each row execute function public.clear_deleted_giver_pin();
