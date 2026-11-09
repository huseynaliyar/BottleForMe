begin;

create table public.pickup_chat_messages (
  id uuid primary key,
  seq bigint generated always as identity unique,
  pickup_id uuid not null references public.pickups(id) on delete cascade,
  giver_id uuid not null references auth.users(id) on delete cascade,
  taker_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null check (sender_id in (giver_id, taker_id)),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.pickup_chat_messages enable row level security;
revoke all on public.pickup_chat_messages from public, anon, authenticated;
create index pickup_chat_thread_idx on public.pickup_chat_messages (pickup_id, giver_id, taker_id, seq desc);
create index pickup_chat_sender_idx on public.pickup_chat_messages (sender_id, created_at desc);

alter table public.account_notifications add column pickup_chat boolean not null default false;
grant select (pickup_chat) on public.account_notifications to service_role;
-- The existing shared inbox and native push remain unchanged for mobile clients.
alter policy read_own_notifications on public.account_notifications
  using ((select auth.uid()) = user_id and not pickup_chat);

create or replace function public.queue_mobile_push()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.pickup_chat then return new; end if;
  insert into public.mobile_push_jobs (batch_id, installation_id, user_id)
  select new.batch_id, d.installation_id, new.user_id
  from public.mobile_push_devices as d
  where d.user_id = new.user_id
    and d.updated_at > now() - interval '90 days'
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.queue_mobile_push() from public, anon, authenticated;


drop function public.claim_web_push(uuid);
create function public.claim_web_push(target_batch uuid default null)
returns table (
  batch_id uuid, subscription_id uuid, endpoint text, p256dh text, auth text,
  attempts integer, lease_id uuid, title text, message text, pickup_id uuid, pickup_chat boolean
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
  select c.batch_id, c.subscription_id, s.endpoint, s.p256dh, s.auth, c.attempts, c.lease_id, n.title, n.message, n.pickup_id, n.pickup_chat
  from claimed as c
  join public.web_push_subscriptions as s on s.id = c.subscription_id and s.user_id = c.user_id
  join public.account_notifications as n on (n.user_id, n.batch_id) = (c.user_id, c.batch_id);
$$;
revoke all on function public.claim_web_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_web_push(uuid) to service_role;


create function public.read_pickup_chat(listing uuid, actor uuid, before_seq bigint default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'canSend', p.status in ('reserved','en_route','arrived'),
    'messages', (
      select coalesce(jsonb_agg(to_jsonb(m) order by m.seq), '[]'::jsonb)
      from (
        select seq, body, created_at, sender_id = actor as mine
        from public.pickup_chat_messages
        where pickup_id = p.id and giver_id = p.seller_id and taker_id = p.collector_id
          and (before_seq is null or seq < before_seq)
        order by seq desc limit 50
      ) m
    )
  )
  from public.pickups p
  where p.id = listing and p.collector_id is not null and actor in (p.seller_id,p.collector_id)
    and p.status in ('reserved','en_route','arrived','completed','cancelled');
$$;

create function public.send_pickup_chat(listing uuid, actor uuid, message_id uuid, content text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  pickup public.pickups%rowtype;
  target_id uuid;
  previous public.pickup_chat_messages%rowtype;
begin
  select * into pickup from public.pickups where id = listing for update;
  if not found or pickup.collector_id is null or actor not in (pickup.seller_id,pickup.collector_id) then
    return 'unavailable';
  end if;
  select * into previous from public.pickup_chat_messages where id = message_id;
  if found then
    if previous.pickup_id = listing and previous.sender_id = actor and previous.body = content
      and previous.giver_id = pickup.seller_id and previous.taker_id = pickup.collector_id then return 'sent'; end if;
    return 'unavailable';
  end if;
  if pickup.status not in ('reserved','en_route','arrived') then return 'unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 18914));
  if (select count(*) from public.pickup_chat_messages where sender_id = actor and created_at > now() - interval '1 minute') >= 12 then
    return 'limited';
  end if;
  target_id := case when actor = pickup.seller_id then pickup.collector_id else pickup.seller_id end;
  insert into public.pickup_chat_messages (id,pickup_id,giver_id,taker_id,sender_id,body)
    values (message_id,listing,pickup.seller_id,pickup.collector_id,actor,content);
  insert into public.account_notifications (batch_id,user_id,title,message,pickup_id,pickup_chat)
    values (message_id,target_id,'New pickup message','Open BottleForMe to read your message.',listing,true);
  return 'sent';
end;
$$;

create function public.mark_pickup_chat_read(listing uuid, actor uuid, through_seq bigint)
returns void language sql security definer set search_path = ''
as $$
  update public.pickup_chat_messages m set read_at = now()
  from public.pickups p
  where p.id = listing and m.pickup_id = p.id and m.giver_id = p.seller_id and m.taker_id = p.collector_id
    and actor in (m.giver_id,m.taker_id) and m.sender_id <> actor and m.seq <= through_seq and m.read_at is null;
$$;

create function public.pickup_chat_unread(actor uuid)
returns table (pickup_id uuid, unread integer, last_message timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.pickup_id, count(*)::integer, max(m.created_at)
  from public.pickup_chat_messages m
  join public.pickups p on p.id = m.pickup_id and p.seller_id = m.giver_id and p.collector_id = m.taker_id
  where actor in (m.giver_id,m.taker_id) and m.sender_id <> actor and m.read_at is null
  group by m.pickup_id;
$$;

revoke all on function public.read_pickup_chat(uuid,uuid,bigint), public.send_pickup_chat(uuid,uuid,uuid,text),
  public.mark_pickup_chat_read(uuid,uuid,bigint), public.pickup_chat_unread(uuid) from public, anon, authenticated;
grant execute on function public.read_pickup_chat(uuid,uuid,bigint), public.send_pickup_chat(uuid,uuid,uuid,text),
  public.mark_pickup_chat_read(uuid,uuid,bigint), public.pickup_chat_unread(uuid) to service_role;

commit;
