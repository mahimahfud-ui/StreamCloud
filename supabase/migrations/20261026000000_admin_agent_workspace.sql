
create table if not exists public.admin_agent_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New task' check (char_length(title) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_agent_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.admin_agent_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null check (char_length(content) <= 40000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_agent_proposals (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.admin_agent_threads(id) on delete set null,
  prompt text not null check (char_length(prompt) <= 12000),
  summary text not null default '',
  risk text not null default 'medium' check (risk in ('low', 'medium', 'high')),
  files jsonb not null default '[]'::jsonb,
  base_commit_sha text not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'stale', 'failed', 'rejected')),
  applied_commit_sha text,
  deployment_status jsonb not null default '[]'::jsonb,
  error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_agent_messages_thread_created_idx
  on public.admin_agent_messages (thread_id, created_at);
create index if not exists admin_agent_proposals_thread_created_idx
  on public.admin_agent_proposals (thread_id, created_at desc);
create index if not exists admin_agent_proposals_status_created_idx
  on public.admin_agent_proposals (status, created_at desc);

alter table public.admin_agent_threads enable row level security;
alter table public.admin_agent_messages enable row level security;
alter table public.admin_agent_proposals enable row level security;

revoke all on table public.admin_agent_threads from anon, authenticated, public;
revoke all on table public.admin_agent_messages from anon, authenticated, public;
revoke all on table public.admin_agent_proposals from anon, authenticated, public;
grant all on table public.admin_agent_threads to service_role;
grant all on table public.admin_agent_messages to service_role;
grant all on table public.admin_agent_proposals to service_role;
