-- Crowded multi-item photos can carry too many price stamps. hide_stamp lets
-- the admin suppress an item's stamp on the gallery/group photo without
-- touching the listing itself (it still appears in the item list below).
alter table items add column hide_stamp boolean not null default false;
