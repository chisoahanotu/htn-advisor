-- Multi-item photos: items created from the same photo share a photo_group_id
-- and each carries its approximate position in the photo (fractional x/y from
-- top-left) so the storefront gallery can pin a price stamp on it.
alter table items
  add column photo_group_id uuid,
  add column photo_pos jsonb;

create index items_photo_group_idx on items (photo_group_id) where photo_group_id is not null;
