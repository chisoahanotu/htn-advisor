-- Storefront visit counter, bucketed by day. Buyers call record_visit() once
-- per browser session (deduped client-side); only the admin can read totals.
create table site_visits (
  day date primary key,
  count int not null default 0
);
alter table site_visits enable row level security;

create policy "admin reads visits" on site_visits
  for select to authenticated using (true);

create or replace function record_visit()
returns void language sql security definer set search_path = public as $$
  insert into site_visits (day, count) values (current_date, 1)
  on conflict (day) do update set count = site_visits.count + 1;
$$;
revoke all on function record_visit() from public;
grant execute on function record_visit() to anon, authenticated;
