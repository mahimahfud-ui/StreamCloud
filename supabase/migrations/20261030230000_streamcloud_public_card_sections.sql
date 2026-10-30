-- Persist every public StreamCloud card category in the managed listings table.
alter table public.listings
  drop constraint if exists listings_section_check;

alter table public.listings
  add constraint listings_section_check
  check (section in ('movie','series','sites','apps','music','gaming','tv'));

create index if not exists listings_published_section_position_idx
  on public.listings (section, published, position, created_at desc);
