alter table public.staffvoice_reports
  add column if not exists tracking_token_hash text unique,
  add column if not exists public_status text not null default 'received'
    check (public_status in ('received', 'in_review', 'follow_up', 'closed')),
  add column if not exists public_message text not null default '',
  add column if not exists public_status_updated_at timestamptz not null default now();
