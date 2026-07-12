-- Purchase-request era: on-site negotiation is gone (buyers text the seller),
-- accepted requests hold an item for a limited time, and item views are
-- counted for the admin insights panel.

-- Seller phone shown on listings ("text me to negotiate") + hold duration.
alter table settings
  add column contact_phone text not null default '',
  add column hold_hours int not null default 48 check (hold_hours between 1 and 720);

-- Views counter + when the current hold started.
alter table items
  add column views int not null default 0,
  add column pending_since timestamptz;

-- Track when an item enters/leaves 'pending' so holds can expire.
create or replace function track_pending()
returns trigger language plpgsql as $$
begin
  if new.status = 'pending' and old.status is distinct from 'pending' then
    new.pending_since := now();
  elsif new.status <> 'pending' then
    new.pending_since := null;
  end if;
  return new;
end $$;

create trigger items_pending_trg
  before update of status on items
  for each row execute function track_pending();

-- Anonymous view counting (RPC only — no direct table writes).
create or replace function record_view(p_item_id uuid)
returns void language sql security definer set search_path = public as $$
  update items set views = views + 1 where id = p_item_id;
$$;
revoke all on function record_view(uuid) from public;
grant execute on function record_view(uuid) to anon, authenticated;

-- Bot credentials for server-side Telegram notifications (RLS on, no
-- policies: readable only by the service role / postgres, never by clients).
create table internal_config (
  key text primary key,
  value text not null
);
alter table internal_config enable row level security;

-- Flip expired holds back to 'available' and DM the seller about each one.
create or replace function apply_hold_expiry()
returns void language plpgsql security definer set search_path = public as $$
declare
  tok text;
  chat text;
  r record;
begin
  select value into tok from internal_config where key = 'telegram_bot_token';
  select value into chat from internal_config where key = 'telegram_chat_id';
  for r in
    update items
    set status = 'available', pending_since = null
    where status = 'pending'
      and pending_since is not null
      and pending_since < now() - make_interval(hours => (select hold_hours from settings where id = 1))
    returning title
  loop
    if tok is not null and chat is not null then
      begin
        perform extensions.http_post(
          'https://api.telegram.org/bot' || tok || '/sendMessage',
          json_build_object('chat_id', chat, 'text',
            '⏰ Hold expired on "' || r.title || '" — relisted as available.')::text,
          'application/json');
      exception when others then
        -- Never let a Telegram hiccup roll back the relist itself.
        null;
      end;
    end if;
  end loop;
end $$;

select cron.schedule('hold-expiry', '15 * * * *', 'select apply_hold_expiry()');
