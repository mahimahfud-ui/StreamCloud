-- StreamCloud admin listings. Run once (supabase db push, or paste in SQL editor).
create extension if not exists pgcrypto;

create table if not exists public.listings (
  id                uuid primary key default gen_random_uuid(),
  section           text not null check (section in ('movie','series','sites','apps','music')),
  category          text not null check (char_length(category) between 1 and 60),
  name              text not null check (char_length(name) between 1 and 160),
  url               text not null check (url ~* '^https://'),
  url_key           text not null,
  description       text check (char_length(description) <= 1500),
  logo_url          text,
  poster_url        text,
  year              int  check (year between 1870 and 2100),
  genres            text[] not null default '{}',
  imdb_id           text check (imdb_id ~ '^tt[0-9]{5,10}$'),
  imdb_rating       numeric(3,1) check (imdb_rating between 0 and 10),
  season_count      int  check (season_count between 0 and 5000),
  episode_count     int  check (episode_count between 0 and 100000),
  official_url      text,
  download_url      text,
  download_verified boolean not null default false,
  platform          text,
  version           text,
  ads               smallint not null default 1 check (ads in (0,1,2)),
  published         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists listings_url_key_uidx  on public.listings (url_key);
create unique index if not exists listings_imdb_uidx     on public.listings (section, imdb_id) where imdb_id is not null;

-- Row Level Security: the public can only READ published rows.
-- No insert/update/delete policy exists, so only the service role
-- (used by the Edge Functions after admin verification) can write.
alter table public.listings enable row level security;
revoke all on public.listings from anon, authenticated;
grant select on public.listings to anon, authenticated;

drop policy if exists "public read published" on public.listings;
create policy "public read published" on public.listings
  for select to anon, authenticated using (published = true);

-- Failed-PIN tracking (server-side only; no policies = no public access).
create table if not exists public.admin_attempts (
  key          text primary key,
  fails        int not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.admin_attempts enable row level security;
revoke all on public.admin_attempts from anon, authenticated;

create or replace function public.admin_lock_status(p_key text)
returns timestamptz language sql security definer set search_path = public as $$
  select locked_until from public.admin_attempts
  where key = p_key and locked_until is not null and locked_until > now();
$$;

create or replace function public.admin_record_failure(p_key text, p_max int, p_window_secs int, p_lock_secs int)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare r public.admin_attempts; lock_until timestamptz;
begin
  insert into public.admin_attempts as a (key, fails, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    fails = case when a.window_start < now() - make_interval(secs => p_window_secs) then 1 else a.fails + 1 end,
    window_start = case when a.window_start < now() - make_interval(secs => p_window_secs) then now() else a.window_start end
  returning * into r;
  if r.fails >= p_max then
    lock_until := now() + make_interval(secs => p_lock_secs);
    update public.admin_attempts set locked_until = lock_until, fails = 0, window_start = now() where key = p_key;
    return lock_until;
  end if;
  return null;
end $$;

create or replace function public.admin_clear_failures(p_key text)
returns void language sql security definer set search_path = public as $$
  delete from public.admin_attempts where key = p_key;
$$;

revoke all on function public.admin_lock_status(text), public.admin_record_failure(text,int,int,int), public.admin_clear_failures(text) from public, anon, authenticated;
grant execute on function public.admin_lock_status(text), public.admin_record_failure(text,int,int,int), public.admin_clear_failures(text) to service_role;
