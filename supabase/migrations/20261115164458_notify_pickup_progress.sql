create schema if not exists private;

create function private.notify_pickup_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  actor uuid;
  notice_title text;
  notice_message text;
begin
  if new.seller_id is null or new.collector_id is null then return new; end if;

  case new.status
    when 'en_route' then
      recipient := new.seller_id;
      notice_title := 'Taker on the way';
      notice_message := 'The Taker is on the way to your pickup.';
    when 'arrived' then
      recipient := new.seller_id;
      notice_title := 'Taker arrived';
      notice_message := 'The Taker has arrived at the pickup address.';
    when 'reserved' then
      -- Scheduled confirmations already notify the other participant.
      if new.confirmed_at is not null then return new; end if;
      recipient := new.seller_id;
      notice_title := 'Pickup reserved';
      notice_message := 'A Taker reserved your pickup.';
    when 'cancelled' then
      -- The arrangement trigger already handles scheduled cancellations.
      if old.confirmed_at is not null then return new; end if;
      actor := nullif(current_setting('bottleforme.schedule_actor', true), '')::uuid;
      if actor = new.collector_id then recipient := new.seller_id;
      elsif actor = new.seller_id then recipient := new.collector_id;
      else return new; end if;
      notice_title := 'Pickup cancelled';
      notice_message := 'Your pickup partner cancelled the pickup.';
    else
      -- Completion is already notified by the handover code function.
      return new;
  end case;

  insert into public.account_notifications (batch_id, user_id, title, message, pickup_id)
  values (gen_random_uuid(), recipient, notice_title, notice_message, new.id);
  return new;
end;
$$;

revoke all on function private.notify_pickup_progress() from public, anon, authenticated;

create trigger notify_pickup_progress
after update of status on public.pickups
for each row when (old.status is distinct from new.status)
execute function private.notify_pickup_progress();
