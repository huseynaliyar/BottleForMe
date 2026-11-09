alter table public.pickups add column bag_policy text
  check (bag_policy in ('included', 'retained', 'return_required'));
