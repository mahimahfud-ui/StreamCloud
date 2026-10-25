
alter table public.admin_agent_proposals
  add column if not exists proposal_type text not null default 'code'
    check (proposal_type in ('code', 'listing_action')),
  add column if not exists action_payload jsonb;
