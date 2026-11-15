create function public.pickup_profile_reviews(recipient uuid, pickup_role text, skip_rows integer, page_size integer)
returns table (average numeric, count integer, reviews jsonb)
language sql stable set search_path = ''
as $$
  with received as materialized (
    select r.pickup_id, r.stars, r.comment, p.confirmed_at as pickup_date,
      coalesce(p.confirmed_at, p.updated_at, p.created_at) as sort_date
    from public.pickup_reviews as r
    join public.pickups as p on p.id = r.pickup_id
    where r.subject_id = recipient and p.status = 'completed'
      and (
        (pickup_role = 'giver' and p.seller_id = recipient and p.collector_id = r.author_id)
        or (pickup_role = 'taker' and p.collector_id = recipient and p.seller_id = r.author_id)
      )
  ),
  page as (
    select * from received
    order by sort_date desc nulls last, pickup_id desc
    offset greatest(skip_rows, 0)
    limit least(greatest(page_size, 1), 50)
  )
  select round(avg(stars), 1), count(*)::integer,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'pickupId', pickup_id, 'stars', stars, 'comment', comment, 'pickupDate', pickup_date
      ) order by sort_date desc nulls last, pickup_id desc)
      from page
    ), '[]'::jsonb)
  from received;
$$;

revoke all on function public.pickup_profile_reviews(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.pickup_profile_reviews(uuid, text, integer, integer) to service_role;
