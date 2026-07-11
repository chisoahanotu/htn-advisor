-- Moving Sale Storefront — initial schema
-- Matches docs/BACKEND_API.md. Single admin (any authenticated user is the
-- admin); buyers are anonymous. Anonymous writes go through Edge Functions
-- (service role) or SECURITY DEFINER RPCs — never direct table access.

create extension if not exists pgcrypto;

-- ---- enums ----------------------------------------------------------------
create type delivery_option as enum ('none', 'can_help_load', 'local_delivery');
create type item_status as enum ('available', 'pending', 'sold');
create type offer_status as enum ('new', 'accepted', 'declined');
create type window_status as enum ('open', 'booked');
create type booking_status as enum ('requested', 'confirmed', 'declined');
create type message_sender as enum ('buyer', 'seller');

-- ---- tables ---------------------------------------------------------------
create table items (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null default '',
  price numeric not null check (price >= 0),
  original_price numeric,
  dimensions text not null default '',
  category text not null default 'Other',
  condition text not null default 'Good',
  photos text[] not null default '{}',
  delivery_option delivery_option not null default 'none',
  delivery_fee numeric,
  status item_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  buyer_name text not null,
  buyer_contact text not null,
  offer_price numeric not null check (offer_price >= 0),
  message text not null default '',
  is_bundle boolean not null default false,
  status offer_status not null default 'new',
  -- capability token: knowing it grants access to this offer's thread
  thread_token text not null default encode(gen_random_bytes(16), 'hex'),
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  sender message_sender not null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table pickup_windows (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status window_status not null default 'open'
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references pickup_windows(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  buyer_name text not null,
  buyer_contact text not null,
  status booking_status not null default 'requested',
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);

create table settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default 'Moving Sale',
  move_out_date date,
  bundle_discount_pct int not null default 0 check (bundle_discount_pct between 0 and 90),
  price_drops jsonb not null default '[]'
);
insert into settings (id) values (1);

-- ---- housekeeping triggers --------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger items_updated_at before update on items
  for each row execute function set_updated_at();

-- Capture the original price once so auto price-drops have a baseline.
create or replace function set_original_price() returns trigger language plpgsql as $$
begin
  if new.original_price is null then
    new.original_price = new.price;
  end if;
  return new;
end $$;
create trigger items_original_price before insert on items
  for each row execute function set_original_price();

-- ---- row level security -----------------------------------------------------
alter table items enable row level security;
alter table offers enable row level security;
alter table messages enable row level security;
alter table pickup_windows enable row level security;
alter table bookings enable row level security;
alter table settings enable row level security;

-- Public (anon) can read the catalog, windows, and settings.
create policy "public read items" on items for select using (true);
create policy "public read windows" on pickup_windows for select using (true);
create policy "public read settings" on settings for select using (true);

-- The authenticated admin can do everything.
create policy "admin all items" on items for all to authenticated using (true) with check (true);
create policy "admin all offers" on offers for all to authenticated using (true) with check (true);
create policy "admin all messages" on messages for all to authenticated using (true) with check (true);
create policy "admin all windows" on pickup_windows for all to authenticated using (true) with check (true);
create policy "admin all bookings" on bookings for all to authenticated using (true) with check (true);
create policy "admin all settings" on settings for all to authenticated using (true) with check (true);

-- No anon policies on offers/messages/bookings: buyers create them via the
-- `submit` Edge Function (service role) and read threads via the RPCs below.

-- ---- buyer thread RPCs (token-authenticated) --------------------------------
create or replace function thread_get(p_offer_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer offers%rowtype;
  v_title text;
  v_messages jsonb;
begin
  select * into v_offer from offers
    where id = p_offer_id and thread_token = p_token;
  if not found then
    return null;
  end if;
  select title into v_title from items where id = v_offer.item_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'sender', m.sender, 'body', m.body, 'created_at', m.created_at)
      order by m.created_at), '[]'::jsonb)
    into v_messages
    from messages m where m.offer_id = p_offer_id;
  return jsonb_build_object(
    'offer', jsonb_build_object(
      'id', v_offer.id,
      'status', v_offer.status,
      'offer_price', v_offer.offer_price,
      'item_title', coalesce(v_title, 'Item')),
    'messages', v_messages);
end $$;

create or replace function thread_post(p_offer_id uuid, p_token text, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from offers where id = p_offer_id and thread_token = p_token) then
    raise exception 'thread not found';
  end if;
  insert into messages (offer_id, sender, body)
    values (p_offer_id, 'buyer', p_body);
end $$;

grant execute on function thread_get(uuid, text) to anon, authenticated;
grant execute on function thread_post(uuid, text, text) to anon, authenticated;

-- ---- auto price drops (Phase 2) ---------------------------------------------
-- settings.price_drops: [{"days_before": 14, "pct": 10}, {"days_before": 7, "pct": 20}]
-- Applied daily: within N days of move_out_date, available items are priced at
-- original_price * (1 - pct/100) using the largest applicable drop.
create or replace function apply_price_drops() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v settings%rowtype;
  v_days int;
  v_pct int := 0;
  drop_rec jsonb;
begin
  select * into v from settings where id = 1;
  if v.move_out_date is null or jsonb_array_length(v.price_drops) = 0 then
    return;
  end if;
  v_days := v.move_out_date - current_date;
  for drop_rec in select * from jsonb_array_elements(v.price_drops) loop
    if v_days <= (drop_rec->>'days_before')::int
       and (drop_rec->>'pct')::int > v_pct then
      v_pct := (drop_rec->>'pct')::int;
    end if;
  end loop;
  if v_pct > 0 then
    update items
      set price = round(original_price * (1 - v_pct / 100.0))
      where status = 'available'
        and original_price is not null
        and price > round(original_price * (1 - v_pct / 100.0));
  end if;
end $$;

-- Schedule daily at 06:00 UTC if pg_cron is available (it is on Supabase).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('apply-price-drops', '0 6 * * *', 'select apply_price_drops()');
exception when others then
  raise notice 'pg_cron unavailable — schedule apply_price_drops() manually (%).', sqlerrm;
end $$;

-- ---- storage: public photos bucket ------------------------------------------
insert into storage.buckets (id, name, public)
  values ('photos', 'photos', true)
  on conflict (id) do nothing;

create policy "public read photos" on storage.objects
  for select using (bucket_id = 'photos');
create policy "admin write photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
create policy "admin update photos" on storage.objects
  for update to authenticated using (bucket_id = 'photos');
create policy "admin delete photos" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');
