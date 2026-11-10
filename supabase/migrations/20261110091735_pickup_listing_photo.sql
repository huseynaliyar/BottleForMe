alter table public.pickups add column photo_jpeg text
  check (length(photo_jpeg) <= 699052 and photo_jpeg ~ '^[A-Za-z0-9+/]+={0,2}$');
