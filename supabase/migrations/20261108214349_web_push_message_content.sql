begin;

grant select (batch_id, user_id, title, message) on public.account_notifications to service_role;

-- Keep the worker RPC name and arguments while adding the inbox text to its result.
drop function public.claim_web_push(uuid);
create function public.claim_web_push(target_batch uuid default null)
returns table (
  batch_id uuid, subscription_id uuid, endpoint text, p256dh text, auth text,
  attempts integer, lease_id uuid, title text, message text
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
  select c.batch_id, c.subscription_id, s.endpoint, s.p256dh, s.auth, c.attempts, c.lease_id, n.title, n.message
  from claimed as c
  join public.web_push_subscriptions as s on s.id = c.subscription_id and s.user_id = c.user_id
  join public.account_notifications as n on (n.user_id, n.batch_id) = (c.user_id, c.batch_id);
$$;
revoke all on function public.claim_web_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_web_push(uuid) to service_role;

commit;
