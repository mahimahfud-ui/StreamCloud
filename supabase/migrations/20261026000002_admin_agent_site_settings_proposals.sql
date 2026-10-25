
alter table public.admin_agent_proposals
  drop constraint if exists admin_agent_proposals_proposal_type_check;

alter table public.admin_agent_proposals
  add constraint admin_agent_proposals_proposal_type_check
  check (proposal_type in ('code', 'listing_action', 'site_settings'));
