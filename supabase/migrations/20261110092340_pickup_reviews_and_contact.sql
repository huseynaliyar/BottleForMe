begin;
alter table public.profiles add column share_pickup_phone boolean not null default false;
grant select (share_pickup_phone), update (share_pickup_phone) on public.profiles to service_role;

create table public.pickup_reviews (
  pickup_id uuid not null references public.pickups(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references auth.users(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (length(comment) <= 500),
  primary key (pickup_id, author_id),
  check (author_id <> subject_id)
);
create index pickup_reviews_subject_idx on public.pickup_reviews (subject_id);
alter table public.pickup_reviews enable row level security;
revoke all on public.pickup_reviews from public, anon, authenticated;
grant select, insert, update on public.pickup_reviews to service_role;

create function public.pickup_review_summary(subject uuid)
returns table (average numeric, count integer)
language sql stable set search_path = ''
as $$
  select round(avg(stars), 1), count(*)::integer from public.pickup_reviews where subject_id = subject
$$;
revoke all on function public.pickup_review_summary(uuid) from public, anon, authenticated;
grant execute on function public.pickup_review_summary(uuid) to service_role;
commit;
