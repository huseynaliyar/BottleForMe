begin;
create or replace function public.queue_mobile_push()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
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

drop function public.claim_mobile_push(uuid);
create function public.claim_mobile_push(target_batch uuid default null)
returns table (
  batch_id uuid, installation_id uuid, user_id uuid, token text, attempts integer, ticket_id text, lease_id uuid, title text, message text, pickup_id uuid, pickup_chat boolean
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
  select c.batch_id, c.installation_id, c.user_id, d.token, c.attempts, c.ticket_id, c.lease_id, n.title, n.message, n.pickup_id, n.pickup_chat
  from claimed as c join public.mobile_push_devices as d using (installation_id)
  join public.account_notifications as n on (n.user_id,n.batch_id) = (c.user_id,c.batch_id)
  where c.user_id = d.user_id;
$$;
revoke all on function public.claim_mobile_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_mobile_push(uuid) to service_role;
commit;
