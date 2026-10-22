-- StreamCloud admin control system: sessions, PIN verification, site settings, activity and ordering.
-- Safe to re-run; existing public content is preserved. Never store the PIN or its hash in this file.
create extension if not exists pgcrypto;

alter table public.listings
  add column if not exists position integer not null default 0;

create table if not exists public.admin_credentials (
  singleton boolean primary key default true check (singleton),
  pin_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_credentials enable row level security;
revoke all on public.admin_credentials from anon, authenticated;

create table if not exists public.admin_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from anon, authenticated;
create index if not exists admin_sessions_expires_at_idx on public.admin_sessions(expires_at);

create table if not exists public.site_settings (
  id text primary key default 'global' check (id = 'global'),
  settings jsonb not null default '{"schemaVersion":1,"site":{},"appearance":{},"sections":{"sites":{"visible":true,"title":"Movie Websites"},"apps":{"visible":true,"title":"Movie Apps"},"music":{"visible":true,"title":"Music Apps"},"recs":{"visible":true,"title":"Recommendations"},"order":["sites","apps","music","recs"]},"content":{"overrides":{},"hidden":[],"order":{}}}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
drop policy if exists "public read site settings" on public.site_settings;
create policy "public read site settings" on public.site_settings for select to anon, authenticated using (id = 'global');
insert into public.site_settings(id, settings) values ('global','{"schemaVersion":1,"site":{},"appearance":{},"sections":{"sites":{"visible":true,"title":"Movie Websites"},"apps":{"visible":true,"title":"Movie Apps"},"music":{"visible":true,"title":"Music Apps"},"recs":{"visible":true,"title":"Recommendations"},"order":["sites","apps","music","recs"]},"content":{"overrides":{},"hidden":[],"order":{}}}'::jsonb) on conflict (id) do nothing;

create table if not exists public.admin_activity (
  id bigint generated always as identity primary key,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null default 'site' check (char_length(entity_type) between 1 and 80),
  entity_id text,
  entity_name text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_activity enable row level security;
revoke all on public.admin_activity from anon, authenticated;
create index if not exists admin_activity_created_at_idx on public.admin_activity(created_at desc);

create or replace function public.admin_pin_matches(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
  legacy_match boolean := false;
begin
  if p_pin is null or char_length(p_pin) < 4 or char_length(p_pin) > 64 then
    return false;
  end if;
  select pin_hash into stored_hash from public.admin_credentials where singleton = true;
  if stored_hash is null then return false; end if;
  if stored_hash = crypt(p_pin, stored_hash) then return true; end if;

  -- Upgrade any old migration hash after the correct PIN is supplied.
  if split_part(stored_hash, '$', 1) = 'sha256' then
    legacy_match := encode(digest(split_part(stored_hash, '$', 2) || ':' || p_pin, 'sha256'), 'hex') = split_part(stored_hash, '$', 3);
    if legacy_match then
      update public.admin_credentials
         set pin_hash = crypt(p_pin, gen_salt('bf', 12)), updated_at = now()
       where singleton = true;
      return true;
    end if;
  end if;
  return false;
end;
$$;
revoke all on function public.admin_pin_matches(text) from public, anon, authenticated;
grant execute on function public.admin_pin_matches(text) to service_role;

create or replace function public.admin_update_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin is null or char_length(p_pin) < 4 or char_length(p_pin) > 64 then
    raise exception 'PIN length must be between 4 and 64 characters';
  end if;
  insert into public.admin_credentials(singleton, pin_hash)
  values (true, crypt(p_pin, gen_salt('bf', 12)))
  on conflict (singleton) do update set pin_hash = excluded.pin_hash, updated_at = now();
  delete from public.admin_sessions;
end;
$$;
revoke all on function public.admin_update_pin(text) from public, anon, authenticated;
grant execute on function public.admin_update_pin(text) to service_role;

-- First setup on a new database: run this privately in SQL Editor with your chosen PIN.
-- select public.admin_update_pin('YOUR_PRIVATE_PIN');
-- Do not replace the placeholder with a real PIN in the repository.
